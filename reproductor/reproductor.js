
const DURACION_TRANSICION = 700;
const INTERVALO_ACTUALIZACION = 60000;

let carteles = [];
let cartelesProgramados = [];
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

function fechaLocalISO() {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

function filtrarCartelesPorFecha(lista) {
    const hoy = fechaLocalISO();
    return lista.filter(cartel => {
        if (Number(cartel.activo ?? 1) !== 1) return false;
        const inicio = cartel.fecha_inicio ? String(cartel.fecha_inicio).slice(0, 10) : null;
        const fin = cartel.fecha_fin ? String(cartel.fecha_fin).slice(0, 10) : null;
        return (!inicio || inicio <= hoy) && (!fin || fin >= hoy);
    });
}

function actualizarCartelesPorFecha() {
    const anterior = carteles;
    const filtrados = filtrarCartelesPorFecha(cartelesProgramados);
    const cambio = filtrados.map(obtenerClave).join('|') !== anterior.map(obtenerClave).join('|');
    carteles = filtrados;

    if (!carteles.length) {
        clearTimeout(temporizadorCartel);
        elementoActual.classList.remove('activo', 'saliendo');
        elementoSiguiente.classList.remove('activo', 'entrando');
        cartelActualId = null;
        mensaje.textContent = 'No hay carteles disponibles en este momento.';
        mensaje.classList.remove('oculto');
        return;
    }

    if (cambio && !carteles.some(c => obtenerClave(c) === cartelActualId)) {
        if (!transicionEnCurso) mostrarPrimerCartel();
    }
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
    // Si solo hay un cartel, mantenerlo fijo sin hacer transiciones.
    if (carteles.length === 1) {
        const unico = carteles[0];

        if (cartelActualId !== obtenerClave(unico)) {
            prepararCartel(elementoActual, unico);
            cartelActualId = obtenerClave(unico);
            elementoActual.classList.add('activo');
        }

        programarSiguiente();
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

    cartelesProgramados = datos.carteles;
    carteles = filtrarCartelesPorFecha(cartelesProgramados);

    console.log(
        'Programación actualizada:',
        datos.pantalla?.codigo,
        'Carteles:',
        carteles.length
    );

    // Si todos están pendientes o caducados, no se deja una imagen antigua en pantalla.
    if (!carteles.length) {
        actualizarCartelesPorFecha();
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
        // El cartel actual ya no está vigente o ha sido retirado: sustituirlo ahora.
        indiceActual = -1;
        if (!transicionEnCurso) mostrarPrimerCartel();
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

    cartelesProgramados = datos.carteles;
    carteles = filtrarCartelesPorFecha(cartelesProgramados);

    console.log(
        'Cartelería iniciada:',
        datos.pantalla.codigo,
        'Carteles:',
        carteles.length
    );

    mostrarPrimerCartel();

    // Comprobar si hay cambios cada 60 segundos.
    temporizadorActualizacion = setInterval(() => {
        actualizarCartelesPorFecha();
        recargarProgramacion();
    }, INTERVALO_ACTUALIZACION);
}

iniciarReproductor();
