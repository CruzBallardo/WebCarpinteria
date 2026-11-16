(() => {
    'use strict';

    const tbody = document.getElementById('tbodyFacturas');
    if (!tbody) return;

    const $ = id => document.getElementById(id);
    const filtroEl = $('filtroFacturas');
    const modalEl = $('modalFactura');
    const modal = new bootstrap.Modal(modalEl);
    const detalleEl = $('facDetalle');

    const BUCKET_TICKETS = 'tickets';
    const BUCKET_EMITIDAS = 'facturas-emitidas';
    const MAX_BYTES = 5 * 1024 * 1024;
    const URL_SAT = 'https://cfdiau.sat.gob.mx/nidp/wsfed/ep?id=SATUPCFDiCon&sid=0&option=credential&sid=0';

    const ESTADOS = {
        pendiente:  { txt: 'Pendiente',  cls: 'text-bg-warning' },
        en_proceso: { txt: 'En proceso', cls: 'text-bg-primary' },
        finalizada: { txt: 'Finalizada', cls: 'text-bg-success' }
    };

    let facturas = [];
    let abierta = null; // id de la solicitud abierta en el modal

    // ====== UTILIDADES ======
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const folio = f => f.id.slice(0, 8).toUpperCase();
    const fechaHora = iso => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const fechaSola = iso => {                       // 'YYYY-MM-DD' sin desfase de zona horaria
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('es-MX', { dateStyle: 'medium' });
    };
    const badge = e => `<span class="badge ${ESTADOS[e].cls}">${ESTADOS[e].txt}</span>`;

    // ====== CARGAR ======
    async function cargar() {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-5">Cargando…</td></tr>';
        const { data, error } = await db
            .from('facturas').select('*').order('created_at', { ascending: false }).limit(500);

        if (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5">No se pudieron cargar las solicitudes.</td></tr>';
            return;
        }
        facturas = data || [];
        render();
    }

    // ====== TABLA ======
    function render() {
        const pend = facturas.filter(f => f.estado === 'pendiente').length;
        const proc = facturas.filter(f => f.estado === 'en_proceso').length;
        if ($('statFacturas')) $('statFacturas').textContent = pend + proc;
        if ($('statFacturasDetalle')) $('statFacturasDetalle').textContent = `${pend} pendiente${pend === 1 ? '' : 's'} · ${proc} en proceso`;

        const fl = filtroEl.value;
        const lista = facturas.filter(f => fl === 'todas' || f.estado === fl);

        if (!lista.length) {
            const msg = { pendiente: 'No hay facturas pendientes.', en_proceso: 'No hay facturas en proceso.',
                          finalizada: 'Aún no hay facturas finalizadas.', todas: 'Aún no hay solicitudes de factura.' }[fl];
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-5">${msg}</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(f => `
            <tr>
                <td class="text-nowrap"><code>${folio(f)}</code></td>
                <td>
                    <div class="fw-semibold">${esc(f.razon_social)}</div>
                    <div class="small text-secondary">${esc(f.rfc)}</div>
                </td>
                <td>
                    <div>Ticket ${esc(f.ticket)}</div>
                    <div class="small text-secondary">${fechaSola(f.fecha_compra)}</div>
                </td>
                <td class="small text-nowrap">${fechaHora(f.created_at)}</td>
                <td>${badge(f.estado)}</td>
                <td class="text-nowrap">
                    <button class="btn btn-sm btn-outline-secondary" data-ver="${f.id}" title="Ver detalle">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    ${f.estado === 'pendiente' ? `
                    <button class="btn btn-sm btn-outline-primary" data-iniciar="${f.id}" title="Marcar en proceso">
                        <i class="fa-solid fa-play"></i>
                    </button>` : ''}
                </td>
            </tr>`).join('');
    }

    // ====== DETALLE ======
    const fila = (label, valor) => `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2 gap-2">
            <div class="min-w-0">
                <div class="small text-secondary">${label}</div>
                <div class="fw-semibold text-break">${esc(valor)}</div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" data-copy="${esc(valor)}" title="Copiar">
                <i class="fa-regular fa-copy"></i>
            </button>
        </div>`;

    const btnArchivo = (bucket, ruta, texto, icono) => `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bucket="${bucket}" data-path="${esc(ruta)}">
            <i class="${icono} me-1"></i> ${texto}
        </button>`;

    function panelGestion(f) {
        if (f.estado === 'pendiente') {
            return `
                <p class="text-secondary mb-3">Aún no has iniciado esta factura.</p>
                <button type="button" class="btn btn-primary btn-sm" data-accion="en_proceso">
                    <i class="fa-solid fa-play me-1"></i> Marcar en proceso
                </button>`;
        }

        if (f.estado === 'en_proceso') {
            const actual = (ruta, tipo) => ruta
                ? `<div class="form-text">Ya hay un ${tipo} cargado; si eliges otro, lo reemplazará.</div>` : '';
            return `
                <p class="text-secondary">Emite la factura en el portal del SAT con los datos de arriba y adjunta el resultado para finalizar.</p>
                <a href="${URL_SAT}" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-sm mb-3">
                    <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Abrir portal del SAT
                </a>
                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="facFilePdf" class="form-label small fw-semibold mb-1">Factura en PDF</label>
                        <input type="file" id="facFilePdf" class="form-control form-control-sm" accept=".pdf,application/pdf">
                        ${actual(f.factura_pdf, 'PDF')}
                    </div>
                    <div class="col-md-6">
                        <label for="facFileXml" class="form-label small fw-semibold mb-1">Factura en XML</label>
                        <input type="file" id="facFileXml" class="form-control form-control-sm" accept=".xml,text/xml,application/xml">
                        ${actual(f.factura_xml, 'XML')}
                    </div>
                </div>
                <div class="form-text mb-3">Adjunta al menos uno (PDF, XML o ambos) · máx. 5 MB cada uno.</div>
                <div id="facAlertaModal" class="alert alert-danger small py-2" role="alert" hidden></div>
                <div class="d-flex flex-wrap gap-2">
                    <button type="button" class="btn btn-outline-secondary btn-sm" data-accion="pendiente">
                        <i class="fa-solid fa-rotate-left me-1"></i> Regresar a pendiente
                    </button>
                    <button type="button" class="btn btn-success btn-sm" id="btnFinalizar" data-accion="finalizar">
                        <i class="fa-solid fa-check me-1"></i> Finalizar solicitud
                    </button>
                </div>`;
        }

        // finalizada
        const asunto = encodeURIComponent('Tu factura - Hermanos Barrientos');
        const cuerpo = encodeURIComponent(`Hola, te compartimos la factura correspondiente a tu compra (ticket ${f.ticket}).\n\nSaludos,\nHermanos Barrientos`);
        return `
            <p class="text-secondary mb-2">Finalizada el ${fechaHora(f.finalizada_at || f.created_at)}.</p>
            <div class="d-flex flex-wrap gap-2 mb-3">
                ${f.factura_pdf ? btnArchivo(BUCKET_EMITIDAS, f.factura_pdf, 'Ver PDF', 'fa-solid fa-file-pdf') : ''}
                ${f.factura_xml ? btnArchivo(BUCKET_EMITIDAS, f.factura_xml, 'Descargar XML', 'fa-solid fa-file-code') : ''}
            </div>
            <div class="d-flex flex-wrap gap-2">
                <a class="btn btn-outline-primary btn-sm" href="mailto:${esc(f.correo)}?subject=${asunto}&body=${cuerpo}">
                    <i class="fa-regular fa-envelope me-1"></i> Enviar por correo
                </a>
                <button type="button" class="btn btn-outline-warning btn-sm" data-accion="en_proceso" data-reabrir="1">
                    <i class="fa-solid fa-rotate-left me-1"></i> Reabrir
                </button>
            </div>
            <div class="form-text mt-2">El correo se abre sin adjuntos: descarga los archivos y adjúntalos antes de enviar.</div>`;
    }

    function pintarModal(f) {
        detalleEl.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h3 class="h5 fw-bold mb-0">Solicitud <code>${folio(f)}</code></h3>
                    <div class="small text-secondary">Recibida el ${fechaHora(f.created_at)}</div>
                </div>
                ${badge(f.estado)}
            </div>

            <div class="row g-3">
                <div class="col-md-5">
                    <div class="border rounded p-3 h-100">
                        <h4 class="h6 fw-semibold">Datos de compra</h4>
                        ${fila('Ticket / nota de venta', f.ticket)}
                        ${fila('Fecha de compra', fechaSola(f.fecha_compra))}
                        <div class="pt-3">
                            ${f.ticket_archivo
                                ? btnArchivo(BUCKET_TICKETS, f.ticket_archivo, 'Ver ticket adjunto', 'fa-solid fa-paperclip')
                                : '<span class="small text-secondary">El cliente no adjuntó ticket.</span>'}
                        </div>
                    </div>
                </div>
                <div class="col-md-7">
                    <div class="border rounded p-3 h-100">
                        <h4 class="h6 fw-semibold">Datos fiscales</h4>
                        ${fila('RFC', f.rfc)}
                        ${fila('Nombre o razón social', f.razon_social)}
                        ${fila('C.P. fiscal', f.cp_fiscal)}
                        ${fila('Régimen fiscal', f.regimen_fiscal)}
                        ${fila('Uso de CFDI', f.uso_cfdi)}
                        ${fila('Correo', f.correo)}
                    </div>
                </div>
            </div>

            <div class="border rounded p-3 mt-3">
                <h4 class="h6 fw-semibold">Gestión de la factura</h4>
                ${panelGestion(f)}
            </div>`;
    }

    function abrirDetalle(id) {
        const f = facturas.find(x => x.id === id);
        if (!f) return;
        abierta = id;
        pintarModal(f);
        modal.show();
    }

    // ====== ARCHIVOS (URLs firmadas: los buckets son privados) ======
    async function abrirArchivo(bucket, ruta) {
        const esXml = ruta.toLowerCase().endsWith('.xml');
        const w = esXml ? null : window.open('about:blank', '_blank');
        const { data, error } = await db.storage.from(bucket)
            .createSignedUrl(ruta, 120, esXml ? { download: true } : undefined);

        if (error || !data) {
            console.error(error);
            if (w) w.close();
            alert('No se pudo abrir el archivo.');
            return;
        }
        if (w) w.location.href = data.signedUrl;
        else window.location.href = data.signedUrl;
    }

    // ====== CAMBIOS DE ESTADO ======
    async function cambiarEstado(f, nuevo) {
        const cambios = { estado: nuevo };
        if (nuevo !== 'finalizada') cambios.finalizada_at = null;

        const { error } = await db.from('facturas').update(cambios).eq('id', f.id);
        if (error) {
            console.error(error);
            alert('No se pudo actualizar el estado. Intenta de nuevo.');
            return false;
        }
        Object.assign(f, cambios);
        render();
        if (abierta === f.id) pintarModal(f);
        return true;
    }

    async function subir(f, archivo, ext) {
        const ruta = `${f.id}/${Date.now()}-factura.${ext}`;
        const { error } = await db.storage.from(BUCKET_EMITIDAS).upload(ruta, archivo, { upsert: false });
        if (error) throw error;
        return ruta;
    }

    async function finalizar(f) {
        const alertaEl = $('facAlertaModal');
        const mostrar = m => { alertaEl.textContent = m; alertaEl.hidden = false; };
        alertaEl.hidden = true;

        const pdf = $('facFilePdf').files[0];
        const xml = $('facFileXml').files[0];

        if (!pdf && !xml && !f.factura_pdf && !f.factura_xml) return mostrar('Adjunta al menos el PDF o el XML de la factura.');
        if (pdf && !pdf.name.toLowerCase().endsWith('.pdf')) return mostrar('El archivo PDF no tiene formato .pdf.');
        if (xml && !xml.name.toLowerCase().endsWith('.xml')) return mostrar('El archivo XML no tiene formato .xml.');
        if ((pdf && pdf.size > MAX_BYTES) || (xml && xml.size > MAX_BYTES)) return mostrar('Cada archivo debe pesar máximo 5 MB.');

        const btn = $('btnFinalizar');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando…';

        try {
            const cambios = { estado: 'finalizada', finalizada_at: new Date().toISOString() };
            const viejos = [];

            if (pdf) { if (f.factura_pdf) viejos.push(f.factura_pdf); cambios.factura_pdf = await subir(f, pdf, 'pdf'); }
            if (xml) { if (f.factura_xml) viejos.push(f.factura_xml); cambios.factura_xml = await subir(f, xml, 'xml'); }

            const { error } = await db.from('facturas').update(cambios).eq('id', f.id);
            if (error) throw error;

            // Limpieza de archivos reemplazados (si falla, no pasa nada)
            if (viejos.length) db.storage.from(BUCKET_EMITIDAS).remove(viejos).catch(() => {});

            Object.assign(f, cambios);
            render();
            pintarModal(f);
        } catch (err) {
            console.error(err);
            mostrar('No se pudo guardar la factura. Revisa tu conexión e inténtalo de nuevo.');
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    // ====== EVENTOS ======
    tbody.addEventListener('click', e => {
        const ver = e.target.closest('[data-ver]');
        const ini = e.target.closest('[data-iniciar]');
        if (ver) abrirDetalle(ver.dataset.ver);
        if (ini) {
            const f = facturas.find(x => x.id === ini.dataset.iniciar);
            if (f) cambiarEstado(f, 'en_proceso');
        }
    });

    detalleEl.addEventListener('click', async e => {
        const f = facturas.find(x => x.id === abierta);
        if (!f) return;

        const copiar = e.target.closest('[data-copy]');
        if (copiar) {
            try {
                await navigator.clipboard.writeText(copiar.dataset.copy);
                const i = copiar.querySelector('i');
                i.className = 'fa-solid fa-check text-success';
                setTimeout(() => { i.className = 'fa-regular fa-copy'; }, 1200);
            } catch (_) { alert('No se pudo copiar. Selecciona el texto manualmente.'); }
            return;
        }

        const arch = e.target.closest('[data-bucket]');
        if (arch) return abrirArchivo(arch.dataset.bucket, arch.dataset.path);

        const acc = e.target.closest('[data-accion]');
        if (!acc) return;
        const a = acc.dataset.accion;

        if (a === 'finalizar') return finalizar(f);
        if (acc.dataset.reabrir && !confirm('¿Reabrir esta solicitud? Pasará a "En proceso" y se conservarán los archivos cargados.')) return;
        cambiarEstado(f, a);
    });

    modalEl.addEventListener('hidden.bs.modal', () => { abierta = null; });
    filtroEl.addEventListener('change', render);
    $('btnRefrescarFac').addEventListener('click', cargar);

    cargar();
})();