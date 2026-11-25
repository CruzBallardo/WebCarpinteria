(() => {
    'use strict';

    const lista = document.getElementById('listaTrabajos');
    if (!lista) return;

    const BUCKET = 'trabajos';
    const MAX_INICIAL = 3;                       // trabajos visibles antes de pulsar "Ver más"

    const envoltorio = document.getElementById('trabajosMasWrap');
    const boton = document.getElementById('btnVerMasTrabajos');
    // Si falta el botón en el HTML, se muestran todos los trabajos sin límite
    const limite = boton ? MAX_INICIAL : Infinity;

    let abierto = false;

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const urlFoto = ruta => db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;

    function textoBoton() {
        boton.setAttribute('aria-expanded', String(abierto));
        boton.innerHTML = abierto
            ? '<i class="bi bi-chevron-up me-1"></i> Ver menos'
            : '<i class="bi bi-chevron-down me-1"></i> Ver más trabajos';
    }

    async function cargar() {
        const { data, error } = await db
            .from('trabajos')
            .select('titulo, imagen')
            .order('created_at', { ascending: false })
            .limit(60);

        if (error) {
            console.error('Error al cargar los trabajos:', error);
            lista.innerHTML = '<div class="col-12 text-center text-body-secondary py-4">No se pudieron cargar los trabajos.</div>';
            return;
        }

        if (!data.length) {
            lista.innerHTML = '<div class="col-12 text-center text-body-secondary py-4">Pronto publicaremos nuestros trabajos.</div>';
            if (envoltorio) envoltorio.classList.add('d-none');
            return;
        }

        lista.innerHTML = data.map((t, i) => `
            <div class="col-12 col-sm-6 col-lg-4 reveal${i % 3 ? ' reveal-delay-' + (i % 3) : ''}${i >= limite ? ' d-none' : ''}" ${i >= limite ? 'data-extra="1"' : ''}>
                <div class="galeria-item position-relative overflow-hidden rounded-4 shadow">
                    <img src="${esc(urlFoto(t.imagen))}" alt="${esc(t.titulo)}" loading="lazy" class="w-100 d-block">
                    <div class="galeria-overlay position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center text-white">
                        <span class="fw-semibold fs-5">${esc(t.titulo)}</span>
                    </div>
                </div>
            </div>`).join('');

        // El botón solo aparece cuando hay más de 3 trabajos
        if (boton && envoltorio) {
            abierto = false;
            textoBoton();
            envoltorio.classList.toggle('d-none', data.length <= MAX_INICIAL);
        }

        revelar(lista.querySelectorAll('.reveal:not(.d-none)'));
    }

    // Las tarjetas se crean después de cargar la página, así que se animan aquí
    function revelar(tarjetas) {
        if (!('IntersectionObserver' in window)) {
            tarjetas.forEach(el => el.classList.add('visible'));
            return;
        }
        const io = new IntersectionObserver(entradas => {
            entradas.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.15 });
        tarjetas.forEach(el => io.observe(el));
    }

    // ====== VER MÁS / VER MENOS ======
    if (boton) {
        boton.addEventListener('click', () => {
            abierto = !abierto;
            const extras = lista.querySelectorAll('[data-extra="1"]');

            if (abierto) {
                // Se despliegan con la misma animación de entrada
                extras.forEach(el => el.classList.remove('d-none', 'visible'));
                void lista.offsetWidth;
                requestAnimationFrame(() => extras.forEach(el => el.classList.add('visible')));
            } else {
                extras.forEach(el => el.classList.add('d-none'));
                const galeria = document.getElementById('galeria');
                if (galeria) galeria.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            textoBoton();
        });
    }

    cargar();
})();