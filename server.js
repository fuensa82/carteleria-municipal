const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const helmet = require('helmet');
const cron = require('node-cron');
const db = require('./db');
const { importarNoticiasWeb } = require('./importador-web');

const app = express();
const PORT = process.env.PORT || 3100;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEDIA_DIR = path.join(__dirname, 'media');
const IMAGE_DIR = path.join(MEDIA_DIR, 'imagenes');
fs.mkdirSync(IMAGE_DIR, { recursive: true });

// IP observada en la última sincronización de cada pantalla.
// Se mantiene únicamente en memoria: no se almacena en MariaDB.
const ipsPantallas = new Map();
const TIEMPO_CONEXION_MS = 180 * 1000;

function obtenerIpCliente(req) {
    let ip = req.socket?.remoteAddress || '';

    // Node puede representar las IPv4 como direcciones IPv6 mapeadas.
    if (ip.startsWith('::ffff:')) ip = ip.substring(7);

    return ip || null;
}

const TIPOS_PERMITIDOS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            upgradeInsecureRequests: null
        }
    }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/media', express.static(MEDIA_DIR));

const almacenamiento = multer.diskStorage({
    destination: (req, file, callback) => callback(null, IMAGE_DIR),
    filename: (req, file, callback) => {
        const extension = TIPOS_PERMITIDOS[file.mimetype];
        if (!extension) return callback(new Error('Formato no permitido. Utiliza JPG, PNG, WEBP o GIF.'));
        callback(null, `${crypto.randomUUID()}${extension}`);
    }
});

const subirImagen = multer({
    storage: almacenamiento,
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (!TIPOS_PERMITIDOS[file.mimetype]) {
            return callback(new Error('Formato no permitido. Utiliza JPG, PNG, WEBP o GIF.'));
        }
        callback(null, true);
    }
});

function fechaISOValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const [y, m, d] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, d));
    return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

function leerIdsPantallas(valor) {
    let datos = valor;
    if (typeof datos === 'string') {
        try { datos = JSON.parse(datos); } catch { return null; }
    }
    if (!Array.isArray(datos)) return null;
    const ids = [...new Set(datos.map(Number))];
    if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) return null;
    return ids;
}

async function validarPantallas(ids) {
    if (!ids.length) return true;
    const marcas = ids.map(() => '?').join(',');
    const [filas] = await db.execute(
        `SELECT id FROM pantallas WHERE activa = 1 AND id IN (${marcas})`, ids
    );
    return filas.length === ids.length;
}

app.get('/api/estado', (req, res) => {
    res.json({ aplicacion: 'Cartelería Municipal', estado: 'funcionando', version: '0.3.0' });
});


// Obtener los carteles activos asignados a una pantalla.
app.get('/api/reproductor/:codigo/carteles', async (req, res, next) => {
    const codigo = String(req.params.codigo || '').trim();

    if (!codigo || codigo.length > 64) {
        return res.status(400).json({
            error: 'Código de pantalla no válido.'
        });
    }

    try {
        const [pantallas] = await db.execute(`
            SELECT id, nombre, codigo, ubicacion
            FROM pantallas
            WHERE codigo = ? AND activa = 1
            LIMIT 1
        `, [codigo]);

        if (!pantallas.length) {
            return res.status(404).json({
                error: 'La pantalla no existe o está inactiva.'
            });
        }

        const pantalla = pantallas[0];

        // Registrar la IP de origen de esta sincronización (sin confiar en cabeceras HTTP).
        ipsPantallas.set(Number(pantalla.id), {
            ip: obtenerIpCliente(req),
            ultimaConexion: Date.now()
        });

        await db.execute(`
            UPDATE pantallas
            SET ultima_sincronizacion = NOW()
            WHERE id = ?
        `, [pantalla.id]);

        const [carteles] = await db.execute(`
            SELECT
                c.id,
                c.nombre,
                c.archivo,
                c.tipo_mime,
                c.hash_sha256,
                c.duracion_segundos,
                c.titular,
                c.posicion_titular,
                DATE_FORMAT(c.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(c.fecha_fin, '%Y-%m-%d') AS fecha_fin
            FROM carteles c
            WHERE c.activo = 1
              AND (c.fecha_fin IS NULL OR c.fecha_fin >= CURDATE())
              AND (
                    c.destino = 'todas'
                    OR (
                        c.destino = 'seleccionadas'
                        AND EXISTS (
                            SELECT 1
                            FROM carteles_pantallas cp
                            WHERE cp.cartel_id = c.id
                              AND cp.pantalla_id = ?
                        )
                    )
              )
            ORDER BY c.fecha_alta ASC, c.id ASC
        `, [pantalla.id]);

        const resultado = carteles.map(cartel => ({
            ...cartel,
            url_imagen: `/media/imagenes/${encodeURIComponent(cartel.archivo)}`
        }));

        res.json({
            pantalla: {
                id: pantalla.id,
                nombre: pantalla.nombre,
                codigo: pantalla.codigo,
                ubicacion: pantalla.ubicacion
            },
            sincronizado_en: new Date().toISOString(),
            total_carteles: resultado.length,
            carteles: resultado
        });

    } catch (error) {
        next(error);
    }
});

// Importación manual de noticias destacadas y noticias de la portada municipal.
app.post('/api/importacion-web/ejecutar', async (req, res, next) => {
    try {
        const resultado = await importarNoticiasWeb(db, IMAGE_DIR);
        res.json({
            mensaje: `Importación terminada: ${resultado.importadas} nueva(s), ${resultado.duplicadas} ya existente(s).`,
            ...resultado
        });
    } catch (error) {
        next(error);
    }
});

// Lista de carteles y sus pantallas asignadas.
app.get('/api/carteles', async (req, res, next) => {
    try {
        const [carteles] = await db.execute(`
            SELECT id, nombre, archivo, tipo_mime, hash_sha256, activo,
                   duracion_segundos, destino, titular, posicion_titular,
                   origen, url_origen, fecha_alta, fecha_modificacion,
                   DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
                   DATE_FORMAT(fecha_fin, '%Y-%m-%d') AS fecha_fin
            FROM carteles
            ORDER BY fecha_alta DESC, id DESC
        `);

        if (carteles.length) {
            const ids = carteles.map(c => c.id);
            const marcas = ids.map(() => '?').join(',');
            const [asignaciones] = await db.execute(`
                SELECT cp.cartel_id, p.id, p.nombre
                FROM carteles_pantallas cp
                INNER JOIN pantallas p ON p.id = cp.pantalla_id
                WHERE cp.cartel_id IN (${marcas})
                ORDER BY p.nombre
            `, ids);

            const porCartel = new Map();
            for (const fila of asignaciones) {
                if (!porCartel.has(fila.cartel_id)) porCartel.set(fila.cartel_id, []);
                porCartel.get(fila.cartel_id).push({ id: fila.id, nombre: fila.nombre });
            }
            for (const cartel of carteles) cartel.pantallas = porCartel.get(cartel.id) || [];
        }

        res.json(carteles);
    } catch (error) {
        next(error);
    }
});

// Listado de pantallas registradas con información de monitorización.
app.get('/api/pantallas', async (req, res, next) => {
    try {
        const [pantallas] = await db.execute(`
            SELECT
                p.id,
                p.nombre,
                p.codigo,
                p.ubicacion,
                p.activa,
                p.fecha_alta,
                p.ultima_sincronizacion,
                (
                    SELECT COUNT(*)
                    FROM carteles c
                    WHERE c.activo = 1
                      AND (c.fecha_inicio IS NULL OR c.fecha_inicio <= CURDATE())
                      AND (c.fecha_fin IS NULL OR c.fecha_fin >= CURDATE())
                      AND (
                          c.destino = 'todas'
                          OR (
                              c.destino = 'seleccionadas'
                              AND EXISTS (
                                  SELECT 1
                                  FROM carteles_pantallas cp
                                  WHERE cp.cartel_id = c.id
                                    AND cp.pantalla_id = p.id
                              )
                          )
                      )
                ) AS total_carteles
            FROM pantallas p
            ORDER BY p.nombre, p.id
        `);

        const ahora = Date.now();
        const resultado = pantallas.map(pantalla => {
            const conexion = ipsPantallas.get(Number(pantalla.id));
            const ipActual = conexion && (ahora - conexion.ultimaConexion) <= TIEMPO_CONEXION_MS
                ? conexion.ip
                : null;

            return { ...pantalla, ip_actual: ipActual };
        });

        res.json(resultado);
    } catch (error) {
        next(error);
    }
});

// Alta de una pantalla. El código debe ser único.
app.post('/api/pantallas', async (req, res, next) => {
    const nombre = String(req.body.nombre || '').trim();
    const codigo = String(req.body.codigo || '').trim();
    const ubicacion = String(req.body.ubicacion || '').trim();

    if (!nombre || nombre.length > 100 || !codigo || codigo.length > 64 || ubicacion.length > 150) {
        return res.status(400).json({ error: 'Indica un nombre y un código válidos. La ubicación es opcional.' });
    }

    try {
        const [resultado] = await db.execute(
            'INSERT INTO pantallas (nombre, codigo, ubicacion, activa) VALUES (?, ?, ?, 1)',
            [nombre, codigo, ubicacion || null]
        );

        res.status(201).json({ mensaje: 'Pantalla registrada correctamente.', id: resultado.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe una pantalla con ese código.' });
        }
        next(error);
    }
});

// Editar los datos de una pantalla.
app.patch('/api/pantallas/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    const nombre = String(req.body.nombre || '').trim();
    const codigo = String(req.body.codigo || '').trim();
    const ubicacion = String(req.body.ubicacion || '').trim();

    if (!Number.isSafeInteger(id) || id < 1 || !nombre || nombre.length > 100 ||
        !codigo || codigo.length > 64 || ubicacion.length > 150) {
        return res.status(400).json({ error: 'Indica un nombre y un código válidos. La ubicación es opcional.' });
    }

    try {
        const [resultado] = await db.execute(
            'UPDATE pantallas SET nombre = ?, codigo = ?, ubicacion = ? WHERE id = ?',
            [nombre, codigo, ubicacion || null, id]
        );

        if (!resultado.affectedRows) {
            const [existe] = await db.execute('SELECT id FROM pantallas WHERE id = ?', [id]);
            if (!existe.length) return res.status(404).json({ error: 'No se ha encontrado la pantalla.' });
        }

        res.json({ mensaje: 'Pantalla actualizada correctamente.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe una pantalla con ese código.' });
        }
        next(error);
    }
});

// Activar o desactivar una pantalla.
app.patch('/api/pantallas/:id/estado', async (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1 || typeof req.body.activa !== 'boolean') {
        return res.status(400).json({ error: 'Los datos enviados no son válidos.' });
    }

    try {
        const [resultado] = await db.execute(
            'UPDATE pantallas SET activa = ? WHERE id = ?',
            [req.body.activa ? 1 : 0, id]
        );

        if (!resultado.affectedRows) {
            return res.status(404).json({ error: 'No se ha encontrado la pantalla.' });
        }

        res.json({ mensaje: 'Estado de la pantalla actualizado.' });
    } catch (error) {
        next(error);
    }
});

// Subir imagen y guardar configuración inicial.
app.post('/api/carteles', (req, res, next) => {
    subirImagen.single('imagen')(req, res, async error => {
        if (error) {
            const esTamano = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
            return res.status(400).json({
                error: esTamano ? 'La imagen no puede superar los 15 MB.' : error.message
            });
        }

        if (!req.file) return res.status(400).json({ error: 'Debes seleccionar una imagen.' });

        const nombre = String(req.body.nombre || '').trim();
        const duracion = Number(req.body.duracion_segundos || 15);
        const destino = String(req.body.destino || 'todas');
        const titular = String(req.body.titular || '').trim();
        const posicionTitular = String(req.body.posicion_titular || 'inferior');
        const fechaInicio = String(req.body.fecha_inicio || '');
        const fechaFin = String(req.body.fecha_fin || '');
        const idsPantallas = leerIdsPantallas(req.body.pantallas || '[]');

        if (!fechaISOValida(fechaInicio) || !fechaISOValida(fechaFin) || fechaFin < fechaInicio) {
            await fsp.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ error: 'Las fechas no son válidas o la finalización es anterior al inicio.' });
        }

        if (!nombre || nombre.length > 150) {
            await fsp.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ error: 'El nombre es obligatorio y no puede superar los 150 caracteres.' });
        }

        if (!Number.isInteger(duracion) || duracion < 3 || duracion > 3600) {
            await fsp.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ error: 'La duración debe estar entre 3 y 3600 segundos.' });
        }

        if (titular.length > 150 || !['superior', 'inferior'].includes(posicionTitular)) {
            await fsp.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ error: 'El titular no puede superar los 150 caracteres y su posición debe ser superior o inferior.' });
        }

        if (!['todas', 'seleccionadas'].includes(destino) || idsPantallas === null ||
            (destino === 'seleccionadas' && idsPantallas.length === 0)) {
            await fsp.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ error: 'La selección de pantallas no es válida.' });
        }

        try {
            if (destino === 'seleccionadas' && !(await validarPantallas(idsPantallas))) {
                await fsp.unlink(req.file.path).catch(() => {});
                return res.status(400).json({ error: 'Una o varias pantallas seleccionadas no existen o están inactivas.' });
            }

            const contenido = await fsp.readFile(req.file.path);
            const hash = crypto.createHash('sha256').update(contenido).digest('hex');

            const [resultado] = await db.execute(`
                INSERT INTO carteles
                    (nombre, archivo, tipo_mime, hash_sha256, activo, fecha_inicio, fecha_fin,
                     duracion_segundos, destino, titular, posicion_titular)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
            `, [
                nombre, req.file.filename, req.file.mimetype, hash,
                fechaInicio, fechaFin, duracion, destino, titular || null, posicionTitular
            ]);

            if (destino === 'seleccionadas') {
                for (const pantallaId of idsPantallas) {
                    await db.execute(
                        'INSERT INTO carteles_pantallas (cartel_id, pantalla_id) VALUES (?, ?)',
                        [resultado.insertId, pantallaId]
                    );
                }
            }

            res.status(201).json({ mensaje: 'Cartel añadido correctamente.', id: resultado.insertId });
        } catch (err) {
            await fsp.unlink(req.file.path).catch(() => {});
            next(err);
        }
    });
});

// Editar duración, titular y destino de un cartel ya existente.
app.patch('/api/carteles/:id/configuracion', async (req, res, next) => {
    const id = Number(req.params.id);
    const duracion = Number(req.body.duracion_segundos);
    const destino = String(req.body.destino || '');
    const titular = String(req.body.titular || '').trim();
    const posicionTitular = String(req.body.posicion_titular || 'inferior');
    const fechaInicio = String(req.body.fecha_inicio || '');
    const fechaFin = String(req.body.fecha_fin || '');
    const idsPantallas = leerIdsPantallas(req.body.pantallas);

    if (!Number.isSafeInteger(id) || id < 1 || !Number.isInteger(duracion) ||
        duracion < 3 || duracion > 3600 || titular.length > 150 ||
        !['superior', 'inferior'].includes(posicionTitular) ||
        (fechaInicio && !fechaISOValida(fechaInicio)) || (fechaFin && !fechaISOValida(fechaFin)) || (fechaInicio && fechaFin && fechaFin < fechaInicio) ||
        !['todas', 'seleccionadas'].includes(destino) || idsPantallas === null ||
        (destino === 'seleccionadas' && idsPantallas.length === 0)) {
        return res.status(400).json({ error: 'Revisa la duración, el titular y la selección de pantallas.' });
    }

    try {
        const [existe] = await db.execute('SELECT id FROM carteles WHERE id = ?', [id]);
        if (!existe.length) return res.status(404).json({ error: 'No se ha encontrado el cartel.' });

        if (destino === 'seleccionadas' && !(await validarPantallas(idsPantallas))) {
            return res.status(400).json({ error: 'Una o varias pantallas seleccionadas no existen o están inactivas.' });
        }

        await db.execute(
            'UPDATE carteles SET duracion_segundos = ?, destino = ?, titular = ?, posicion_titular = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = ?',
            [duracion, destino, titular || null, posicionTitular, fechaInicio || null, fechaFin || null, id]
        );

        await db.execute('DELETE FROM carteles_pantallas WHERE cartel_id = ?', [id]);

        if (destino === 'seleccionadas') {
            for (const pantallaId of idsPantallas) {
                await db.execute(
                    'INSERT INTO carteles_pantallas (cartel_id, pantalla_id) VALUES (?, ?)',
                    [id, pantallaId]
                );
            }
        }

        res.json({ mensaje: 'Configuración del cartel actualizada.' });
    } catch (error) {
        next(error);
    }
});

app.patch('/api/carteles/:id/estado', async (req, res, next) => {
    const id = Number(req.params.id);
    const activo = req.body.activo;

    if (!Number.isSafeInteger(id) || id < 1 || typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'Los datos enviados no son válidos.' });
    }

    try {
        const [resultado] = await db.execute(`
            UPDATE carteles
            SET fecha_activacion = CASE
                    WHEN ? = 1 AND activo = 0 THEN NOW()
                    WHEN ? = 0 THEN NULL
                    ELSE fecha_activacion
                END,
                activo = ?
            WHERE id = ?
        `, [activo ? 1 : 0, activo ? 1 : 0, activo ? 1 : 0, id]);

        if (!resultado.affectedRows) {
            return res.status(404).json({ error: 'No se ha encontrado el cartel.' });
        }

        res.json({ mensaje: 'Estado actualizado correctamente.' });
    } catch (error) {
        next(error);
    }
});

app.delete('/api/carteles/:id', async (req, res, next) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Identificador no válido.' });
    }

    try {
        const [filas] = await db.execute('SELECT archivo FROM carteles WHERE id = ?', [id]);
        if (!filas.length) return res.status(404).json({ error: 'No se ha encontrado el cartel.' });

        await db.execute('DELETE FROM carteles WHERE id = ?', [id]);

        const archivo = path.basename(filas[0].archivo);
        await fsp.unlink(path.join(IMAGE_DIR, archivo)).catch(error => {
            if (error.code !== 'ENOENT') console.error('No se pudo borrar el archivo:', error.message);
        });

        res.json({ mensaje: 'Cartel eliminado correctamente.' });
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Se ha producido un error interno en el servidor.' });
});

// Tareas automáticas de cartelería.
let importacionEnCurso = false;

cron.schedule('*/30 * * * *', async () => {
    if (importacionEnCurso) return;
    importacionEnCurso = true;
    try {
        const resultado = await importarNoticiasWeb(db, IMAGE_DIR);
        console.log(`[Cartelería] Importación automática: ${resultado.importadas} nuevas, ${resultado.duplicadas} duplicadas, ${resultado.errores.length} errores.`);
        if (resultado.errores.length) console.error('[Cartelería] Errores de importación:', resultado.errores);
    } catch (error) {
        console.error('[Cartelería] Error en la importación automática:', error);
    } finally {
        importacionEnCurso = false;
    }
}, { timezone: 'Europe/Madrid' });

// La caducidad ya no desactiva registros: se calcula con fecha_inicio/fecha_fin
// y se aplica tanto en la API como en el reproductor local.

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cartelería Municipal disponible en http://localhost:${PORT}`);
});