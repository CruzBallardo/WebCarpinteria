(() => {
    'use strict';

    const lista = document.getElementById('listaResenas');
    if (!lista) return;

    const MAX_INICIAL = 6;
    const $ = id => document.getElementById(id);

    const resumen = $('resumenResenas');
    const btnMas = $('btnVerMasResenas');
    const form = $('formResena');
    const alerta = $('resenaAlerta');
    const btnEnviar = $('resenaBtnEnviar');
    const modalEl = $('modalResena');

    let todas = [];
    let verTodas = false;

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const estrellas = n =>
        Array.from({ length: 5 }, (_, i) =>
            `<i class="bi bi-star-fill ${i < n ? '' : 'vacia'}"></i>`).join('');

    // ====== CARGAR ======
    async function cargar() {
        const { data, error } = await db
            .from('resenas')
            .select('nombre, apellido, calificacion, comentario, created_at')
            .eq('visible', true)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            console.error('Error al cargar reseñas:', error);
            lista.innerHTML = '<div class="col-12 text-center text-body-secondary">No se pudieron cargar las reseñas.</div>';
            return;
        }
        todas = data || [];
        render();
    }

    // ====== RENDER ======
    function render() {
        if (!todas.length) {
            resumen.innerHTML = '';
            lista.innerHTML = '<div class="col-12 text-center text-body-secondary py-4">Aún no hay reseñas. ¡Sé el primero en opinar!</div>';
            btnMas.classList.add('d-none');
            return;
        }

        const prom = todas.reduce((s, r) => s + r.calificacion, 0) / todas.length;
        resumen.innerHTML = `
            <span class="fs-2 fw-bold">${prom.toFixed(1)}</span>
            <span class="resena-stars fs-5">${estrellas(Math.round(prom))}</span>
            <span class="text-body-secondary small">${todas.length} reseña${todas.length === 1 ? '' : 's'}</span>`;

        const visibles = verTodas ? todas : todas.slice(0, MAX_INICIAL);
        lista.innerHTML = visibles.map(r => `
            <div class="col-md-6 col-lg-4">
                <figure class="resena-card card h-100 rounded-4 shadow-sm border-0 p-4 mb-0">
                    <div class="resena-quote">&ldquo;</div>
                    <div class="resena-stars mb-2" aria-label="${r.calificacion} de 5 estrellas">${estrellas(r.calificacion)}</div>
                    <blockquote class="mb-3 flex-grow-1">${esc(r.comentario)}</blockquote>
                    <figcaption class="fw-semibold small">&mdash; ${esc(r.nombre)} ${esc(r.apellido)}</figcaption>
                </figure>
            </div>`).join('');

        btnMas.classList.toggle('d-none', verTodas || todas.length <= MAX_INICIAL);
    }

    btnMas.addEventListener('click', () => { verTodas = true; render(); });

    // ====== FORMULARIO ======
    const campo = id => $(id);
    const marcar = (el, ok) => { el.classList.toggle('is-invalid', !ok); return ok; };

    function validar() {
        const nom = marcar(campo('resNombre'), campo('resNombre').value.trim().length >= 2);
        const ape = marcar(campo('resApellido'), campo('resApellido').value.trim().length >= 2);
        const cal = !!form.querySelector('input[name="calificacion"]:checked');
        form.querySelector('.star-rating').classList.toggle('is-invalid-stars', !cal);
        $('resErrorEstrellas').hidden = cal;
        const com = marcar(campo('resComentario'), campo('resComentario').value.trim().length >= 10);
        return nom && ape && cal && com;
    }

    campo('resComentario').addEventListener('input', e => {
        $('resContador').textContent = e.target.value.length;
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        alerta.hidden = true;

        // Anti-bots: si el campo trampa viene lleno, fingimos éxito y no guardamos
        if (campo('resWeb').value) { exito(); return; }

        if (!validar()) return;

        // Límite sencillo: una reseña por navegador cada 60 segundos
        try {
            const ultima = Number(localStorage.getItem('ultimaResena') || 0);
            if (Date.now() - ultima < 60000) {
                mostrarError('Espera un momento antes de enviar otra reseña.');
                return;
            }
        } catch (_) { /* localStorage no disponible: se ignora */ }

        const datos = {
            nombre: campo('resNombre').value.trim(),
            apellido: campo('resApellido').value.trim(),
            calificacion: Number(form.querySelector('input[name="calificacion"]:checked').value),
            comentario: campo('resComentario').value.trim()
        };

        const textoOriginal = btnEnviar.innerHTML;
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando…';

        try {
            const { error } = await db.from('resenas').insert([datos]);
            if (error) throw error;
            try { localStorage.setItem('ultimaResena', String(Date.now())); } catch (_) {}
            exito();
            cargar();
        } catch (err) {
            console.error('Error al guardar reseña:', err);
            mostrarError('No pudimos publicar tu reseña. Inténtalo de nuevo.');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = textoOriginal;
        }
    });

    function mostrarError(msg) {
        alerta.className = 'alert alert-danger small rounded-3 mt-3';
        alerta.textContent = msg;
        alerta.hidden = false;
    }

    function exito() {
        alerta.className = 'alert alert-success small rounded-3 mt-3';
        alerta.textContent = '¡Gracias por tu reseña!';
        alerta.hidden = false;
        setTimeout(() => {
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }, 1200);
    }

    // Limpiar el formulario cada vez que se cierra el modal
    modalEl.addEventListener('hidden.bs.modal', () => {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        form.querySelector('.star-rating').classList.remove('is-invalid-stars');
        $('resErrorEstrellas').hidden = true;
        $('resContador').textContent = '0';
        alerta.hidden = true;
    });

    cargar();
})();