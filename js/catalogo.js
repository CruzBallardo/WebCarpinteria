/* ==========================================================
   catalogo.js  –  Pinta el catálogo con los productos del admin
   ========================================================== */
(() => {

    const $ = id => document.getElementById(id);
    const grid = $('gridProductos');
    const contador = $('contadorProductos');
    const filtros = $('filtroCategorias');
    const buscador = $('searchInput');

    let productos = [];
    const categoriasActivas = new Set();

    const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- Filtros de categoría (dinámicos) ---------- */
    function pintarFiltros() {
        const categorias = [...new Set(productos.map(p => p.categoria))].sort();
        if (!categorias.length) {
            filtros.innerHTML = '<p class="small text-body-secondary mb-0">Sin categorías aún.</p>';
            return;
        }
        filtros.innerHTML = categorias.map((cat, i) => `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="cat${i}" value="${esc(cat)}"
                       ${categoriasActivas.has(cat) ? 'checked' : ''}>
                <label class="form-check-label" for="cat${i}">${esc(cat)}</label>
            </div>`).join('');
    }

    filtros.addEventListener('change', e => {
        if (e.target.type !== 'checkbox') return;
        e.target.checked ? categoriasActivas.add(e.target.value) : categoriasActivas.delete(e.target.value);
        pintarCatalogo();
    });

    /* ---------- Tarjetas ---------- */
    function pintarCatalogo() {
        const texto = buscador.value.trim().toLowerCase();

        const lista = productos.filter(p =>
            (!categoriasActivas.size || categoriasActivas.has(p.categoria)) &&
            (!texto || p.nombre.toLowerCase().includes(texto) ||
                       p.descripcion.toLowerCase().includes(texto) ||
                       p.categoria.toLowerCase().includes(texto)));

        contador.textContent = `${lista.length} producto${lista.length === 1 ? '' : 's'}`;

        if (!lista.length) {
            grid.innerHTML = `<div class="col-12"><div class="text-center text-body-secondary py-5">${
                productos.length ? 'No encontramos productos con esa búsqueda.'
                                 : 'Pronto agregaremos nuestros productos.'}</div></div>`;
            return;
        }

        grid.innerHTML = lista.map(p => `
            <div class="col-6 col-xl-3">
                <div class="card h-100 shadow-sm card-animada">
                    <img src="${p.imagenes[0]}" class="card-img-top imagen-producto" alt="${esc(p.nombre)}">
                    <div class="card-body d-flex flex-column">
                        <span class="badge text-bg-light border align-self-start mb-2">${esc(p.categoria)}</span>
                        <h5 class="card-title">${esc(p.nombre)}</h5>
                        <p class="card-text text-body-secondary"
                           style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                            ${esc(p.descripcion)}</p>
                        <button type="button" class="btn btn-primary w-100 mt-auto"
                                data-bs-toggle="modal" data-bs-target="#modalProducto"
                                data-id="${p.id}">Consultar</button>
                    </div>
                </div>
            </div>`).join('');
    }

    /* ---------- Modal ---------- */
    $('modalProducto').addEventListener('show.bs.modal', e => {
        const id = e.relatedTarget && e.relatedTarget.dataset.id;
        const p = productos.find(x => x.id === id);
        if (!p) return;

        $('tituloModalProducto').textContent = p.nombre;
        $('descripcionModal').textContent = p.descripcion;
        $('categoriaModal').textContent = p.categoria;
        $('precioModal').textContent = p.precio != null
            ? `Precio de referencia: $${p.precio.toLocaleString('es-MX')} MXN` : '';

        $('imagenesCarrusel').innerHTML = p.imagenes.map((src, i) => `
            <div class="carousel-item ${i === 0 ? 'active' : ''}">
                <img src="${src}" class="d-block w-100 rounded" alt="${esc(p.nombre)} ${i + 1}"
                     style="max-height:420px;object-fit:contain">
            </div>`).join('');

        // Con una sola foto, ocultar flechas
        const unica = p.imagenes.length < 2;
        document.querySelectorAll('#carruselProducto .carousel-control-prev, #carruselProducto .carousel-control-next')
            .forEach(b => b.classList.toggle('d-none', unica));
    });

    /* ---------- Buscador ---------- */
    $('searchForm').addEventListener('submit', e => { e.preventDefault(); pintarCatalogo(); });
    buscador.addEventListener('input', pintarCatalogo);

    /* ---------- Inicio ---------- */
    (async () => {
        try {
            productos = await CatalogoDB.obtenerTodos();
        } catch (e) {
            console.error('No se pudo leer el catálogo', e);
        }
        pintarFiltros();
        pintarCatalogo();
    })();
})();