(() => {
    'use strict';

    // ====== ANIMACIÓN DE ENTRADA ======
    const animar = () => document.querySelectorAll('.cot-reveal').forEach(el => el.classList.add('cot-in'));
    requestAnimationFrame(() => requestAnimationFrame(animar));

    const form = document.getElementById('facturaForm');
    if (!form) return;

    const $ = id => document.getElementById(id);
    const ticket = $('facTicket');
    const fecha = $('facFecha');
    const archivo = $('facArchivo');
    const rfc = $('facRfc');
    const razon = $('facRazon');
    const cp = $('facCp');
    const regimen = $('facRegimen');
    const uso = $('facUso');
    const correo = $('facCorreo');
    const privacidad = $('facPrivacidad');
    const confirma = $('facConfirma');
    const btn = $('facBtnEnviar');
    const alerta = $('facAlerta');
    const exito = $('facExito');

    const MAX_BYTES = 5 * 1024 * 1024;
    const EXT_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];

    // La fecha de compra no puede ser futura
    const hoy = new Date();
    const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    fecha.max = hoyISO;

    // ====== FORMATO EN VIVO ======
    rfc.addEventListener('input', () => {
        rfc.value = rfc.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');
    });
    cp.addEventListener('input', () => {
        cp.value = cp.value.replace(/\D/g, '');
    });

    // ====== VALIDACIONES ======
    function marcar(el, ok) {
        el.classList.toggle('is-invalid', !ok);
        el.classList.toggle('is-valid', ok);
        return ok;
    }

    const vTicket = () => marcar(ticket, ticket.value.trim().length >= 1);
    const vFecha = () => {
        const ok = !!fecha.value && fecha.value <= hoyISO;
        $('facFechaError').textContent = fecha.value > hoyISO
            ? 'La fecha no puede ser futura.' : 'Elige la fecha de tu compra.';
        return marcar(fecha, ok);
    };
    const vArchivo = () => {
        const f = archivo.files[0];
        if (!f) { archivo.classList.remove('is-invalid', 'is-valid'); return true; } // opcional
        const ext = f.name.split('.').pop().toLowerCase();
        let msg = '';
        if (!EXT_PERMITIDAS.includes(ext)) msg = 'Formato no permitido. Usa una foto (JPG, PNG, WEBP) o un PDF.';
        else if (f.size > MAX_BYTES) msg = 'El archivo pesa más de 5 MB.';
        $('facArchivoError').textContent = msg;
        return marcar(archivo, !msg);
    };
    const vRfc = () => marcar(rfc, /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc.value));
    const vRazon = () => marcar(razon, razon.value.trim().length >= 2);
    const vCp = () => marcar(cp, /^\d{5}$/.test(cp.value));
    const vRegimen = () => marcar(regimen, !!regimen.value);
    const vUso = () => marcar(uso, !!uso.value);
    const vCorreo = () => marcar(correo, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim()));
    const vPriv = () => { privacidad.classList.toggle('is-invalid', !privacidad.checked); return privacidad.checked; };
    const vConf = () => { confirma.classList.toggle('is-invalid', !confirma.checked); return confirma.checked; };

    ticket.addEventListener('blur', vTicket);
    fecha.addEventListener('change', vFecha);
    archivo.addEventListener('change', vArchivo);
    rfc.addEventListener('blur', vRfc);
    razon.addEventListener('blur', vRazon);
    cp.addEventListener('blur', vCp);
    regimen.addEventListener('change', vRegimen);
    uso.addEventListener('change', vUso);
    correo.addEventListener('blur', vCorreo);
    privacidad.addEventListener('change', vPriv);
    confirma.addEventListener('change', vConf);

    // ====== UTILIDADES ======
    const uuid = () => (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    function mostrarError(msg) {
        alerta.textContent = msg;
        alerta.hidden = false;
    }

    // ====== ENVÍO ======
    form.addEventListener('submit', async e => {
        e.preventDefault();
        alerta.hidden = true;

        // Anti-bots: si el campo trampa viene lleno, fingimos éxito y no guardamos
        if ($('facWeb').value) { mostrarExito('', ''); return; }

        const resultados = [
            vTicket(), vFecha(), vArchivo(), vRfc(), vRazon(),
            vCp(), vRegimen(), vUso(), vCorreo(), vPriv(), vConf()
        ];
        if (resultados.includes(false)) {
            const primero = form.querySelector('.is-invalid');
            if (primero) {
                primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
                primero.focus({ preventScroll: true });
            }
            return;
        }

        const id = uuid();
        const textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando…';

        try {
            // 1) Subir ticket (si lo adjuntó)
            let rutaTicket = null;
            const f = archivo.files[0];
            if (f) {
                const ext = f.name.split('.').pop().toLowerCase();
                rutaTicket = `${id}/ticket.${ext}`;
                const { error: errUp } = await db.storage
                    .from('tickets')
                    .upload(rutaTicket, f, { upsert: false, contentType: f.type || undefined });
                if (errUp) throw errUp;
            }

            // 2) Guardar la solicitud
            const datos = {
                id,
                ticket: ticket.value.trim(),
                fecha_compra: fecha.value,
                ticket_archivo: rutaTicket,
                rfc: rfc.value,
                razon_social: razon.value.trim(),
                cp_fiscal: cp.value,
                regimen_fiscal: regimen.value,
                uso_cfdi: uso.value,
                correo: correo.value.trim(),
                acepto_privacidad: true,
                datos_confirmados: true
            };
            const { error } = await db.from('facturas').insert([datos]);
            if (error) throw error;

            mostrarExito(datos.correo, id);
        } catch (err) {
            console.error('Error al enviar la solicitud de factura:', err);
            mostrarError('No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    });

    function mostrarExito(mail, id) {
        $('facExitoCorreo').textContent = mail;
        $('facFolio').textContent = id ? id.slice(0, 8).toUpperCase() : '—';
        form.hidden = true;
        exito.hidden = false;
        exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    $('facNueva').addEventListener('click', () => {
        form.reset();
        form.querySelectorAll('.is-valid, .is-invalid').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
        exito.hidden = true;
        form.hidden = false;
    });
})();