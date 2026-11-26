'use strict';

function leerUInt24LE(buffer, offset) {
    return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function dimensionesImagen(buffer, mime = '') {
    if (!Buffer.isBuffer(buffer) || buffer.length < 10) return { ancho_px: null, alto_px: null };
    let ancho = null;
    let alto = null;
    const tipo = String(mime).split(';')[0].trim().toLowerCase();

    if (tipo === 'image/png' && buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        ancho = buffer.readUInt32BE(16);
        alto = buffer.readUInt32BE(20);
    } else if (tipo === 'image/gif' && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) {
        ancho = buffer.readUInt16LE(6);
        alto = buffer.readUInt16LE(8);
    } else if (tipo === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8) {
        const marcadoresSOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
        let offset = 2;
        while (offset + 4 < buffer.length) {
            if (buffer[offset] !== 0xff) { offset++; continue; }
            while (offset < buffer.length && buffer[offset] === 0xff) offset++;
            const marcador = buffer[offset++];
            if (marcador === 0xd9 || marcador === 0xda) break;
            if (marcador >= 0xd0 && marcador <= 0xd7) continue;
            if (offset + 2 > buffer.length) break;
            const longitud = buffer.readUInt16BE(offset);
            if (longitud < 2 || offset + longitud > buffer.length) break;
            if (marcadoresSOF.has(marcador) && longitud >= 7) {
                alto = buffer.readUInt16BE(offset + 3);
                ancho = buffer.readUInt16BE(offset + 5);
                break;
            }
            offset += longitud;
        }
    } else if (tipo === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
        const formato = buffer.subarray(12, 16).toString();
        if (formato === 'VP8X' && buffer.length >= 30) {
            ancho = 1 + leerUInt24LE(buffer, 24);
            alto = 1 + leerUInt24LE(buffer, 27);
        } else if (formato === 'VP8 ' && buffer.length >= 30) {
            for (let i = 20; i + 9 < buffer.length; i++) {
                if (buffer[i] === 0x9d && buffer[i + 1] === 0x01 && buffer[i + 2] === 0x2a) {
                    ancho = buffer.readUInt16LE(i + 3) & 0x3fff;
                    alto = buffer.readUInt16LE(i + 5) & 0x3fff;
                    break;
                }
            }
        } else if (formato === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
            const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
            ancho = 1 + b1 + ((b2 & 0x3f) << 8);
            alto = 1 + ((b2 >> 6) & 0x03) + (b3 << 2) + ((b4 & 0x0f) << 10);
        }
    }

    if (!Number.isSafeInteger(ancho) || !Number.isSafeInteger(alto) || ancho <= 0 || alto <= 0) {
        return { ancho_px: null, alto_px: null };
    }
    return { ancho_px: ancho, alto_px: alto };
}

function metadatosImagen(buffer, mime = '') {
    const dimensiones = dimensionesImagen(buffer, mime);
    return { tamano_bytes: buffer.length, ...dimensiones };
}

module.exports = { dimensionesImagen, metadatosImagen };
