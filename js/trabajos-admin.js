(() => {
    'use strict';

    const grid = document.getElementById('galeriaTrabajos');
    if (!grid) return;

    const $ = id => document.getElementById(id);
    const modalEl = $('modalTrabajo');
    const modal = new bootstrap.Modal(modalEl);

    const titulo = $('trabajoTitulo');
    const foto = $('trabajoFoto');
    const preview = $('trabajoPreview');
    const alerta = $('trabajoAlerta');
    const btnGuardar = $('btnGuardarTrabajo');

    const BUCKET = 'trabajos';
    const MAX_BYTES = 5 * 1024 * 1024;   // límite del bucket
    const MAX_LADO = 1600;               // las fotos se reducen a este tamaño antes de subirlas

    let trabajos = [];
    let editando = null;                 // trabajo en edición (null = nuevo)

    // ====== UTILIDADES ======
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const urlFoto = ruta => db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;

    const uuid = () => (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    // Reduce y convierte a JPG: fotos de celular de 8 MB pasan a ~300 KB
    function comprimir(archivo) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(archivo);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * escala);
                c.height = Math.round(img.height * escala);
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#fff';                       // PNG con transparencia → fondo blanco
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.85);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')); };
            img.src = url;
        });
    }

    // ====== CARGAR Y MOSTRAR ======
    async function cargar() {
        const { data, error } = await db
            .from('trabajos').select('*').order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            grid.innerHTML = '<div class="col-12 text-center text-danger py-5">No se pudieron cargar los trabajos.</div>';
            return;
        }
        trabajos = data || [];
        render();
    }

    function render() {
        if (!trabajos.length) {
            grid.innerHTML = '<div class="col-12"><div class="border rounded p-5 text-center text-secondary">Aún no hay trabajos publicados.</div></div>';
            return;
        }

        grid.innerHTML = trabajos.map(t => `
            <div class="col-12 col-sm-6 col-lg-4">
                <div class="border rounded-4 overflow-hidden h-100 d-flex flex-column bg-body">
                    <div class="ratio ratio-4x3 bg-body-tertiary">
                        <img src="${esc(urlFoto(t.imagen))}" alt="${esc(t.titulo)}" loading="lazy" class="object-fit-cover">
                    </div>
                    <div class="p-3 d-flex flex-column gap-3 flex-grow-1">
                        <div class="fw-semibold text-break">${esc(t.titulo)}</div>
                        <div class="d-flex gap-2 mt-auto">
                            <button type="button" class="btn btn-outline-secondary btn-sm flex-fill" data-editar="${t.id}">
                                <i class="fa-solid fa-pen me-1"></i> Editar
                            </button>
                            <button type="button" class="btn btn-outline-danger btn-sm" data-eliminar="${t.id}" aria-label="Eliminar trabajo" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`).join('');
    }

    // ====== MODAL (agregar / editar) ======
    function mostrarError(msg) { alerta.textContent = msg; alerta.hidden = false; }

    function abrirModal(t) {
        editando = t || null;
        alerta.hidden = true;
        titulo.classList.remove('is-invalid');
        foto.classList.remove('is-invalid');
        foto.value = '';

        $('modalTrabajoTitulo').textContent = t ? 'Editar trabajo' : 'Nuevo trabajo';
        $('trabajoFotoAyuda').textContent = t
            ? 'Déjalo vacío para conservar la foto actual.'
            : 'Obligatoria · JPG, PNG o WEBP.';
        btnGuardar.textContent = t ? 'Guardar cambios' : 'Publicar trabajo';
        titulo.value = t ? t.titulo : '';

        if (t) { preview.src = urlFoto(t.imagen); preview.classList.remove('d-none'); }
        else { preview.removeAttribute('src'); preview.classList.add('d-none'); }

        modal.show();
    }

    foto.addEventListener('change', () => {
        const f = foto.files[0];
        alerta.hidden = true;
        foto.classList.remove('is-invalid');
        if (!f) return;
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
            foto.value = '';
            foto.classList.add('is-invalid');
            return mostrarError('Formato no permitido. Usa JPG, PNG o WEBP.');
        }
        preview.src = URL.createObjectURL(f);
        preview.classList.remove('d-none');
    });

    // ====== GUARDAR ======
    async function guardar() {
        alerta.hidden = true;
        const nombre = titulo.value.trim();
        const archivo = foto.files[0];

        titulo.classList.toggle('is-invalid', nombre.length < 2);
        if (nombre.length < 2) return mostrarError('Escribe un título de al menos 2 caracteres.');
        if (!editando && !archivo) {
            foto.classList.add('is-invalid');
            return mostrarError('Agrega una fotografía del trabajo.');
        }

        const original = btnGuardar.innerHTML;
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando…';

        let rutaNueva = null;
        try {
            // 1) Subir la foto nueva (si hay)
            if (archivo) {
                let blob;
                try { blob = await comprimir(archivo); }
                catch (_) { throw new Error('No se pudo leer la imagen. Prueba con otra en JPG, PNG o WEBP.'); }
                if (blob.size > MAX_BYTES) throw new Error('La imagen sigue pesando más de 5 MB. Usa una más pequeña.');

                rutaNueva = `${uuid()}.jpg`;
                const { error: errUp } = await db.storage.from(BUCKET)
                    .upload(rutaNueva, blob, { contentType: 'image/jpeg', upsert: false });
                if (errUp) throw errUp;
            }

            // 2) Guardar en la tabla
            if (editando) {
                const cambios = { titulo: nombre };
                if (rutaNueva) cambios.imagen = rutaNueva;
                const { error } = await db.from('trabajos').update(cambios).eq('id', editando.id);
                if (error) throw error;
                // Foto reemplazada → borrar la anterior (si falla, no pasa nada)
                if (rutaNueva) db.storage.from(BUCKET).remove([editando.imagen]).catch(() => {});
            } else {
                const { error } = await db.from('trabajos').insert([{ titulo: nombre, imagen: rutaNueva }]);
                if (error) throw error;
            }

            modal.hide();
            await cargar();
        } catch (err) {
            console.error(err);
            // Si la foto ya se había subido pero falló el guardado, se limpia
            if (rutaNueva) db.storage.from(BUCKET).remove([rutaNueva]).catch(() => {});
            mostrarError(err.message && !err.status && !err.statusCode && !err.code
                ? err.message
                : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = original;
            btnGuardar.textContent = editando ? 'Guardar cambios' : 'Publicar trabajo';
        }
    }

    // ====== ELIMINAR ======
    async function eliminar(id) {
        const t = trabajos.find(x => x.id === id);
        if (!t) return;
        if (!confirm(`¿Eliminar "${t.titulo}" de la galería? Esta acción no se puede deshacer.`)) return;

        const { error } = await db.from('trabajos').delete().eq('id', id);
        if (error) {
            console.error(error);
            return alert('No se pudo eliminar el trabajo. Intenta de nuevo.');
        }
        db.storage.from(BUCKET).remove([t.imagen]).catch(() => {});
        trabajos = trabajos.filter(x => x.id !== id);
        render();
    }

    // ====== EVENTOS ======
    $('btnNuevoTrabajo').addEventListener('click', () => abrirModal(null));
    btnGuardar.addEventListener('click', guardar);
    $('formTrabajo').addEventListener('submit', e => { e.preventDefault(); guardar(); });

    grid.addEventListener('click', e => {
        const ed = e.target.closest('[data-editar]');
        const del = e.target.closest('[data-eliminar]');
        if (ed) abrirModal(trabajos.find(x => x.id === ed.dataset.editar));
        if (del) eliminar(del.dataset.eliminar);
    });

    cargar();
})();