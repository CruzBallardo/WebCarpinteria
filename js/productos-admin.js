/* ==========================================================
   productos-admin.js – Panel: alta, edición y baja de productos
   (antes era el admin.js del compañero)
   Usa CatalogoDB de productos-db.js (Supabase).
   ========================================================== */
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
            $('agregar').scrollIntoView({ behavior: 'smooth' });
        }
    });

    $('buscarAdmin').addEventListener('input', pintarListado);
    $('filtroCategoriaAdmin').addEventListener('change', pintarListado);

    async function cargarProductos() {
        productos = await CatalogoDB.obtenerTodos();
        $('statProductos').textContent = productos.length;
        pintarListado();
    }

    /* ---------- Inicio ---------- */
    limpiarFormulario();
    cargarProductos().catch(e => {
        console.error(e);
        mostrarAlerta('No se pudo cargar el catálogo: ' + (e.message || 'error desconocido'), 'danger');
    });
})();