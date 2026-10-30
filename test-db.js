const db = require('./db');

async function comprobarConexion() {
    try {
        const [rows] = await db.query(
            'SELECT DATABASE() AS baseDatos, VERSION() AS version'
        );

        console.log('Conexión correcta:', rows[0]);
    } catch (error) {
        console.error('Error de conexión:', error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

comprobarConexion();