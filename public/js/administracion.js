const formulario = document.getElementById('formularioCartel');
const panelSubida = document.getElementById('panelSubida');
const modalCartel = document.getElementById('modalCartel');
const listaCarteles = document.getElementById('listaCarteles');
const contador = document.getElementById('contador');
const mensaje = document.getElementById('mensaje');
const botonGuardar = document.getElementById('guardarCartel');
const campoNombre = document.getElementById('nombre');
const campoImagen = document.getElementById('imagen');
const fechaInicioNueva = document.getElementById('fechaInicioNueva');
const fechaFinNueva = document.getElementById('fechaFinNueva');
const busqueda = document.getElementById('busqueda');
const filtroEstado = document.getElementById('filtroEstado');
const vistaPrevia = document.getElementById('vistaPreviaNueva');
const imagenNueva = document.getElementById('imagenNueva');
const titularNuevo = document.getElementById('titularNuevo');
const contadorTitularNuevo = document.getElementById('contadorTitularNuevo');
const posicionTitularNueva = document.getElementById('posicionTitularNueva');
const marcoVistaPreviaNueva = document.getElementById('marcoVistaPreviaNueva');
const bandaTitularNueva = document.getElementById('bandaTitularNueva');
const pantallasNuevas = document.getElementById('pantallasNuevas');
const formularioPantalla = document.getElementById('formularioPantalla');
const listaPantallas = document.getElementById('listaPantallas');
let carteles = [];
let pantallas = [];
let temporizadorMensaje;

function escapar(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function mostrarMensaje(texto, tipo = 'exito') {
    clearTimeout(temporizadorMensaje);
    mensaje.textContent = texto;
    mensaje.className = `mensaje ${tipo}`;
    temporizadorMensaje = setTimeout(() => mensaje.classList.add('oculto'), 5000);
    mensaje.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function peticion(url, opciones = {}) {
    const respuesta = await fetch(url, opciones);
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'No se ha podido completar la operación.');
    return datos;
}
function formatearFecha(fecha) {
    if (!fecha) return 'Fecha desconocida';
    const d = new Date(String(fecha).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? String(fecha) : d.toLocaleDateString('es-ES');
}
function fechaLocalISO(fecha = new Date()) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}
function sumarUnMes(fecha = new Date()) {
    const resultado = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const ultimoDiaDestino = new Date(resultado.getFullYear(), resultado.getMonth() + 2, 0).getDate();
    resultado.setMonth(resultado.getMonth() + 1);
    resultado.setDate(Math.min(fecha.getDate(), ultimoDiaDestino));
    return fechaLocalISO(resultado);
}
function obtenerEstadoCartel(cartel) {
    if (Number(cartel.activo) !== 1) return { valor: 'desactivado', texto: 'Desactivado', clase: 'inactivo' };
    const hoy = fechaLocalISO();
    if (cartel.fecha_fin && String(cartel.fecha_fin).slice(0, 10) < hoy) return { valor: 'caducado', texto: 'Caducado', clase: 'caducado' };
    if (cartel.fecha_inicio && String(cartel.fecha_inicio).slice(0, 10) > hoy) return { valor: 'espera', texto: 'En espera', clase: 'espera' };
    return { valor: 'activo', texto: 'Activo', clase: 'activo' };
}
function formatearFechaCorta(fecha) {
    if (!fecha) return 'Sin límite';
    const partes = String(fecha).slice(0, 10).split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(fecha);
}
function formatearTamano(bytes) {
    const valor = Number(bytes);
    if (!Number.isFinite(valor) || valor <= 0) return 'Pendiente';
    if (valor < 1024 * 1024) return `${(valor / 1024).toLocaleString('es-ES', { maximumFractionDigits: 0 })} KB`;
    return `${(valor / (1024 * 1024)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

function htmlCheckboxesPantallas(seleccionadas = [], prefijo = 'pantalla') {
    const ids = seleccionadas.map(Number);
    const activas = pantallas.filter(p => Number(p.activa) === 1);
    if (!activas.length) return '<p class="texto-secundario">Todavía no hay pantallas activas registradas.</p>';
    return activas.map(p => `<label class="opcion"><input type="checkbox" name="${prefijo}" value="${Number(p.id)}" ${ids.includes(Number(p.id)) ? 'checked' : ''}> ${escapar(p.nombre)}${p.ubicacion ? ` <span class="texto-secundario">(${escapar(p.ubicacion)})</span>` : ''}</label>`).join('');
}
function actualizarOpcionesNuevas() {
    const destino = formulario.querySelector('input[name="destino"]:checked')?.value || 'todas';
    pantallasNuevas.innerHTML = htmlCheckboxesPantallas([], 'pantallaNueva');
    pantallasNuevas.classList.toggle('oculto', destino !== 'seleccionadas');
    const radio = document.getElementById('destinoSeleccionadas');
    radio.disabled = !pantallas.some(p => Number(p.activa) === 1);
    if (radio.disabled && radio.checked) formulario.querySelector('input[name="destino"][value="todas"]').checked = true;
    pantallasNuevas.classList.toggle('oculto', formulario.querySelector('input[name="destino"]:checked')?.value !== 'seleccionadas');
}
function renderizarLista() {
    const texto = busqueda.value.trim().toLocaleLowerCase('es');
    const estado = filtroEstado.value;
    const filtrados = carteles.filter(c => {
        const coincideTexto = c.nombre.toLocaleLowerCase('es').includes(texto) || c.archivo.toLocaleLowerCase('es').includes(texto);
        const estadoCalculado = obtenerEstadoCartel(c);
        const coincideEstado = estado === 'todos' || estadoCalculado.valor === estado;
        return coincideTexto && coincideEstado;
    });
    contador.textContent = `${filtrados.length} de ${carteles.length} cartel(es)`;
    if (!filtrados.length) {
        listaCarteles.innerHTML = `<div class="estado-vacio">${carteles.length === 0 ? 'Todavía no hay carteles. Pulsa «Añadir cartel» para subir el primero.' : 'No hay carteles que coincidan con la búsqueda.'}</div>`;
        return;
    }
    listaCarteles.innerHTML = filtrados.map(c => {
        const activo = Number(c.activo) === 1;
        const estadoCalculado = obtenerEstadoCartel(c);
        const destinoTexto = c.destino === 'todas' ? 'Todas las pantallas' : (c.pantallas?.length ? c.pantallas.map(p => p.nombre).join(', ') : 'Sin pantallas asignadas');
        const tamanoBytes = Number(c.tamano_bytes) || 0;
        const anchoImagen = Number(c.ancho_px) || 0;
        const altoImagen = Number(c.alto_px) || 0;
        const imagenPesada = tamanoBytes > 2 * 1024 * 1024
            || anchoImagen > 2048
            || altoImagen > 1366;
        const dimensiones = Number(c.ancho_px) > 0 && Number(c.alto_px) > 0
            ? `${Number(c.ancho_px)} × ${Number(c.alto_px)} px`
            : 'Pendiente';
        const pesoTexto = tamanoBytes > 0 ? formatearTamano(tamanoBytes) : 'Pendiente';
        return `<article class="fila-cartel" data-id="${Number(c.id)}">
            <button type="button" class="miniatura miniatura-preview" aria-label="Abrir imagen completa: ${escapar(c.nombre)}" title="Ver imagen completa" data-preview-src="/media/imagenes/${encodeURIComponent(c.archivo)}"><img src="/media/imagenes/${encodeURIComponent(c.archivo)}" alt="${escapar(c.nombre)}" loading="lazy"></button>
            <div class="info-cartel"><div class="nombre-cartel">${escapar(c.nombre)}</div><div class="archivo-cartel">${escapar(c.archivo)}</div><div class="resumen-cartel"><span>${c.origen === 'web' ? 'Web municipal' : 'Manual'}</span><span>Alta: ${escapar(formatearFecha(c.fecha_alta))}</span><span>Publicación: ${escapar(formatearFechaCorta(c.fecha_inicio))} – ${escapar(formatearFechaCorta(c.fecha_fin))}</span></div><div class="detalle-configuracion"><strong>Duración:</strong> ${Number(c.duracion_segundos) || 15} s <span class="separador-detalle">·</span> <strong>Destino:</strong> ${escapar(destinoTexto)}</div></div>
            <div class="dato-tecnico peso-cartel"><strong>${pesoTexto}</strong>${imagenPesada ? '<span class="aviso-imagen-pesada">Pesada</span>' : ''}</div>
            <div class="dato-tecnico dimensiones-cartel">${escapar(dimensiones)}</div>
            <div class="estado-columna"><span class="estado ${estadoCalculado.clase}">${estadoCalculado.texto}</span></div>
            <div class="acciones-cartel">${imagenPesada && ['image/jpeg','image/png','image/webp'].includes(c.tipo_mime) ? `<button type="button" class="boton-icono optimizar" title="Reducir tamaño de imagen" aria-label="Reducir tamaño de imagen" data-accion="optimizar" data-id="${Number(c.id)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
<g fill="none" stroke="#278052" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<!-- Las cuatro flechas apuntan hacia el centro -->
<path d="M3.5 3.5 9 9 M5.5 9H9V5.5"/>
<path d="M20.5 3.5 15 9 M18.5 9H15V5.5"/>
<path d="M3.5 20.5 9 15 M5.5 15H9V18.5"/>
<path d="M20.5 20.5 15 15 M18.5 15H15V18.5"/>
</g>
</svg></button>` : ''}<button type="button" class="boton-icono" title="Configurar" aria-label="Configurar cartel" data-accion="configurar" data-id="${Number(c.id)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z"/></svg></button><button type="button" class="boton-icono" title="${activo ? 'Desactivar' : 'Activar'}" aria-label="${activo ? 'Desactivar' : 'Activar'} cartel" data-accion="estado" data-id="${Number(c.id)}" data-activo="${activo ? '0' : '1'}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${activo ? '<path d="M12 3v9"/><path d="M6.2 6.2a8 8 0 1 0 11.6 0"/>' : '<path d="m8 5 11 7-11 7V5Z"/>'}</svg></button><button type="button" class="boton-icono eliminar" title="Eliminar" aria-label="Eliminar cartel" data-accion="eliminar" data-id="${Number(c.id)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></div>
            <form class="configuracion-cartel oculto" data-config-id="${Number(c.id)}">
                <h4>Configuración de «${escapar(c.nombre)}»</h4>
                <div class="campo campo-corto"><label>Duración en pantalla (segundos)</label><input name="duracion_segundos" type="number" min="3" max="3600" value="${Number(c.duracion_segundos) || 15}" required></div>
                <fieldset class="campo campo-fechas"><legend>Programación del cartel</legend>
                    <div class="campo-fecha"><label>Fecha de inicio</label><input name="fecha_inicio" type="date" value="${escapar(c.fecha_inicio || '')}"><small>Vacía: publicación inmediata.</small></div>
                    <div class="campo-fecha"><label>Fecha de finalización</label><input name="fecha_fin" type="date" value="${escapar(c.fecha_fin || '')}"><small>Vacía: sin caducidad.</small></div>
                </fieldset>
                <div class="campo campo-titular">
                    <label>Titular (opcional)</label>
                    <textarea name="titular" maxlength="150" rows="2" placeholder="Texto que aparecerá sobre la imagen">${escapar(c.titular || '')}</textarea>
                    <small><span class="contador-titular-config">${(c.titular || '').length}</span>/150 caracteres</small>
                    <label>Posición del titular</label>
                    <select name="posicion_titular">
                        <option value="inferior" ${(c.posicion_titular || 'inferior') === 'inferior' ? 'selected' : ''}>Inferior</option>
                        <option value="superior" ${c.posicion_titular === 'superior' ? 'selected' : ''}>Superior</option>
                    </select>
                    <div class="marco-vista-previa vista-previa-config" data-posicion="${c.posicion_titular || 'inferior'}">
                        <img src="/media/imagenes/${encodeURIComponent(c.archivo)}" alt="Vista previa del cartel">
                        <div class="banda-titular-previa ${(c.titular || '').trim() ? '' : 'oculto'}">${escapar(c.titular || '')}</div>
                    </div>
                </div>
                <fieldset class="campo campo-destino"><legend>Destino</legend><label class="opcion"><input type="radio" name="destino" value="todas" ${c.destino === 'todas' ? 'checked' : ''}> Todas las pantallas</label><label class="opcion"><input type="radio" name="destino" value="seleccionadas" ${c.destino === 'seleccionadas' ? 'checked' : ''} ${pantallas.some(p => Number(p.activa) === 1) ? '' : 'disabled'}> Solo las pantallas seleccionadas</label><div class="seleccion-pantallas">${htmlCheckboxesPantallas((c.pantallas || []).map(p => p.id), `pantalla-${Number(c.id)}`)}</div></fieldset>
                <div class="acciones-formulario"><button class="boton boton-principal" type="submit">Guardar configuración</button><button class="boton boton-secundario" type="button" data-accion="cancelar-config">Cancelar</button></div>
            </form>
        </article>`;
    }).join('');
}
async function cargarCarteles() {
    listaCarteles.innerHTML = '<div class="estado-vacio">Cargando carteles...</div>';
    try { carteles = await peticion('/api/carteles'); renderizarLista(); }
    catch (e) { listaCarteles.innerHTML = `<div class="estado-vacio">No se ha podido cargar la lista. ${escapar(e.message)}</div>`; contador.textContent = 'Error al cargar'; }
}
async function cargarPantallas() {
    try {
        pantallas = await peticion('/api/pantallas');
        renderizarPantallas();
        actualizarOpcionesNuevas();
    } catch (e) { listaPantallas.innerHTML = `<div class="estado-vacio">No se han podido cargar las pantallas. ${escapar(e.message)}</div>`; }
}
function formatearFechaHora(fecha) {
    if (!fecha) return 'Nunca ha sincronizado';

    const valor = new Date(String(fecha).replace(' ', 'T'));

    if (Number.isNaN(valor.getTime())) return 'Fecha desconocida';

    return valor.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'medium'
    });
}

function obtenerEstadoConexion(pantalla) {
    if (Number(pantalla.activa) !== 1) {
        return { texto: 'Inactiva', clase: 'inactivo' };
    }

    if (!pantalla.ultima_sincronizacion) {
        return { texto: 'Nunca conectada', clase: 'desconectada' };
    }

    const fecha = new Date(
        String(pantalla.ultima_sincronizacion).replace(' ', 'T')
    );

    if (Number.isNaN(fecha.getTime())) {
        return { texto: 'Estado desconocido', clase: 'desconectada' };
    }

    const segundos = (Date.now() - fecha.getTime()) / 1000;

    return segundos <= 180
        ? { texto: 'Conectada', clase: 'conectada' }
        : { texto: 'Sin conexión', clase: 'desconectada' };
}

function renderizarPantallas() {
    if (!pantallas.length) {
        listaPantallas.innerHTML =
            '<div class="estado-vacio">Todavía no hay pantallas registradas.</div>';
        return;
    }

    listaPantallas.innerHTML = pantallas.map(p => {
        const estado = obtenerEstadoConexion(p);

        return `<article class="fila-pantalla">
            <div class="datos-pantalla">
                <strong>${escapar(p.nombre)}</strong>
                <div class="texto-secundario">
                    Código: ${escapar(p.codigo)}${p.ubicacion ? ` · ${escapar(p.ubicacion)}` : ''}
                </div>
                <div class="detalle-pantalla">
                    <span><strong>IP actual:</strong> ${estado.texto === 'Conectada' ? (p.ip_actual ? escapar(p.ip_actual) : 'No disponible') : 'Sin conexión'}</span>
                    <span><strong>Última sincronización:</strong> ${escapar(formatearFechaHora(p.ultima_sincronizacion))}</span>
                    <span><strong>Carteles asignados:</strong> ${Number(p.total_carteles) || 0}</span>
                </div>
            </div>

            <span class="estado estado-conexion ${estado.clase}">
                ${estado.texto}
            </span>

            <div class="acciones-pantalla">
                <button class="boton-pequeno" type="button"
                    data-accion-pantalla="editar"
                    data-id="${Number(p.id)}">Editar</button>

                <button class="boton-pequeno" type="button"
                    data-accion-pantalla="estado"
                    data-id="${Number(p.id)}"
                    data-activa="${Number(p.activa) === 1 ? '0' : '1'}">
                    ${Number(p.activa) === 1 ? 'Desactivar' : 'Activar'}
                </button>
            </div>
        </article>`;
    }).join('');
}
function actualizarVistaPreviaTitularNueva() {
    if (!titularNuevo) return;
    const texto = titularNuevo.value.trim();
    contadorTitularNuevo.textContent = String(titularNuevo.value.length);
    bandaTitularNueva.textContent = texto;
    bandaTitularNueva.classList.toggle('oculto', !texto);
    marcoVistaPreviaNueva.dataset.posicion = posicionTitularNueva.value;
    if (campoImagen.files.length) vistaPrevia.classList.remove('oculto');
}

function actualizarVistaPreviaTitularConfiguracion(form) {
    const titular = form.querySelector('textarea[name="titular"]');
    const contador = form.querySelector('.contador-titular-config');
    const posicion = form.querySelector('select[name="posicion_titular"]');
    const marco = form.querySelector('.vista-previa-config');
    const banda = marco?.querySelector('.banda-titular-previa');
    if (!titular || !marco || !banda) return;
    if (contador) contador.textContent = String(titular.value.length);
    banda.textContent = titular.value.trim();
    banda.classList.toggle('oculto', !titular.value.trim());
    marco.dataset.posicion = posicion?.value || 'inferior';
}

function abrirFormulario() {
    formulario.reset();
    const hoy = new Date();
    fechaInicioNueva.value = fechaLocalISO(hoy);
    fechaFinNueva.value = sumarUnMes(hoy);
    fechaFinNueva.min = fechaInicioNueva.value;
    modalCartel.classList.remove('oculto');
    modalCartel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-abierto');
    actualizarOpcionesNuevas();
    window.setTimeout(() => campoNombre.focus(), 50);
}
function cerrarFormulario() {
    formulario.reset();
    fechaFinNueva.min = '';
    modalCartel.classList.add('oculto');
    modalCartel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-abierto');
    vistaPrevia.classList.add('oculto');
    imagenNueva.removeAttribute('src');
    actualizarVistaPreviaTitularNueva();
    actualizarOpcionesNuevas();
}
let modalConfiguracion = null;
let formularioConfiguracionActivo = null;
let marcadorFormularioConfiguracion = null;

function crearModalConfiguracion() {
    if (modalConfiguracion) return;
    modalConfiguracion = document.createElement('div');
    modalConfiguracion.id = 'modalConfiguracionCartel';
    modalConfiguracion.className = 'modal-cartel oculto';
    modalConfiguracion.setAttribute('aria-hidden', 'true');
    modalConfiguracion.innerHTML = `
        <div class="modal-cartel-fondo" data-cerrar-configuracion></div>
        <section class="modal-cartel-contenido modal-configuracion-contenido" role="dialog" aria-modal="true" aria-labelledby="tituloModalConfiguracion">
            <button type="button" class="modal-cartel-cerrar" id="cerrarModalConfiguracion" aria-label="Cerrar ventana">&times;</button>
            <h3 id="tituloModalConfiguracion">Configurar cartel</h3>
            <div id="contenedorFormularioConfiguracion"></div>
        </section>`;
    document.body.appendChild(modalConfiguracion);
    modalConfiguracion.querySelectorAll('[data-cerrar-configuracion]').forEach(el => el.addEventListener('click', cerrarModalConfiguracion));
    modalConfiguracion.querySelector('#cerrarModalConfiguracion').addEventListener('click', cerrarModalConfiguracion);
}

function abrirModalConfiguracion(form) {
    crearModalConfiguracion();
    if (formularioConfiguracionActivo && formularioConfiguracionActivo !== form) cerrarModalConfiguracion();
    formularioConfiguracionActivo = form;
    marcadorFormularioConfiguracion = document.createComment('ubicacion-formulario-configuracion');
    form.parentNode.insertBefore(marcadorFormularioConfiguracion, form);
    modalConfiguracion.querySelector('#tituloModalConfiguracion').textContent = form.querySelector('h4')?.textContent || 'Configurar cartel';
    modalConfiguracion.querySelector('#contenedorFormularioConfiguracion').appendChild(form);
    form.classList.remove('oculto');
    modalConfiguracion.classList.remove('oculto');
    modalConfiguracion.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-abierto');
    actualizarVistaPreviaTitularConfiguracion(form);
    form.querySelector('input[name="duracion_segundos"]')?.focus();
}

function cerrarModalConfiguracion() {
    if (!modalConfiguracion || !formularioConfiguracionActivo) return;
    if (marcadorFormularioConfiguracion?.parentNode) {
        marcadorFormularioConfiguracion.parentNode.insertBefore(formularioConfiguracionActivo, marcadorFormularioConfiguracion);
        marcadorFormularioConfiguracion.remove();
    }
    formularioConfiguracionActivo.classList.add('oculto');
    formularioConfiguracionActivo = null;
    marcadorFormularioConfiguracion = null;
    modalConfiguracion.classList.add('oculto');
    modalConfiguracion.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-abierto');
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalConfiguracion && !modalConfiguracion.classList.contains('oculto')) cerrarModalConfiguracion();
});

document.getElementById('mostrarFormulario').addEventListener('click', abrirFormulario);
document.getElementById('cancelarFormulario').addEventListener('click', cerrarFormulario);
document.getElementById('cerrarModalCartel').addEventListener('click', cerrarFormulario);
modalCartel.querySelectorAll('[data-cerrar-modal]').forEach(el => el.addEventListener('click', cerrarFormulario));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalCartel.classList.contains('oculto')) cerrarFormulario(); });
formulario.querySelectorAll('input[name="destino"]').forEach(r => r.addEventListener('change', actualizarOpcionesNuevas));
titularNuevo.addEventListener('input', actualizarVistaPreviaTitularNueva);
posicionTitularNueva.addEventListener('change', actualizarVistaPreviaTitularNueva);
fechaInicioNueva.addEventListener('change', () => { fechaFinNueva.min = fechaInicioNueva.value; if (fechaFinNueva.value && fechaFinNueva.value < fechaInicioNueva.value) fechaFinNueva.value = fechaInicioNueva.value; });

campoImagen.addEventListener('change', () => {
    const archivo = campoImagen.files[0]; vistaPrevia.classList.add('oculto'); imagenNueva.removeAttribute('src'); if (!archivo) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(archivo.type)) { mostrarMensaje('Selecciona un archivo JPG, PNG, WEBP o GIF válido.', 'error'); campoImagen.value = ''; return; }
    const lector = new FileReader(); lector.onload = () => { imagenNueva.onload = () => vistaPrevia.classList.remove('oculto'); imagenNueva.onerror = () => mostrarMensaje('No se ha podido mostrar la vista previa de esta imagen.', 'error'); imagenNueva.src = lector.result; }; lector.onerror = () => mostrarMensaje('No se ha podido leer el archivo seleccionado.', 'error'); lector.readAsDataURL(archivo);
});
formulario.addEventListener('submit', async e => {
    e.preventDefault();
    if (!campoImagen.files.length) return mostrarMensaje('Selecciona una imagen.', 'error');
    if (!fechaInicioNueva.value || !fechaFinNueva.value || fechaFinNueva.value < fechaInicioNueva.value) return mostrarMensaje('Comprueba las fechas: la finalización no puede ser anterior al inicio.', 'error');
    const destino = formulario.querySelector('input[name="destino"]:checked').value;
    const ids = [...formulario.querySelectorAll('input[name="pantallaNueva"]:checked')].map(x => Number(x.value));
    if (destino === 'seleccionadas' && !ids.length) return mostrarMensaje('Selecciona al menos una pantalla.', 'error');
    const datos = new FormData(formulario); datos.set('pantallas', JSON.stringify(ids));
    botonGuardar.disabled = true; botonGuardar.textContent = 'Guardando...';
    try { const r = await peticion('/api/carteles', { method: 'POST', body: datos }); cerrarFormulario(); await cargarCarteles(); mostrarMensaje(r.mensaje); }
    catch (e2) { mostrarMensaje(e2.message, 'error'); }
    finally { botonGuardar.disabled = false; botonGuardar.textContent = 'Guardar cartel'; }
});
listaCarteles.addEventListener('click', async e => {
    const boton = e.target.closest('button[data-accion]'); if (!boton) return;
    const id = Number(boton.dataset.id); const accion = boton.dataset.accion;
    if (accion === 'cancelar-config') { cerrarModalConfiguracion(); return; }
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (accion === 'configurar') { const form = listaCarteles.querySelector(`[data-config-id="${id}"]`); if (form) abrirModalConfiguracion(form); return; }
    if (accion === 'optimizar' && !window.confirm('Se intentará reducir el peso conservando el tamaño de la imagen y su nombre de archivo. La pantalla descargará automáticamente la versión optimizada. ¿Continuar?')) return;
    boton.disabled = true;
    try {
        if (accion === 'optimizar') { const r = await peticion(`/api/carteles/${id}/optimizar`, { method: 'POST' }); await cargarCarteles(); mostrarMensaje(r.mensaje); }
        if (accion === 'estado') { const r = await peticion(`/api/carteles/${id}/estado`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: boton.dataset.activo === '1' }) }); await cargarCarteles(); mostrarMensaje(r.mensaje); }
        if (accion === 'eliminar') { const c = carteles.find(x => Number(x.id) === id); if (!c || !window.confirm(`¿Quieres eliminar el cartel «${c.nombre}»?\n\nTambién se eliminará su archivo de imagen.`)) return; const r = await peticion(`/api/carteles/${id}`, { method: 'DELETE' }); await cargarCarteles(); mostrarMensaje(r.mensaje); }
    } catch (err) { mostrarMensaje(err.message, 'error'); } finally { boton.disabled = false; }
});
document.addEventListener('input', e => {
    const form = e.target.closest('form[data-config-id]');
    if (form && e.target.matches('textarea[name="titular"]')) actualizarVistaPreviaTitularConfiguracion(form);
});
document.addEventListener('change', e => {
    const form = e.target.closest('form[data-config-id]');
    if (!form) return;
    if (e.target.matches('select[name="posicion_titular"]')) actualizarVistaPreviaTitularConfiguracion(form);
    if (e.target.matches('input[name="fecha_inicio"]')) {
        const fin = form.elements.fecha_fin;
        fin.min = e.target.value;
        if (fin.value && e.target.value && fin.value < e.target.value) fin.value = e.target.value;
    }
});

document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-config-id]'); if (!form) return;
    e.preventDefault(); const id = Number(form.dataset.configId);
    const destino = form.querySelector('input[name="destino"]:checked')?.value || 'todas';
    const ids = [...form.querySelectorAll(`input[name="pantalla-${id}"]:checked`)].map(x => Number(x.value));
    if (destino === 'seleccionadas' && !ids.length) return mostrarMensaje('Selecciona al menos una pantalla.', 'error');
    if (form.elements.fecha_inicio.value && form.elements.fecha_fin.value && form.elements.fecha_fin.value < form.elements.fecha_inicio.value) return mostrarMensaje('La fecha de finalización no puede ser anterior a la fecha de inicio.', 'error');
    const boton = form.querySelector('button[type="submit"]'); boton.disabled = true;
    try { const r = await peticion(`/api/carteles/${id}/configuracion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duracion_segundos: Number(form.elements.duracion_segundos.value), titular: form.elements.titular.value.trim(), posicion_titular: form.elements.posicion_titular.value, fecha_inicio: form.elements.fecha_inicio.value, fecha_fin: form.elements.fecha_fin.value, destino, pantallas: ids }) }); cerrarModalConfiguracion(); await cargarCarteles(); mostrarMensaje(r.mensaje); }
    catch (err) { mostrarMensaje(err.message, 'error'); } finally { boton.disabled = false; }
});

const modalPantalla = document.getElementById('modalPantalla');
let pantallaEditandoId = null;
function abrirModalPantalla(pantalla = null) {
    pantallaEditandoId = pantalla ? Number(pantalla.id) : null;
    formularioPantalla.reset();
    document.getElementById('tituloModalPantalla').textContent = pantalla ? 'Editar pantalla' : 'Añadir pantalla';
    document.getElementById('guardarPantalla').textContent = pantalla ? 'Guardar cambios' : 'Registrar pantalla';
    if (pantalla) {
        formularioPantalla.elements.nombre.value = pantalla.nombre || '';
        formularioPantalla.elements.codigo.value = pantalla.codigo || '';
        formularioPantalla.elements.ubicacion.value = pantalla.ubicacion || '';
    }
    modalPantalla.classList.remove('oculto');
    modalPantalla.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-abierto');
    document.getElementById('nombrePantalla').focus();
}
function cerrarModalPantalla() {
    modalPantalla.classList.add('oculto');
    modalPantalla.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-abierto');
    formularioPantalla.reset();
    pantallaEditandoId = null;
}
document.getElementById('mostrarFormularioPantalla').addEventListener('click', () => abrirModalPantalla());
document.getElementById('cancelarPantalla').addEventListener('click', cerrarModalPantalla);
document.getElementById('cerrarModalPantalla').addEventListener('click', cerrarModalPantalla);
modalPantalla.querySelectorAll('[data-cerrar-pantalla]').forEach(el => el.addEventListener('click', cerrarModalPantalla));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalPantalla.classList.contains('oculto')) cerrarModalPantalla(); });
document.getElementById('cancelarPantalla').addEventListener('click', () => { formularioPantalla.reset(); formularioPantalla.classList.add('oculto'); });
formularioPantalla.addEventListener('submit', async e => {
    e.preventDefault(); const boton = document.getElementById('guardarPantalla'); boton.disabled = true;
    const datos = Object.fromEntries(new FormData(formularioPantalla).entries());
    try { const r = pantallaEditandoId ? await peticion(`/api/pantallas/${pantallaEditandoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }) : await peticion('/api/pantallas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }); cerrarModalPantalla(); await cargarPantallas(); await cargarCarteles(); mostrarMensaje(r.mensaje); }
    catch (err) { mostrarMensaje(err.message, 'error'); } finally { boton.disabled = false; }
});
listaPantallas.addEventListener('click', async e => {
    const b = e.target.closest('button[data-accion-pantalla]'); if (!b) return;
    const pantalla = pantallas.find(p => Number(p.id) === Number(b.dataset.id));
    if (b.dataset.accionPantalla === 'editar') { if (pantalla) abrirModalPantalla(pantalla); return; }
    b.disabled = true;
    try { const r = await peticion(`/api/pantallas/${Number(b.dataset.id)}/estado`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activa: b.dataset.activa === '1' }) }); await cargarPantallas(); await cargarCarteles(); mostrarMensaje(r.mensaje); }
    catch (err) { mostrarMensaje(err.message, 'error'); } finally { b.disabled = false; }
});
busqueda.addEventListener('input', renderizarLista);
filtroEstado.addEventListener('change', renderizarLista);
const botonActualizarPantallas =
    document.getElementById('actualizarPantallas');

if (botonActualizarPantallas) {
    botonActualizarPantallas.addEventListener('click', async () => {
        botonActualizarPantallas.disabled = true;

        try {
            await cargarPantallas();
        } finally {
            botonActualizarPantallas.disabled = false;
        }
    });
}

// Actualizar el estado de conexión cada 30 segundos.
setInterval(cargarPantallas, 30000);
setInterval(renderizarLista, 60000); // Recalcular los estados según la fecha local.

Promise.all([cargarPantallas(), cargarCarteles()]);


// Importar manualmente las noticias visibles en la portada de la web municipal.
const botonImportarWeb = document.getElementById('importarNoticiasWeb');
if (botonImportarWeb) {
    botonImportarWeb.addEventListener('click', async () => {
        if (!window.confirm('Se comprobarán los destacados y las noticias de la portada municipal. Solo se añadirán artículos que todavía no estén importados. ¿Continuar?')) return;

        botonImportarWeb.disabled = true;
        const textoOriginal = botonImportarWeb.textContent;
        botonImportarWeb.textContent = 'Importando...';

        try {
            const r = await peticion('/api/importacion-web/ejecutar', { method: 'POST' });
            await cargarCarteles();

            let detalle = r.mensaje;
            if (r.errores?.length) {
                detalle += ` ${r.errores.length} noticia(s) no se pudieron importar.`;
                console.warn('Errores de importación web:', r.errores);
            }
            mostrarMensaje(detalle, r.errores?.length ? 'error' : 'exito');
        } catch (error) {
            mostrarMensaje(error.message, 'error');
        } finally {
            botonImportarWeb.disabled = false;
            botonImportarWeb.textContent = textoOriginal;
        }
    });
}


// Visor ampliado de carteles: la miniatura se puede pulsar para verla a tamaño completo.
(() => {
    let modalVista = null;
    let botonAnterior = null;

    function crearModalVista() {
        if (modalVista) return modalVista;
        modalVista = document.createElement('div');
        modalVista.className = 'visor-imagen-cartel';
        modalVista.setAttribute('role', 'dialog');
        modalVista.setAttribute('aria-modal', 'true');
        modalVista.setAttribute('aria-label', 'Vista ampliada del cartel');
        modalVista.innerHTML = `
            <button type="button" class="visor-imagen-cerrar" aria-label="Cerrar imagen" title="Cerrar (Esc)">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
            <div class="visor-imagen-fondo" data-cerrar-visor></div>
            <img class="visor-imagen-contenido" alt="Vista ampliada del cartel">
        `;
        document.body.appendChild(modalVista);
        modalVista.querySelector('.visor-imagen-cerrar').addEventListener('click', cerrarModalVista);
        modalVista.querySelector('[data-cerrar-visor]').addEventListener('click', cerrarModalVista);
        return modalVista;
    }

    function abrirModalVista(boton) {
        const modal = crearModalVista();
        const imagen = modal.querySelector('.visor-imagen-contenido');
        const miniatura = boton.querySelector('img');
        imagen.src = boton.dataset.previewSrc || miniatura?.src || '';
        imagen.alt = miniatura?.alt || 'Cartel municipal';
        botonAnterior = boton;
        modal.classList.add('abierto');
        document.body.classList.add('visor-imagen-abierto');
        modal.querySelector('.visor-imagen-cerrar').focus();
    }

    function cerrarModalVista() {
        if (!modalVista) return;
        modalVista.classList.remove('abierto');
        document.body.classList.remove('visor-imagen-abierto');
        const imagen = modalVista.querySelector('.visor-imagen-contenido');
        imagen.removeAttribute('src');
        if (botonAnterior?.isConnected) botonAnterior.focus();
        botonAnterior = null;
    }

    document.addEventListener('click', event => {
        const boton = event.target.closest('button.miniatura-preview');
        if (boton) abrirModalVista(boton);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modalVista?.classList.contains('abierto')) cerrarModalVista();
    });
})();
