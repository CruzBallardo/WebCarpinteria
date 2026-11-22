(function () {
    const TEMAS = {
        ninguno:     { nombre: 'Normal',       desc: 'Sin efectos',             emoji: '🪵', colores: ['#212529', '#6c757d', '#dee2e6'], particulas: [], cantidad: 0 },
        navidad:     { nombre: 'Navideña',     desc: 'Nieve y estrellas',       emoji: '🎄', colores: ['#c0392b', '#1e8449', '#f4d03f'], particulas: ['❄', '❅', '❆', '✦', '⭐'], cantidad: 35 },
        halloween:   { nombre: 'Halloween',    desc: 'Calabazas y murciélagos', emoji: '🎃', colores: ['#e67e22', '#6c3483', '#212529'], particulas: ['🎃', '🦇', '👻', '🕸️'], cantidad: 22 },
        sanvalentin: { nombre: 'San Valentín', desc: 'Corazones y rosas',       emoji: '💖', colores: ['#e84393', '#fd79a8', '#fff0f6'], particulas: ['💗', '💖', '🌹', '✨'], cantidad: 25 },
        independencia: { nombre: 'Independencia', desc: 'Bandera y fuegos artificiales', emoji: 'MX', colores: ['#c0392b', '#27ae60', '#f4d03f'], particulas: ['🌮', '🌯', '🥑', '🌶️', '🌽', '🦅', '🎉', ''], cantidad: 30 }
    };

    const TABLA = 'personalizacion';
    const CLAVE = 'tema_sitio';

    const cliente = () => (typeof db !== 'undefined' && db && typeof db.from === 'function') ? db : null;

    let capa = null;
    let actual = 'ninguno';
    let refrescarPanel = null;

    const leerCache = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
    const escribirCache = v => { try { localStorage.setItem(CLAVE, v); } catch {} };

    function limpiarParticulas() {
        if (capa) { capa.remove(); capa = null; }
    }

    function crearParticulas(cfg) {
        limpiarParticulas();
        if (!cfg.particulas.length) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        capa = document.createElement('div');
        capa.className = 'tema-particulas';
        capa.setAttribute('aria-hidden', 'true');

        const n = window.innerWidth < 576 ? Math.round(cfg.cantidad / 2) : cfg.cantidad;
        for (let i = 0; i < n; i++) {
            const p = document.createElement('span');
            p.textContent = cfg.particulas[Math.floor(Math.random() * cfg.particulas.length)];
            p.style.left = Math.random() * 100 + 'vw';
            p.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
            p.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
            p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
            p.style.animationDuration = (9 + Math.random() * 10) + 's';
            p.style.animationDelay = (-Math.random() * 18) + 's';
            capa.appendChild(p);
        }
        document.body.appendChild(capa);
    }

    function aplicar(nombre) {
        if (!TEMAS[nombre]) nombre = 'ninguno';
        actual = nombre;
        document.documentElement.setAttribute('data-tema', nombre);
        if (document.body) crearParticulas(TEMAS[nombre]);
        else document.addEventListener('DOMContentLoaded', () => crearParticulas(TEMAS[nombre]));
        if (refrescarPanel) { try { refrescarPanel(); } catch (e) { console.error(e); } }
    }

    async function guardarEnBD(nombre) {
        const c = cliente();
        if (!c) throw new Error('No se encontró el cliente de Supabase.');
        const { error } = await c.from(TABLA).upsert({ id: 'tema', valor: nombre });
        if (error) throw error;
    }

    async function cargarDesdeBD() {
        const c = cliente();
        if (!c) { console.warn('Tema: no se encontró el cliente db'); return; }
        const { data, error } = await c.from(TABLA).select('valor').eq('id', 'tema').maybeSingle();
        if (error) { console.error('Tema: error al leer', error); return; }
        if (!data) { console.warn('Tema: no hay fila id = tema (o falta la política de lectura)'); return; }
        escribirCache(data.valor);
        if (data.valor !== actual) aplicar(data.valor);
    }

    window.Tema = { aplicar, TEMAS, get actual() { return actual; } };

    aplicar(leerCache() || 'ninguno');
    window.addEventListener('load', () => { cargarDesdeBD().catch(console.error); });

    /* ---------- Desplegable del panel admin ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        const lista = document.getElementById('temaOpciones');
        if (!lista) return;

        const toggleEmoji = document.getElementById('temaToggleEmoji');
        const toggleNombre = document.getElementById('temaToggleNombre');
        const preview = document.getElementById('temaPreview');
        const estado = document.getElementById('temaEstado');

        const puntos = cols => cols.map(c => `<i class="tema-dot" style="background:${c}"></i>`).join('');
        const aviso = (txt, tipo) => {
            if (estado) estado.innerHTML = `<div class="alert alert-${tipo} py-2 mt-3 mb-0">${txt}</div>`;
        };

        lista.innerHTML = Object.entries(TEMAS).map(([id, t]) => `
            <li>
                <button type="button" class="dropdown-item tema-item" data-tema-opcion="${id}">
                    <span class="tema-item-emoji">${t.emoji}</span>
                    <span class="tema-item-texto">
                        <strong>${t.nombre}</strong>
                        <small>${t.desc}</small>
                    </span>
                    <span class="tema-item-colores">${puntos(t.colores)}</span>
                </button>
            </li>`).join('');

        function pintarPreview() {
            const t = TEMAS[actual];
            if (toggleEmoji) toggleEmoji.textContent = t.emoji;
            if (toggleNombre) toggleNombre.textContent = t.nombre;

            lista.querySelectorAll('.tema-item').forEach(b =>
                b.classList.toggle('selected', b.dataset.temaOpcion === actual));

            if (preview) preview.setAttribute('data-tema', actual);

            const pPart = document.getElementById('temaPreviewParticulas');
            if (pPart) pPart.textContent = t.particulas.length ? t.particulas.join('  ') : 'Sin partículas';

            const pCol = document.getElementById('temaPreviewColores');
            if (pCol) pCol.innerHTML = puntos(t.colores);
        }
        refrescarPanel = pintarPreview;

        lista.addEventListener('click', async e => {
            const b = e.target.closest('[data-tema-opcion]');
            if (!b) return;
            const anterior = actual;
            const elegido = b.dataset.temaOpcion;

            aplicar(elegido);
            aviso('Publicando tema…', 'info');
            try {
                await guardarEnBD(elegido);
                escribirCache(elegido);
                aviso('Tema publicado: lo verán todos los visitantes.', 'success');
            } catch (err) {
                console.error(err);
                aplicar(anterior);
                aviso('No se pudo guardar: ' + (err.message || 'error desconocido'), 'danger');
            }
        });

        pintarPreview();
    });
})();