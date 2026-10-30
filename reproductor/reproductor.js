
const DURACION_TRANSICION = 700;
const INTERVALO_ACTUALIZACION = 60000;

let carteles = [];
let indiceActual = 0;
let cartelActualId = null;

let elementoActual = document.getElementById('cartel-actual');
let elementoSiguiente = document.getElementById('cartel-siguiente');

const mensaje = document.getElementById('mensaje');

let temporizadorCartel = null;
let temporizadorActualizacion = null;
let transicionEnCurso = false;
let actualizacionPendiente = null;


// --------------------------------------------------
// IDENTIFICAR CARTELES
// --------------------------------------------------

function obtenerClave(cartel) {
    return String(cartel.id ?? cartel.archivo);
}


// --------------------------------------------------
// PREPARAR Y MOSTRAR CARTELES
// --------------------------------------------------

function prepararCartel(elemento, cartel) {
    const imagen = elemento.querySelector('.imagen');
    const titular = elemento.querySelector('.titular');

    imagen.src = cartel.archivo_local;

    titular.textContent = cartel.titular || '';
    titular.className = 'titular';

    if (cartel.titular) {
        titular.classList.add(
            cartel.posicion_titular === 'superior'
                ? 'superior'
                : 'inferior'
        );

        titular.style.display = 'block';
    } else {
        titular.style.display = 'none';
    }
}

function programarSiguiente() {
    clearTimeout(temporizadorCartel);

    if (!carteles.length) {
        temporizadorCartel = setTimeout(mostrarSiguiente, 1000);
        return;
    }

    const cartel = carteles.find(
        c => obtenerClave(c) === cartelActualId
    );

    const duracion = Number(cartel?.duracion_segundos) || 15;

    temporizadorCartel = setTimeout(
        mostrarSiguiente,
        duracion * 1000
    );
}

function mostrarPrimerCartel() {
    if (!carteles.length) {
        mensaje.textContent = 'No hay carteles disponibles.';
        return;
    }

    mensaje.classList.add('oculto');

    indiceActual = 0;
    cartelActualId = obtenerClave(carteles[0]);

    prepararCartel(elementoActual, carteles[0]);
    elementoActual.classList.add('activo');

    programarSiguiente();
}

function mostrarSiguiente() {
    if (transicionEnCurso) return;

    if (!carteles.length) {
        elementoActual.classList.remove('activo');
        mensaje.textContent = 'No hay carteles disponibles.';
        mensaje.classList.remove('oculto');
        return;
    }

    transicionEnCurso = true;

    // Buscar el cartel actual en la programación más reciente.
    const indiceEncontrado = carteles.findIndex(
        c => obtenerClave(c) === cartelActualId
    );

    indiceActual = indiceEncontrado;

    // Si el cartel actual ya no existe, empezar por el primero.
    const siguienteIndice = indiceActual < 0
        ? 0
        : (indiceActual + 1) % carteles.length;

    const siguienteCartel = carteles[siguienteIndice];

    prepararCartel(elementoSiguiente, siguienteCartel);

    elementoSiguiente.classList.remove('activo', 'entrando');
    elementoSiguiente.style.transform = 'translateX(100%)';

    // Forzar el cálculo de estilos antes de iniciar la animación.
    elementoSiguiente.offsetWidth;

    elementoSiguiente.classList.add('entrando');
    elementoActual.classList.add('saliendo');

    setTimeout(() => {
        elementoActual.classList.remove('activo', 'saliendo');
        elementoActual.style.transform = 'translateX(100%)';

        const temporal = elementoActual;
        elementoActual = elementoSiguiente;
        elementoSiguiente = temporal;

        elementoActual.classList.add('activo');
        elementoActual.classList.remove('entrando');
        elementoActual.style.transform = 'translateX(0)';

        cartelActualId = obtenerClave(siguienteCartel);

        transicionEnCurso = false;

        // Aplicar los cambios que hayan llegado durante la transición.
        if (actualizacionPendiente) {
            const datos = actualizacionPendiente;
            actualizacionPendiente = null;
            aplicarProgramacion(datos);
        }

        programarSiguiente();

    }, DURACION_TRANSICION);
}


// --------------------------------------------------
// ACTUALIZAR PROGRAMACIÓN
// --------------------------------------------------

function aplicarProgramacion(datos) {
    if (!datos || !Array.isArray(datos.carteles)) {
        return;
    }

    carteles = datos.carteles;

    console.log(
        'Programación actualizada:',
        datos.pantalla?.codigo,
        'Carteles:',
        carteles.length
    );

    // Si no hay carteles, se dejará terminar el actual.
    if (!carteles.length) {
        return;
    }

    // Mantener el cartel que ya está en pantalla si sigue existiendo.
    const nuevoIndice = carteles.findIndex(
        c => obtenerClave(c) === cartelActualId
    );

    if (nuevoIndice >= 0) {
        indiceActual = nuevoIndice;

        // Actualizar también el titular o imagen si han cambiado.
        prepararCartel(elementoActual, carteles[nuevoIndice]);
    } else {
        // El cartel actual ha sido eliminado.
        // Se mantendrá visible hasta la siguiente transición.
        indiceActual = -1;
    }
}

function recargarProgramacion() {
    const script = document.createElement('script');

    // Evitar que Chromium utilice una versión almacenada en caché.
    script.src = './carteles.js?t=' + Date.now();

    script.onload = () => {
        const datos = window.CARTELERIA_DATOS;

        if (!datos || !Array.isArray(datos.carteles)) {
            console.error('La programación recibida no es válida.');
            return;
        }

        if (transicionEnCurso) {
            actualizacionPendiente = datos;
        } else {
            aplicarProgramacion(datos);
        }
    };

    script.onerror = () => {
        console.error('No se ha podido actualizar carteles.js');
    };

    document.body.appendChild(script);
}


// --------------------------------------------------
// INICIO
// --------------------------------------------------

function iniciarReproductor() {
    const datos = window.CARTELERIA_DATOS;

    if (!datos || !Array.isArray(datos.carteles)) {
        mensaje.textContent = 'No se ha podido cargar la programación.';
        console.error('No se encuentra window.CARTELERIA_DATOS');
        return;
    }

    carteles = datos.carteles;

    console.log(
        'Cartelería iniciada:',
        datos.pantalla.codigo,
        'Carteles:',
        carteles.length
    );

    mostrarPrimerCartel();

    // Comprobar si hay cambios cada 60 segundos.
    temporizadorActualizacion = setInterval(
        recargarProgramacion,
        INTERVALO_ACTUALIZACION
    );
}

iniciarReproductor();
