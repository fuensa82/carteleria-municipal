const formulario = document.getElementById('formularioCartel');
const panelSubida = document.getElementById('panelSubida');
const modalCartel = document.getElementById('modalCartel');
const listaCarteles = document.getElementById('listaCarteles');
const contador = document.getElementById('contador');
const mensaje = document.getElementById('mensaje');
const botonGuardar = document.getElementById('guardarCartel');
const campoNombre = document.getElementById('nombre');
const campoImagen = document.getElementById('imagen');
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
        const coincideEstado = estado === 'todos' || (estado === 'activos' && Number(c.activo) === 1) || (estado === 'inactivos' && Number(c.activo) === 0);
        return coincideTexto && coincideEstado;
    });
    contador.textContent = `${filtrados.length} de ${carteles.length} cartel(es)`;
    if (!filtrados.length) {
        listaCarteles.innerHTML = `<div class="estado-vacio">${carteles.length === 0 ? 'Todavía no hay carteles. Pulsa «Añadir cartel» para subir el primero.' : 'No hay carteles que coincidan con la búsqueda.'}</div>`;
        return;
    }
    listaCarteles.innerHTML = filtrados.map(c => {
        const activo = Number(c.activo) === 1;
        const destinoTexto = c.destino === 'todas' ? 'Todas las pantallas' : (c.pantallas?.length ? c.pantallas.map(p => p.nombre).join(', ') : 'Sin pantallas asignadas');
        return `<article class="fila-cartel" data-id="${Number(c.id)}">
            <div class="miniatura"><img src="/media/imagenes/${encodeURIComponent(c.archivo)}" alt="Miniatura de ${escapar(c.nombre)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="sin-miniatura" style="display:none">Imagen no disponible</span></div>
            <div class="info-cartel"><div class="nombre-cartel">${escapar(c.nombre)}</div><div class="archivo-cartel">${escapar(c.archivo)}</div><div class="fecha-cartel">Alta: ${escapar(formatearFecha(c.fecha_alta))}</div><div class="detalle-configuracion"><strong>Duración:</strong> ${Number(c.duracion_segundos) || 15} s<br><strong>Destino:</strong> ${escapar(destinoTexto)}</div></div>
            <div class="estado-columna"><span class="estado ${activo ? 'activo' : 'inactivo'}">${activo ? 'Activo' : 'Inactivo'}</span></div>
            <div class="acciones-cartel"><button type="button" class="boton-pequeno" data-accion="configurar" data-id="${Number(c.id)}">Configurar</button><button type="button" class="boton-pequeno" data-accion="estado" data-id="${Number(c.id)}" data-activo="${activo ? '0' : '1'}">${activo ? 'Desactivar' : 'Activar'}</button><button type="button" class="boton-pequeno eliminar" data-accion="eliminar" data-id="${Number(c.id)}">Eliminar</button></div>
            <form class="configuracion-cartel oculto" data-config-id="${Number(c.id)}">
                <h4>Configuración de «${escapar(c.nombre)}»</h4>
                <div class="campo campo-corto"><label>Duración en pantalla (segundos)</label><input name="duracion_segundos" type="number" min="3" max="3600" value="${Number(c.duracion_segundos) || 15}" required></div>
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
function renderizarPantallas() {
    if (!pantallas.length) { listaPantallas.innerHTML = '<div class="estado-vacio">Todavía no hay pantallas registradas.</div>'; return; }
    listaPantallas.innerHTML = pantallas.map(p => `<article class="fila-pantalla"><div><strong>${escapar(p.nombre)}</strong><div class="texto-secundario">Código: ${escapar(p.codigo)}${p.ubicacion ? ` · ${escapar(p.ubicacion)}` : ''}</div></div><span class="estado ${Number(p.activa) === 1 ? 'activo' : 'inactivo'}">${Number(p.activa) === 1 ? 'Activa' : 'Inactiva'}</span><div class="acciones-pantalla"><button class="boton-pequeno" type="button" data-accion-pantalla="editar" data-id="${Number(p.id)}">Editar</button><button class="boton-pequeno" type="button" data-accion-pantalla="estado" data-id="${Number(p.id)}" data-activa="${Number(p.activa) === 1 ? '0' : '1'}">${Number(p.activa) === 1 ? 'Desactivar' : 'Activar'}</button></div></article>`).join('');
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
    modalCartel.classList.remove('oculto');
    modalCartel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-abierto');
    actualizarOpcionesNuevas();
    window.setTimeout(() => campoNombre.focus(), 50);
}
function cerrarFormulario() {
    formulario.reset();
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

campoImagen.addEventListener('change', () => {
    const archivo = campoImagen.files[0]; vistaPrevia.classList.add('oculto'); imagenNueva.removeAttribute('src'); if (!archivo) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(archivo.type)) { mostrarMensaje('Selecciona un archivo JPG, PNG, WEBP o GIF válido.', 'error'); campoImagen.value = ''; return; }
    const lector = new FileReader(); lector.onload = () => { imagenNueva.onload = () => vistaPrevia.classList.remove('oculto'); imagenNueva.onerror = () => mostrarMensaje('No se ha podido mostrar la vista previa de esta imagen.', 'error'); imagenNueva.src = lector.result; }; lector.onerror = () => mostrarMensaje('No se ha podido leer el archivo seleccionado.', 'error'); lector.readAsDataURL(archivo);
});
formulario.addEventListener('submit', async e => {
    e.preventDefault();
    if (!campoImagen.files.length) return mostrarMensaje('Selecciona una imagen.', 'error');
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
    boton.disabled = true;
    try {
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
    if (form && e.target.matches('select[name="posicion_titular"]')) actualizarVistaPreviaTitularConfiguracion(form);
});

document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-config-id]'); if (!form) return;
    e.preventDefault(); const id = Number(form.dataset.configId);
    const destino = form.querySelector('input[name="destino"]:checked')?.value || 'todas';
    const ids = [...form.querySelectorAll(`input[name="pantalla-${id}"]:checked`)].map(x => Number(x.value));
    if (destino === 'seleccionadas' && !ids.length) return mostrarMensaje('Selecciona al menos una pantalla.', 'error');
    const boton = form.querySelector('button[type="submit"]'); boton.disabled = true;
    try { const r = await peticion(`/api/carteles/${id}/configuracion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duracion_segundos: Number(form.elements.duracion_segundos.value), titular: form.elements.titular.value.trim(), posicion_titular: form.elements.posicion_titular.value, destino, pantallas: ids }) }); cerrarModalConfiguracion(); await cargarCarteles(); mostrarMensaje(r.mensaje); }
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
Promise.all([cargarPantallas(), cargarCarteles()]);
