const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const URL_PORTADA = 'https://www.fuensalida.com/';
const HOSTS_PERMITIDOS = new Set(['www.fuensalida.com', 'fuensalida.com']);
const MAX_IMAGEN_BYTES = 15 * 1024 * 1024;
const DURACION_PREDETERMINADA = 15;

function urlAbsoluta(valor, base) {
    if (!valor) return null;
    try {
        const url = new URL(String(valor).trim(), base);
        url.hash = '';
        if (url.protocol !== 'https:' || !HOSTS_PERMITIDOS.has(url.hostname)) return null;
        return url;
    } catch {
        return null;
    }
}

function urlArticuloCanonica(valor) {
    const url = new URL(valor);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
}

function extensionPorMime(mime) {
    const limpio = String(mime || '').split(';')[0].trim().toLowerCase();
    return ({
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif'
    })[limpio] || null;
}

async function fetchConTiempo(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        signal: AbortSignal.timeout(20000),
        headers: {
            'User-Agent': 'CarteleriaMunicipal/1.0 (Ayuntamiento de Fuensalida)',
            ...(opciones.headers || {})
        }
    });
    if (!respuesta.ok) throw new Error(`Respuesta HTTP ${respuesta.status} al consultar ${url}`);
    return respuesta;
}

function extraerNoticias($) {
    const noticias = [];

    $('.slide-destacados-home').each((_, bloque) => {
        $(bloque).find('li').each((_, elemento) => {
            const item = $(elemento);
            const enlace = item.find('h2 a').first();
            const imagen = item.find('img').first();
            noticias.push({
                titulo: enlace.text().trim(),
                url: enlace.attr('href'),
                imagen: imagen.attr('src'),
                seccion: 'Destacados'
            });
        });
    });

    $('.sppb-addon-articles.noticias').each((_, bloque) => {
        $(bloque).find('.sppb-addon-article').each((_, elemento) => {
            const item = $(elemento);
            const enlace = item.find('h3 a').first();
            const imagen = item.find('img').first();
            noticias.push({
                titulo: enlace.text().trim(),
                url: enlace.attr('href'),
                imagen: imagen.attr('data-large') || imagen.attr('src'),
                seccion: 'Noticias'
            });
        });
    });

    return noticias.filter(n => n.titulo && n.url && n.imagen);
}

async function descargarImagen(urlImagen, directorioImagenes) {
    const respuesta = await fetchConTiempo(urlImagen);
    const mime = String(respuesta.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const extension = extensionPorMime(mime);
    if (!extension) throw new Error(`Formato de imagen no admitido (${mime || 'desconocido'}).`);

    const longitud = Number(respuesta.headers.get('content-length') || 0);
    if (longitud > MAX_IMAGEN_BYTES) throw new Error('La imagen supera los 15 MB.');

    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGEN_BYTES) throw new Error('La imagen está vacía o supera los 15 MB.');

    // Comprobación básica de firma para no guardar una respuesta HTML como imagen.
    const firmaValida =
        (mime === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8) ||
        (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
        (mime === 'image/gif' && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) ||
        (mime === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP');

    if (!firmaValida) throw new Error('El contenido descargado no parece ser una imagen válida.');

    const archivo = `${crypto.randomUUID()}${extension}`;
    await fs.mkdir(directorioImagenes, { recursive: true });
    await fs.writeFile(path.join(directorioImagenes, archivo), buffer, { flag: 'wx' });

    return {
        archivo,
        mime,
        hash: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

async function importarNoticiasWeb(db, directorioImagenes) {
    const respuesta = await fetchConTiempo(URL_PORTADA);
    const html = await respuesta.text();
    const $ = cheerio.load(html);
    const detectadas = extraerNoticias($);

    const resultado = {
        detectadas: detectadas.length,
        importadas: 0,
        duplicadas: 0,
        errores: []
    };

    for (const noticia of detectadas) {
        let archivoLocal = null;

        try {
            const urlArticulo = urlAbsoluta(noticia.url, URL_PORTADA);
            const urlImagen = urlAbsoluta(noticia.imagen, URL_PORTADA);
            if (!urlArticulo || !urlImagen) {
                throw new Error('La dirección del artículo o de la imagen no pertenece a la web municipal.');
            }

            const urlCanonica = urlArticuloCanonica(urlArticulo.toString());
            const hashUrl = crypto.createHash('sha256').update(urlCanonica).digest('hex');

            const [existentes] = await db.execute(
                'SELECT id FROM carteles WHERE hash_url_origen = ? LIMIT 1',
                [hashUrl]
            );

            if (existentes.length) {
                resultado.duplicadas++;
                continue;
            }

            const imagenLocal = await descargarImagen(urlImagen.toString(), directorioImagenes);
            archivoLocal = imagenLocal.archivo;

            const nombre = noticia.titulo.slice(0, 150);
            const titular = noticia.titulo.slice(0, 150);

            const [insertado] = await db.execute(`
                INSERT INTO carteles
                    (nombre, archivo, tipo_mime, hash_sha256, activo,
                     duracion_segundos, destino, titular, posicion_titular,
                     origen, url_origen, hash_url_origen, fecha_activacion, fecha_inicio, fecha_fin)
                VALUES (?, ?, ?, ?, 1, ?, 'todas', ?, 'inferior', 'web', ?, ?, NOW(), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY))
            `, [
                nombre,
                imagenLocal.archivo,
                imagenLocal.mime,
                imagenLocal.hash,
                DURACION_PREDETERMINADA,
                titular,
                urlCanonica,
                hashUrl
            ]);

            archivoLocal = null; // El archivo ya pertenece al cartel guardado.
            resultado.importadas++;
        } catch (error) {
            if (archivoLocal) {
                await fs.unlink(path.join(directorioImagenes, archivoLocal)).catch(() => {});
            }
            resultado.errores.push({
                titulo: noticia.titulo || '(sin título)',
                mensaje: error.message
            });
        }
    }

    return resultado;
}

module.exports = { importarNoticiasWeb };
