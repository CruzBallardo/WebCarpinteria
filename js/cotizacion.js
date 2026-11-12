(() => {
    'use strict';

    // ====== ANIMACIÓN DE ENTRADA ======
    const animar = () => document.querySelectorAll('.cot-reveal').forEach(el => el.classList.add('cot-in'));
    requestAnimationFrame(() => requestAnimationFrame(animar));

    // ====== ELEMENTOS ======
    const form = document.getElementById('cotizacionForm');
    if (!form) return;

    const $ = id => document.getElementById(id);
    const nombre = $('cotNombre');
    const apellido = $('cotApellido');
    const telefono = $('cotTelefono');
    const correo = $('cotCorreo');
    const madera = $('cotMadera');
    const descripcion = $('cotDescripcion');
    const contador = $('cotContador');
    const errorDesc = document.querySelector('.cot-desc-error');
    const exito = $('cotExito');
    const btnEnviar = $('cotBtnEnviar');

    // Aviso de error de envío (se crea una sola vez)
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-danger rounded-3 small mt-3';
    alerta.setAttribute('role', 'alert');
    alerta.hidden = true;
    btnEnviar.insertAdjacentElement('afterend', alerta);

    // ====== CONTADOR ======
    descripcion.addEventListener('input', () => {
        contador.textContent = descripcion.value.length;
        if (descripcion.classList.contains('is-invalid')) validarDescripcion();
    });

    // ====== VALIDACIONES ======
    const soloDigitos = v => v.replace(/\D/g, '');

    function marcar(input, ok) {
        input.classList.toggle('is-invalid', !ok);
        input.classList.toggle('is-valid', ok);
        return ok;
    }

    const validarNombre = () => marcar(nombre, nombre.value.trim().length >= 2);
    const validarApellido = () => marcar(apellido, apellido.value.trim().length >= 2);
    const validarTelefono = () => marcar(telefono, soloDigitos(telefono.value).length >= 10);
    const validarCorreo = () => {
        const v = correo.value.trim();
        if (!v) { correo.classList.remove('is-invalid', 'is-valid'); return true; } // opcional
        return marcar(correo, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    };
    const validarDescripcion = () => {
        const ok = descripcion.value.trim().length >= 10;
        marcar(descripcion, ok);
        errorDesc.hidden = ok;
        return ok;
    };

    nombre.addEventListener('blur', validarNombre);
    apellido.addEventListener('blur', validarApellido);
    telefono.addEventListener('blur', validarTelefono);
    correo.addEventListener('blur', validarCorreo);
    descripcion.addEventListener('blur', validarDescripcion);

    // ====== ENVÍO A SUPABASE ======
    form.addEventListener('submit', async e => {
        e.preventDefault();
        alerta.hidden = true;

        const resultados = [
            validarNombre(), validarApellido(), validarTelefono(),
            validarCorreo(), validarDescripcion()
        ];

        if (resultados.includes(false)) {
            const primero = form.querySelector('.is-invalid');
            if (primero) { primero.scrollIntoView({ behavior: 'smooth', block: 'center' }); primero.focus({ preventScroll: true }); }
            return;
        }

        const datos = {
            nombre: nombre.value.trim(),
            apellido: apellido.value.trim(),
            telefono: soloDigitos(telefono.value),
            correo: correo.value.trim() || null,
            madera: madera.value || null,
            descripcion: descripcion.value.trim()
        };

        const textoOriginal = btnEnviar.innerHTML;
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando…';

        try {
            // Sin .select(): el visitante solo tiene permiso de insertar, no de leer
            const { error } = await db.from('cotizaciones').insert([datos]);
            if (error) throw error;
            mostrarExito(datos.nombre);
        } catch (err) {
            console.error('Error al guardar la cotización:', err);
            alerta.textContent = 'No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.';
            alerta.hidden = false;
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = textoOriginal;
        }
    });

    function mostrarExito(nom) {
        $('cotExitoNombre').textContent = nom;
        form.hidden = true;
        exito.hidden = false;
        exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    $('cotNueva').addEventListener('click', () => {
        form.reset();
        form.querySelectorAll('.is-valid, .is-invalid').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
        errorDesc.hidden = true;
        contador.textContent = '0';
        exito.hidden = true;
        form.hidden = false;
    });
})();