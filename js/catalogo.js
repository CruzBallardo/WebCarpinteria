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

    /* ---------- Skeletons ---------- */
    function skeletonCards(n = 8) {
        return Array.from({ length: n }, () => `
            <div class="col-6 col-xl-3" aria-hidden="true">
                <div class="card h-100 shadow-sm">
                    <div class="sk-img placeholder-wave">
                        <span class="placeholder d-block w-100 h-100 rounded-0"></span>
                    </div>
                    <div class="card-body d-flex flex-column placeholder-glow">
                        <span class="placeholder col-4 mb-2" style="height:1.4rem"></span>
                        <span class="placeholder col-8 mb-2" style="height:1.5rem"></span>
                        <span class="placeholder col-12 mb-1"></span>
                        <span class="placeholder col-9 mb-3"></span>
                        <span class="placeholder col-12 mt-auto" style="height:2.4rem"></span>
                    </div>
                </div>
            </div>`).join('');
    }

    function mostrarSkeletons() {
        grid.setAttribute('aria-busy', 'true');
        grid.innerHTML = skeletonCards(8);
        contador.innerHTML = '<span class="placeholder d-inline-block" style="width:4.5rem">&nbsp;</span>';
        filtros.innerHTML = `
            <div class="placeholder-glow" aria-hidden="true">
                <span class="placeholder col-10 d-block mb-3"></span>
                <span class="placeholder col-8 d-block mb-3"></span>
                <span class="placeholder col-9 d-block mb-3"></span>
                <span class="placeholder col-7 d-block"></span>
            </div>`;
    }

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
                    <img src="${p.imagenes[0]}" class="card-img-top imagen-producto" alt="${esc(p.nombre)}" loading="lazy" decoding="async">
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

    /* =========================================================
       MODAL + MAGNIFIER + ZOOM
       ========================================================= */

    let magnifierLens = null;
    let currentZoomSrc = '';

    function crearMagnifier() {
        if (magnifierLens) return magnifierLens;
        const wrapper = document.querySelector('.main-image-wrapper');
        if (!wrapper) return null;

        magnifierLens = document.createElement('div');
        magnifierLens.className = 'magnifier-lens';
        wrapper.appendChild(magnifierLens);
        return magnifierLens;
    }

    function actualizarMagnifier(src) {
        currentZoomSrc = src;
        if (magnifierLens) {
            magnifierLens.style.backgroundImage = `url('${src}')`;
        }
    }

    function initMagnifier() {
        const wrapper = document.querySelector('.main-image-wrapper');
        if (!wrapper) return;

        const lens = crearMagnifier();
        if (!lens) return;

        const zoom = 2.5;
        const lensSize = 140;

        wrapper.addEventListener('mousemove', e => {
            if (window.innerWidth < 992) return; // solo desktop

            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let lensX = x - lensSize / 2;
            let lensY = y - lensSize / 2;

            lensX = Math.max(0, Math.min(lensX, rect.width - lensSize));
            lensY = Math.max(0, Math.min(lensY, rect.height - lensSize));

            lens.style.left = lensX + 'px';
            lens.style.top = lensY + 'px';
            lens.classList.add('active');

            const bgX = (x / rect.width) * 100;
            const bgY = (y / rect.height) * 100;

            lens.style.backgroundImage = `url('${currentZoomSrc}')`;
            lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
            lens.style.backgroundPosition = `${bgX}% ${bgY}%`;
        });

        wrapper.addEventListener('mouseleave', () => {
            if (lens) lens.classList.remove('active');
        });
    }

    /* ---------- Modal ---------- */
    $('modalProducto').addEventListener('show.bs.modal', e => {
        const id = e.relatedTarget && e.relatedTarget.dataset.id;
        const p = productos.find(x => x.id === id);
        if (!p) return;

        // Datos del producto
        $('tituloModalProducto').textContent = p.nombre;
        $('descripcionModal').textContent = p.descripcion || '';
        $('categoriaModal').textContent = p.categoria || '';

        // Precio limpio
        $('precioModal').textContent = p.precio != null
            ? `$${p.precio.toLocaleString('es-MX')}`
            : 'Precio a cotizar';

        // Imagen principal
        const imgPrincipal = $('imagenPrincipalModal');
        imgPrincipal.src = p.imagenes[0] || '';
        imgPrincipal.alt = p.nombre;

        // Miniaturas
        const contMiniaturas = $('miniaturasProducto');
        contMiniaturas.innerHTML = '';

        if (p.imagenes && p.imagenes.length > 1) {
            p.imagenes.forEach((src, i) => {
                const thumb = document.createElement('div');
                thumb.className = `thumbnail-item ${i === 0 ? 'active' : ''}`;
                thumb.innerHTML = `<img src="${src}" alt="${esc(p.nombre)} ${i + 1}">`;

                thumb.addEventListener('click', () => {
                    imgPrincipal.style.opacity = '0';
                    setTimeout(() => {
                        imgPrincipal.src = src;
                        imgPrincipal.style.opacity = '1';
                        actualizarMagnifier(src);
                    }, 150);

                    contMiniaturas.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });

                contMiniaturas.appendChild(thumb);
            });
        }

        // Actualizar magnifier con la primera imagen
        actualizarMagnifier(p.imagenes[0] || '');

        // Zoom fullscreen al hacer clic
        imgPrincipal.onclick = () => abrirZoom(imgPrincipal.src, p.nombre);

        // Reset del botón favorito
        const btnFav = $('btnFavorito');
        if (btnFav) {
            btnFav.classList.remove('active');
            const icon = btnFav.querySelector('i');
            if (icon) {
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');
            }
        }
    });

    /* ---------- Favorito ---------- */
    document.addEventListener('click', e => {
        if (e.target.closest('#btnFavorito')) {
            const btn = $('btnFavorito');
            if (!btn) return;
            btn.classList.toggle('active');
            const icon = btn.querySelector('i');
            if (icon) {
                icon.classList.toggle('bi-heart');
                icon.classList.toggle('bi-heart-fill');
            }
        }
    });

    /* ---------- Zoom fullscreen ---------- */
    function abrirZoom(src, alt) {
        let overlay = document.getElementById('zoomOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'zoomOverlay';
            overlay.className = 'zoom-overlay';
            overlay.innerHTML = `
                <button class="zoom-close" aria-label="Cerrar zoom">&times;</button>
                <img src="" alt="">
            `;
            document.body.appendChild(overlay);

            overlay.addEventListener('click', e => {
                if (e.target === overlay || e.target.classList.contains('zoom-close')) {
                    cerrarZoom();
                }
            });

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape') cerrarZoom();
            });
        }

        const img = overlay.querySelector('img');
        img.src = src;
        img.alt = alt || '';

        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    function cerrarZoom() {
        const overlay = document.getElementById('zoomOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    /* ---------- Buscador ---------- */
    $('searchForm').addEventListener('submit', e => { e.preventDefault(); pintarCatalogo(); });
    buscador.addEventListener('input', pintarCatalogo);

    /* ---------- Inicio ---------- */
    (async () => {
        mostrarSkeletons();

        try {
            productos = await CatalogoDB.obtenerTodos();
        } catch (e) {
            console.error('No se pudo leer el catálogo', e);
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <p class="text-body-secondary mb-3">No pudimos cargar el catálogo.</p>
                    <button class="btn btn-outline-primary" onclick="location.reload()">Reintentar</button>
                </div>`;
            contador.textContent = '';
            filtros.innerHTML = '';
            grid.setAttribute('aria-busy', 'false');
            return;
        }

        pintarFiltros();
        pintarCatalogo();
        grid.setAttribute('aria-busy', 'false');

        // Inicializar magnifier una vez que el DOM del modal existe
        initMagnifier();
    })();
})();