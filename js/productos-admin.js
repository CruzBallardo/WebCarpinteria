/* ==========================================================
   productos-admin.js – Panel: alta, edición y baja de productos
   Usa CatalogoDB de productos-db.js (Supabase).
   ========================================================== */

/* ========== Skeletons (tablas y estadísticas) ========== */
(function () {
    const sk = (cls = '', style = '') =>
        `<span class="sk ${cls}" ${style ? `style="${style}"` : ''}></span>`;

    function tableRows(tbodyId, cols, rows = 4) {
        const tb = document.getElementById(tbodyId);
        if (!tb) return;
        const widths = ['70%', '85%', '55%', '60%', '45%', '50%'];
        tb.innerHTML = Array.from({ length: rows }, () =>
            `<tr>${Array.from({ length: cols }, (_, i) =>
                `<td>${i === cols - 1 ? sk('sk-btn') : sk('sk-line', `width:${widths[i % widths.length]}`)}</td>`
            ).join('')}</tr>`
        ).join('');
    }

    function statNumbers() {
        ['statProductos', 'statResenas', 'statCotizaciones', 'statFacturas'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('sk');
            const done = () => { el.classList.remove('sk'); obs.disconnect(); clearTimeout(t); };
            const obs = new MutationObserver(done);
            obs.observe(el, { childList: true, characterData: true, subtree: true });
            const t = setTimeout(done, 8000);
        });
    }

    window.Skeleton = { tableRows };

    // Skeleton al refrescar o filtrar cotizaciones y facturas
    const on = (id, ev, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(ev, fn);
    };
    on('btnRefrescarCot', 'click',  () => tableRows('tbodyCotizaciones', 5));
    on('filtroCotizaciones', 'change', () => tableRows('tbodyCotizaciones', 5));
    on('btnRefrescarFac', 'click',  () => tableRows('tbodyFacturas', 6));
    on('filtroFacturas', 'change',  () => tableRows('tbodyFacturas', 6));

    statNumbers();
    tableRows('tbodyResenas', 5);
    tableRows('tbodyCotizaciones', 5);
    tableRows('tbodyFacturas', 6);
})();

/* ========== Productos ========== */
(() => {
    const $ = id => document.getElementById(id);

    const campos = {
        nombre: $('txtNombreProducto'),
        categoria: $('txtCategoriaProducto'),
        precio: $('txtPrecio'),
        descripcion: $('txtDescripcion')
    };
    const inputsFoto = [$('foto1'), $('foto2'), $('foto3'), $('foto4')];
    const btnSubir = $('btnSubir');
    const btnModificar = $('btnModificar');
    const btnCancelar = $('btnCancelar');
    const form = $('formProducto');

    // Cada posición es: null | dataURL (foto nueva) | URL pública (foto ya guardada)
    let fotos = [null, null, null, null];
    let editandoId = null;
    let productos = [];
    let ocupado = false;

    /* ---------- Utilidades ---------- */
    const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function mostrarAlerta(mensaje, tipo = 'success') {
        $('alertaForm').innerHTML =
            `<div class="alert alert-${tipo} alert-dismissible fade show py-2" role="alert">
                ${esc(mensaje)}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
             </div>`;
    }

    function actualizarBotones() {
        btnSubir.disabled = ocupado || editandoId !== null;
        btnModificar.disabled = ocupado || editandoId === null;
        btnCancelar.disabled = ocupado;
    }

    function leerComoDataURL(archivo) {
        return new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = reject;
            lector.readAsDataURL(archivo);
        });
    }

    // Reduce la imagen antes de subirla (más rápido y ahorra almacenamiento)
    function comprimirImagen(archivo, maxLado = 1000, calidad = 0.8) {
        return new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onerror = reject;
            lector.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * escala);
                    canvas.height = Math.round(img.height * escala);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff'; // evita fondo negro en PNG transparentes
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', calidad));
                };
                img.src = lector.result;
            };
            lector.readAsDataURL(archivo);
        });
    }

    /* ---------- Fotografías ---------- */
    function pintarPreview(i) {
        const img = $('preview' + (i + 1));
        if (fotos[i]) {
            img.src = fotos[i];
            img.classList.remove('d-none');
        } else {
            img.removeAttribute('src');
            img.classList.add('d-none');
        }
    }

    inputsFoto.forEach((input, i) => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) {
            label.addEventListener('click', e => {
                e.preventDefault();
                input.click();
            });
        }

        input.addEventListener('change', async () => {
            const archivo = input.files[0];
            if (!archivo) return;

            const img = $('preview' + (i + 1));
            img.src = URL.createObjectURL(archivo);
            img.classList.remove('d-none');

            try {
                fotos[i] = await comprimirImagen(archivo);
            } catch {
                try {
                    fotos[i] = await leerComoDataURL(archivo);
                } catch {
                    fotos[i] = null;
                    pintarPreview(i);
                    mostrarAlerta('No se pudo leer la imagen. Prueba con un JPG o PNG.', 'danger');
                }
            }
            input.value = '';
        });
    });

    /* ---------- Formulario ---------- */
    function limpiarFormulario() {
        form.reset();
        fotos = [null, null, null, null];
        inputsFoto.forEach((_, i) => pintarPreview(i));
        editandoId = null;
        actualizarBotones();
        $('tituloFormulario').textContent = 'Agregar producto';
    }

    function validar() {
        if (!campos.nombre.value.trim()) return 'Escribe el nombre del producto.';
        if (!campos.categoria.value) return 'Selecciona una categoría.';
        if (!campos.descripcion.value.trim()) return 'Escribe una descripción.';
        if (!fotos[0]) return 'La fotografía principal es obligatoria.';
        return null;
    }

    function construirProducto(idExistente) {
        return {
            id: idExistente || crypto.randomUUID(),
            nombre: campos.nombre.value.trim(),
            categoria: campos.categoria.value,
            precio: campos.precio.value ? parseFloat(campos.precio.value) : null,
            descripcion: campos.descripcion.value.trim(),
            imagenes: fotos.filter(Boolean) // la primera es la portada
        };
    }

    async function guardarProducto(esEdicion) {
        if (ocupado) return;
        const error = validar();
        if (error) return mostrarAlerta(error, 'warning');

        ocupado = true;
        actualizarBotones();
        mostrarAlerta('Guardando producto, espera un momento…', 'info');

        try {
            await CatalogoDB.guardar(construirProducto(esEdicion ? editandoId : null));
            limpiarFormulario();
            mostrarAlerta(esEdicion ? 'Producto modificado correctamente.' : 'Producto subido al catálogo.');
            await cargarProductos();
        } catch (e) {
            console.error(e);
            mostrarAlerta('No se pudo guardar el producto: ' + (e.message || 'error desconocido'), 'danger');
        } finally {
            ocupado = false;
            actualizarBotones();
        }
    }

    btnSubir.addEventListener('click', () => guardarProducto(false));
    btnModificar.addEventListener('click', () => guardarProducto(true));
    btnCancelar.addEventListener('click', e => {
        e.preventDefault();
        limpiarFormulario();
        $('alertaForm').innerHTML = '';
    });

    /* ---------- Listado "Mis productos" ---------- */
    function pintarSkeleton(n = 6) {
        $('listaProductos').innerHTML = `<div class="row g-3">${Array.from({ length: n }, () => `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="border rounded p-2 d-flex gap-3 align-items-center h-100">
                    <span class="sk" style="width:80px;height:80px;flex-shrink:0"></span>
                    <div class="flex-grow-1">
                        <span class="sk sk-line mb-2" style="width:70%"></span>
                        <span class="sk sk-line mb-2" style="width:40%"></span>
                        <div class="d-flex gap-1 mt-2">
                            <span class="sk sk-btn" style="width:5rem;height:2rem"></span>
                            <span class="sk sk-btn" style="width:2.5rem;height:2rem"></span>
                        </div>
                    </div>
                </div>
            </div>`).join('')}</div>`;
    }

    function pintarListado() {
        const texto = $('buscarAdmin').value.trim().toLowerCase();
        const cat = $('filtroCategoriaAdmin').value;

        const lista = productos.filter(p =>
            (!cat || p.categoria === cat) &&
            (!texto || p.nombre.toLowerCase().includes(texto) || p.descripcion.toLowerCase().includes(texto)));

        const cont = $('listaProductos');
        if (!lista.length) {
            cont.innerHTML = `<div class="border rounded p-5 text-center text-secondary">${
                productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos.'}</div>`;
            return;
        }

        cont.innerHTML = `<div class="row g-3">${lista.map(p => `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="border rounded p-2 d-flex gap-3 align-items-center h-100">
                    <img src="${esc(p.imagenes[0])}" alt="${esc(p.nombre)}" class="rounded" loading="lazy"
                         style="width:80px;height:80px;object-fit:cover;flex-shrink:0">
                    <div class="flex-grow-1 overflow-hidden">
                        <strong class="d-block text-truncate">${esc(p.nombre)}</strong>
                        <span class="small text-secondary d-block">${esc(p.categoria)}${
                            p.precio != null ? ' · $' + p.precio.toLocaleString('es-MX') : ''}</span>
                        <div class="mt-1 d-flex gap-1">
                            <button class="btn btn-outline-secondary btn-sm" data-accion="editar" data-id="${esc(p.id)}">
                                <i class="fa-solid fa-pen"></i> Editar</button>
                            <button class="btn btn-outline-danger btn-sm" data-accion="eliminar" data-id="${esc(p.id)}">
                                <i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`).join('')}</div>`;
    }

    $('listaProductos').addEventListener('click', async e => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn || ocupado) return;
        const id = btn.dataset.id;
        const producto = productos.find(p => p.id === id);
        if (!producto) return;

        if (btn.dataset.accion === 'eliminar') {
            if (!confirm(`¿Eliminar "${producto.nombre}" del catálogo?`)) return;
            try {
                await CatalogoDB.eliminar(id);
                if (editandoId === id) limpiarFormulario();
                await cargarProductos();
            } catch (err) {
                console.error(err);
                mostrarAlerta('No se pudo eliminar: ' + (err.message || 'error desconocido'), 'danger');
            }
        } else {
            // === EDITAR ===
            editandoId = id;
            campos.nombre.value = producto.nombre;
            campos.categoria.value = producto.categoria;
            campos.precio.value = producto.precio ?? '';
            campos.descripcion.value = producto.descripcion;
            fotos = [null, null, null, null];
            producto.imagenes.forEach((img, i) => { if (i < 4) fotos[i] = img; });
            fotos.forEach((_, i) => pintarPreview(i));
            actualizarBotones();
            $('tituloFormulario').textContent = 'Modificar producto';
            $('alertaForm').innerHTML = '';

            // Cambiar automáticamente a la pestaña de Agregar producto
            if (typeof window.showSection === 'function') {
                window.showSection('agregar');
            }
        }
    });

    $('buscarAdmin').addEventListener('input', pintarListado);
    $('filtroCategoriaAdmin').addEventListener('change', pintarListado);

    async function cargarProductos(conSkeleton = false) {
        if (conSkeleton) pintarSkeleton();
        try {
            productos = await CatalogoDB.obtenerTodos();
        } finally {
            $('statProductos').classList.remove('sk');
        }
        $('statProductos').textContent = productos.length;
        pintarListado();
    }

    /* ---------- Inicio ---------- */
    limpiarFormulario();
    form.classList.add('is-loading');
    cargarProductos(true)
        .catch(e => {
            console.error(e);
            pintarListado();
            mostrarAlerta('No se pudo cargar el catálogo: ' + (e.message || 'error desconocido'), 'danger');
        })
        .finally(() => form.classList.remove('is-loading'));
})();

/* ========== Navegación por pestañas del panel admin ========== */
document.addEventListener('DOMContentLoaded', function () {

    const sections = document.querySelectorAll('.main-content > section');
    const navLinks = document.querySelectorAll('.sidebar .nav-link[href^="#"]');

    if (!sections.length || !navLinks.length) return;

    window.showSection = function (id) {
        sections.forEach(sec => sec.classList.remove('active'));
        navLinks.forEach(link => link.classList.remove('active'));

        const target = document.getElementById(id);
        if (target) {
            target.classList.add('active');

            const activeLink = document.querySelector(`.sidebar .nav-link[href="#${id}"]`);
            if (activeLink) activeLink.classList.add('active');
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const id = href.substring(1);
                window.showSection(id);
                history.replaceState(null, null, href);
            }
        });
    });

    // Mostrar sección al cargar
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
        window.showSection(hash);
    } else {
        window.showSection('inicio');
    }
});
document.getElementById('btnNuevoProducto').addEventListener('click', function (e) {
    e.preventDefault();

    // Ocultar las secciones actuales
    document.querySelectorAll('.main-content > section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar el formulario de agregar producto
    const agregar = document.getElementById('agregar');
    agregar.classList.add('active');

    // Actualizar navegación del sidebar (si aplica)
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Desplazarse al formulario
    agregar.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
});