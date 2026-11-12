(() => {
    'use strict';

    const tbody = document.getElementById('tbodyCotizaciones');
    if (!tbody) return;

    const statEl = document.getElementById('statCotizaciones');
    const filtroEl = document.getElementById('filtroCotizaciones');
    const btnRefrescar = document.getElementById('btnRefrescarCot');
    const modalEl = document.getElementById('modalCotizacion');
    const modal = new bootstrap.Modal(modalEl);

    let cotizaciones = [];
    let abierta = null; // id de la cotización abierta en el modal

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const fecha = iso => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

    const badge = c => c.atendida
        ? '<span class="badge text-bg-success">Atendida</span>'
        : '<span class="badge text-bg-warning">Pendiente</span>';

    // ====== CARGAR ======
    async function cargar() {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-5">Cargando…</td></tr>';
        const { data, error } = await db
            .from('cotizaciones')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-5">No se pudieron cargar las cotizaciones.</td></tr>';
            return;
        }
        cotizaciones = data || [];
        render();
    }

    // ====== RENDER ======
    function render() {
        const pendientes = cotizaciones.filter(c => !c.atendida).length;
        if (statEl) statEl.textContent = pendientes;

        const f = filtroEl.value;
        const lista = cotizaciones.filter(c =>
            f === 'todas' ? true : f === 'atendida' ? c.atendida : !c.atendida);

        if (!lista.length) {
            const msg = f === 'pendiente' ? 'No hay cotizaciones pendientes.'
                      : f === 'atendida' ? 'Aún no hay cotizaciones atendidas.'
                      : 'Aún no hay cotizaciones.';
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-5">${msg}</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(c => `
            <tr>
                <td>
                    <div class="fw-semibold">${esc(c.nombre)} ${esc(c.apellido)}</div>
                    <div class="small text-secondary">${esc(c.telefono)}</div>
                </td>
                <td style="max-width: 280px;">
                    <div class="text-truncate">${esc(c.descripcion)}</div>
                    ${c.madera ? `<span class="small text-secondary">Madera: ${esc(c.madera)}</span>` : ''}
                </td>
                <td class="small text-nowrap">${fecha(c.created_at)}</td>
                <td>${badge(c)}</td>
                <td class="text-nowrap">
                    <button class="btn btn-sm btn-outline-secondary" data-ver="${c.id}" title="Ver detalle">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-sm ${c.atendida ? 'btn-outline-warning' : 'btn-outline-success'}"
                            data-toggle="${c.id}"
                            title="${c.atendida ? 'Marcar como pendiente' : 'Marcar como atendida'}">
                        <i class="fa-solid ${c.atendida ? 'fa-rotate-left' : 'fa-check'}"></i>
                    </button>
                </td>
            </tr>`).join('');
    }

    // ====== CAMBIAR ESTADO ======
    async function cambiarEstado(id) {
        const c = cotizaciones.find(x => x.id === id);
        if (!c) return;
        const nuevo = !c.atendida;

        const { error } = await db.from('cotizaciones').update({ atendida: nuevo }).eq('id', id);
        if (error) {
            console.error(error);
            alert('No se pudo actualizar el estado. Intenta de nuevo.');
            return;
        }
        c.atendida = nuevo;
        render();
        if (abierta === id) pintarModal(c);
    }

    // ====== DETALLE ======
    function pintarModal(c) {
        const tel = c.telefono.length === 10 ? '52' + c.telefono : c.telefono;
        document.getElementById('cotDetalle').innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h3 class="h5 fw-bold mb-0">${esc(c.nombre)} ${esc(c.apellido)}</h3>
                    <div class="small text-secondary">${fecha(c.created_at)}</div>
                </div>
                ${badge(c)}
            </div>
            <dl class="row mb-3">
                <dt class="col-sm-4">Teléfono</dt>
                <dd class="col-sm-8"><a href="tel:${esc(c.telefono)}">${esc(c.telefono)}</a></dd>
                <dt class="col-sm-4">Correo</dt>
                <dd class="col-sm-8">${c.correo ? `<a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a>` : '<span class="text-secondary">No proporcionado</span>'}</dd>
                <dt class="col-sm-4">Tipo de madera</dt>
                <dd class="col-sm-8">${c.madera ? esc(c.madera) : '<span class="text-secondary">Sin preferencia</span>'}</dd>
            </dl>
            <h4 class="h6 fw-semibold">Descripción del proyecto</h4>
            <p class="border rounded p-3 mb-0" style="white-space: pre-wrap;">${esc(c.descripcion)}</p>
            <div class="mt-3">
                <a class="btn btn-sm btn-outline-success" target="_blank" rel="noopener"
                   href="https://wa.me/${esc(tel)}?text=${encodeURIComponent('Hola ' + c.nombre + ', te escribimos de Hermanos Barrientos sobre tu cotización.')}">
                    <i class="fa-brands fa-whatsapp me-1"></i> Responder por WhatsApp
                </a>
            </div>`;

        const btn = document.getElementById('btnEstadoModal');
        btn.className = 'btn btn-sm ' + (c.atendida ? 'btn-outline-warning' : 'btn-success');
        btn.innerHTML = c.atendida
            ? '<i class="fa-solid fa-rotate-left me-1"></i> Marcar como pendiente'
            : '<i class="fa-solid fa-check me-1"></i> Marcar como atendida';
    }

    function abrirDetalle(id) {
        const c = cotizaciones.find(x => x.id === id);
        if (!c) return;
        abierta = id;
        pintarModal(c);
        modal.show();
    }

    // ====== EVENTOS ======
    tbody.addEventListener('click', e => {
        const ver = e.target.closest('[data-ver]');
        const tog = e.target.closest('[data-toggle]');
        if (ver) abrirDetalle(Number(ver.dataset.ver));
        if (tog) cambiarEstado(Number(tog.dataset.toggle));
    });

    document.getElementById('btnEstadoModal').addEventListener('click', () => {
        if (abierta !== null) cambiarEstado(abierta);
    });
    modalEl.addEventListener('hidden.bs.modal', () => { abierta = null; });

    filtroEl.addEventListener('change', render);
    btnRefrescar.addEventListener('click', cargar);

    cargar();
})();