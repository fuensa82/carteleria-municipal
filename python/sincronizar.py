
#!/usr/bin/env python3

import os
import json
import time
import hashlib
import logging
import urllib.request
import urllib.error
from pathlib import Path

# --------------------------------------------------
# CONFIGURACION
# --------------------------------------------------

API_URL = "http://192.168.1.33:3100/api/reproductor/AYTO-01/carteles"

BASE_DIR = Path("/home/vpalomo/carteleria")
IMAGENES_DIR = BASE_DIR / "imagenes"
JSON_FILE = BASE_DIR / "carteles.json"
JS_FILE = BASE_DIR / "carteles.js"

INTERVALO = 60  # Segundos entre sincronizaciones
TIMEOUT = 30

# --------------------------------------------------
# LOG
# --------------------------------------------------

logging.basicConfig(
    filename=BASE_DIR / "logs" / "sincronizacion.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# --------------------------------------------------
# FUNCIONES
# --------------------------------------------------

def obtener_json():
    req = urllib.request.Request(
        API_URL,
        headers={"User-Agent": "CarteleriaMunicipal/1.0"}
    )

    with urllib.request.urlopen(req, timeout=TIMEOUT) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def calcular_hash(ruta):
    sha256 = hashlib.sha256()

    with open(ruta, "rb") as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
            sha256.update(bloque)

    return sha256.hexdigest()


def descargar_imagen(cartel):
    nombre = Path(cartel["archivo"]).name
    destino = IMAGENES_DIR / nombre
    hash_esperado = cartel["hash_sha256"]

    if destino.exists():
        if calcular_hash(destino) == hash_esperado:
            return

    url = "http://192.168.1.33:3100" + cartel["url_imagen"]

    temporal = destino.with_suffix(destino.suffix + ".tmp")

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CarteleriaMunicipal/1.0"}
        )

        with urllib.request.urlopen(req, timeout=TIMEOUT) as respuesta:
            with open(temporal, "wb") as archivo:
                while True:
                    bloque = respuesta.read(1024 * 1024)
                    if not bloque:
                        break
                    archivo.write(bloque)

        if calcular_hash(temporal) != hash_esperado:
            raise ValueError(f"Hash incorrecto: {nombre}")

        os.replace(temporal, destino)
        logging.info("Imagen descargada: %s", nombre)

    finally:
        if temporal.exists():
            temporal.unlink()


def sincronizar():
    datos = obtener_json()

    carteles = datos.get("carteles")

    if not isinstance(carteles, list):
        raise ValueError("La API no ha devuelto una lista válida de carteles.")

    archivos_validos = set()
    carteles_locales = []

    for cartel in carteles:
        nombre = Path(cartel["archivo"]).name

        if not nombre or nombre != cartel["archivo"]:
            raise ValueError(f"Nombre de archivo no válido: {nombre}")

        descargar_imagen(cartel)
        archivos_validos.add(nombre)

        cartel_local = dict(cartel)
        cartel_local["archivo_local"] = f"imagenes/{nombre}"
        carteles_locales.append(cartel_local)

    # Guardar la programación solo cuando todas las imágenes
    # se hayan descargado y comprobado correctamente.
    temporal_json = JSON_FILE.with_suffix(".json.tmp")

    with open(temporal_json, "w", encoding="utf-8") as archivo:
        json.dump(
            {
                "pantalla": datos["pantalla"],
                "sincronizado_en": datos["sincronizado_en"],
                "total_carteles": len(carteles_locales),
                "carteles": carteles_locales
            },
            archivo,
            ensure_ascii=False,
            indent=2
        )

    os.replace(temporal_json, JSON_FILE)

        # Generar el archivo JavaScript para el reproductor local.
    temporal_js = JS_FILE.with_suffix(".js.tmp")

    with open(temporal_js, "w", encoding="utf-8") as archivo:
        archivo.write("window.CARTELERIA_DATOS = ")
        json.dump(
            {
                "pantalla": datos["pantalla"],
                "sincronizado_en": datos["sincronizado_en"],
                "total_carteles": len(carteles_locales),
                "carteles": carteles_locales
            },
            archivo,
            ensure_ascii=False
        )
        archivo.write(";")

    os.replace(temporal_js, JS_FILE)

    logging.info("Archivo carteles.js actualizado.")
    
    # Eliminar imágenes que ya no corresponden a la pantalla.
    for archivo in IMAGENES_DIR.iterdir():
        if archivo.is_file() and archivo.name not in archivos_validos:
            archivo.unlink()
            logging.info("Imagen eliminada: %s", archivo.name)

    logging.info(
        "Sincronización correcta. Carteles: %s",
        len(carteles_locales)
    )


# --------------------------------------------------
# BUCLE PRINCIPAL
# --------------------------------------------------

def main():
    logging.info("Servicio de sincronización iniciado.")

    while True:
        try:
            sincronizar()
        except Exception as error:
            logging.exception("Error de sincronización: %s", error)

        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
