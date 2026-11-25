/* ==========================================================
   resenas_admin.js – Reseñas del panel (todo en un solo archivo)
   Parte 1: motor (buscador, filtros, orden, tabla, paginación)
   Parte 2: conexión con Supabase (tabla "resenas")
   ========================================================== */

/* ---------- Parte 1: motor ---------- */
/* ==========================================================
   Reseñas de clientes · Admin Carpintería Barrientos
   ----------------------------------------------------------
   USO (una sola vez, al iniciar el admin):

   ResenasAdmin.init({
       // Debe devolver un arreglo con TODAS las reseñas (visibles y ocultas)
       obtener: async () => await tuFuncionQueCargaResenas(),

       // Debe guardar el cambio de visibilidad con tu lógica actual
       cambiarVisibilidad: async (resena, visible) => { ... },

       // Debe borrar la reseña con tu lógica actual
       eliminar: async (resena) => { ... },

       // Opcional: si tus campos tienen otros nombres
       // mapear: (r) => ({ nombre: r.cliente, cal: r.estrellas, ... })
   });

   Cada función recibe el objeto ORIGINAL de la reseña, tal como
   lo devuelve `obtener`. Este módulo no toca la base de datos.
   ========================================================== */
(function (global) {
    'use strict';

    const LIMITE_COMENTARIO = 140;

    // [valor, texto del menú, texto corto para la etiqueta del botón]
    const OPCIONES = {
        vis: [
            ['todas', 'Todas'],
            ['visibles', 'Visibles'],
            ['ocultas', 'Ocultas'],
        ],
        cal: [
            ['todas', 'Todas las calificaciones'],
            ['1', '1 estrella', '1★'],
            ['2', '2 estrellas', '2★'],
            ['3', '3 estrellas', '3★'],
            ['4', '4 estrellas', '4★'],
            ['5', '5 estrellas', '5★'],
            ['pos', '4 y 5 estrellas (positivas)', '4–5★'],
            ['neg', '1 y 2 estrellas (negativas)', '1–2★'],
        ],
        fecha: [
            ['todas', 'Todas las fechas'],
            ['hoy', 'Hoy'],
            ['ayer', 'Ayer'],
            ['7d', 'Últimos 7 días', '7 días'],
            ['30d', 'Últimos 30 días', '30 días'],
            ['mes', 'Este mes'],
            ['mesAnt', 'Mes anterior', 'Mes ant.'],
            ['anio', 'Este año'],
            ['anioAnt', 'Año anterior', 'Año ant.'],
            ['custom', 'Fecha personalizada', 'Personalizada'],
        ],
        orden: [
            ['recientes', 'Más recientes'],
            ['antiguas', 'Más antiguas'],
            ['mejor', 'Mejor calificadas'],
            ['peor', 'Peor calificadas'],
        ],
    };

    const estadoInicial = () => ({
        q: '', vis: 'todas', cal: 'todas', fecha: 'todas',
        desde: '', hasta: '', orden: 'recientes', conComentarios: false,
    });

    /* ---------------------------------------------------------
       Lógica pura (sin DOM): normalizar, filtrar, ordenar, stats
       --------------------------------------------------------- */
    const pick = (o, ...claves) => {
        for (const k of claves) if (o[k] !== undefined && o[k] !== null) return o[k];
        return undefined;
    };

    const quitarAcentos = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    function aFecha(v) {
        if (v === undefined || v === null || v === '') return null;
        let d;
        if (v instanceof Date) d = v;
        else if (typeof v.toDate === 'function') d = v.toDate();                       // Firestore Timestamp
        else if (typeof v === 'object' && 'seconds' in v) d = new Date(v.seconds * 1000);
        else if (typeof v === 'number') d = new Date(v < 1e12 ? v * 1000 : v);
        else {
            const s = String(v).trim();
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);                              // evita desfase por zona horaria
            d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
        }
        return isNaN(d.getTime()) ? null : d;
    }

    function leerVisible(o) {
        for (const k of ['visible', 'publicada', 'publicado', 'activa', 'mostrar']) {
            if (o[k] !== undefined && o[k] !== null) return !(o[k] === false || o[k] === 0 || o[k] === 'false' || o[k] === '0');
        }
        for (const k of ['oculta', 'oculto', 'hidden']) {
            if (o[k] !== undefined && o[k] !== null) return (o[k] === false || o[k] === 0 || o[k] === 'false' || o[k] === '0');
        }
        return true;
    }

    function normalizar(raw, i, mapear) {
        const base = {
            id: pick(raw, 'id', '_id', 'uid') ?? i,
            nombre: pick(raw, 'nombre', 'cliente', 'autor', 'name') ?? '',
            cal: Number(pick(raw, 'calificacion', 'estrellas', 'rating', 'puntuacion', 'cal')),
            comentario: pick(raw, 'comentario', 'texto', 'mensaje', 'opinion', 'comment') ?? '',
            fecha: pick(raw, 'fecha', 'createdAt', 'created_at', 'creado', 'timestamp'),
            visible: leerVisible(raw),
        };
        const r = Object.assign(base, mapear ? mapear(raw) : {});
        const cal = Math.round(Number(r.cal));
        return {
            id: r.id,
            nombre: String(r.nombre || '').trim() || 'Anónimo',
            cal: cal >= 1 && cal <= 5 ? cal : 0,
            comentario: String(r.comentario || '').trim(),
            fecha: aFecha(r.fecha),
            visible: !!r.visible,
            raw,
        };
    }

    const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

    // Devuelve [inicio, fin) o null. En "custom" cualquiera de los extremos puede faltar.
    function rangoFecha(clave, ahora, desde, hasta) {
        const hoy = inicioDia(ahora), y = ahora.getFullYear(), m = ahora.getMonth();
        switch (clave) {
            case 'hoy': return [hoy, sumarDias(hoy, 1)];
            case 'ayer': return [sumarDias(hoy, -1), hoy];
            case '7d': return [sumarDias(hoy, -6), sumarDias(hoy, 1)];
            case '30d': return [sumarDias(hoy, -29), sumarDias(hoy, 1)];
            case 'mes': return [new Date(y, m, 1), new Date(y, m + 1, 1)];
            case 'mesAnt': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
            case 'anio': return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
            case 'anioAnt': return [new Date(y - 1, 0, 1), new Date(y, 0, 1)];
            case 'custom': {
                let a = aFecha(desde), b = aFecha(hasta);
                if (a && b && a > b) [a, b] = [b, a];
                return [a, b ? sumarDias(b, 1) : null];
            }
            default: return null;
        }
    }

    function coincideCalificacion(cal, filtro) {
        if (filtro === 'todas') return true;
        if (filtro === 'pos') return cal >= 4;
        if (filtro === 'neg') return cal >= 1 && cal <= 2;
        return cal === Number(filtro);
    }

    function filtrar(datos, st, ahora = new Date()) {
        const q = quitarAcentos(st.q);
        const rango = rangoFecha(st.fecha, ahora, st.desde, st.hasta);
        const usaRango = rango && (rango[0] || rango[1]);

        return datos.filter((r) => {
            if (q && !(quitarAcentos(r.nombre).includes(q) || quitarAcentos(r.comentario).includes(q))) return false;
            if (st.vis === 'visibles' && !r.visible) return false;
            if (st.vis === 'ocultas' && r.visible) return false;
            if (!coincideCalificacion(r.cal, st.cal)) return false;
            if (st.conComentarios && !r.comentario) return false;
            if (usaRango) {
                if (!r.fecha) return false;
                if (rango[0] && r.fecha < rango[0]) return false;
                if (rango[1] && r.fecha >= rango[1]) return false;
            }
            return true;
        });
    }

    function ordenar(lista, criterio) {
        const t = (r) => (r.fecha ? r.fecha.getTime() : 0);
        const porFechaDesc = (a, b) => t(b) - t(a);
        const copia = lista.slice(); // no altera los datos originales
        switch (criterio) {
            case 'antiguas': return copia.sort((a, b) => t(a) - t(b));
            case 'mejor': return copia.sort((a, b) => b.cal - a.cal || porFechaDesc(a, b));
            case 'peor': return copia.sort((a, b) => a.cal - b.cal || porFechaDesc(a, b));
            default: return copia.sort(porFechaDesc);
        }
    }

    function calcularStats(datos) {
        const total = datos.length;
        const conCal = datos.filter((r) => r.cal >= 1);
        const promedio = conCal.length ? conCal.reduce((s, r) => s + r.cal, 0) / conCal.length : null;
        const positivas = datos.filter((r) => r.cal >= 4).length;
        const negativas = datos.filter((r) => r.cal >= 1 && r.cal <= 2).length;
        const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
        return { total, promedio, positivas, negativas, pctPos: pct(positivas), pctNeg: pct(negativas) };
    }

    function numerosPagina(actual, total) {
        const set = new Set([1, total, actual - 1, actual, actual + 1]);
        const arr = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
        const out = [];
        arr.forEach((n, i) => { if (i && n - arr[i - 1] > 1) out.push('…'); out.push(n); });
        return out;
    }

    /* ---------------------------------------------------------
       Interfaz
       --------------------------------------------------------- */
    let cfg, root, datos = [], cargado = false;
    let state = estadoInicial();
    let pagina = 1, porPagina = 10;
    const expandidas = new Set();
    let tooltips = [];

    const $ = (s, r = root) => r.querySelector(s);
    const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtFecha = (d) => (d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
    const esInicial = () => JSON.stringify(state) === JSON.stringify(estadoInicial());

    function estrellasHTML(n) {
        let h = '';
        for (let i = 1; i <= 5; i++) h += `<i class="fa-solid fa-star${i <= n ? '' : ' off'}"></i>`;
        return `<span class="res-stars" role="img" aria-label="${n} de 5 estrellas">${h}</span>`;
    }

    function filaHTML(r) {
        const id = esc(r.id);
        const largo = r.comentario.length > LIMITE_COMENTARIO;
        const abierta = expandidas.has(String(r.id));
        let comentario;
        if (!r.comentario) comentario = '<span class="text-secondary fst-italic">Sin comentario</span>';
        else if (largo && !abierta) comentario = `${esc(r.comentario.slice(0, LIMITE_COMENTARIO).trimEnd())}…<button type="button" class="res-vermas" data-accion="vermas" data-id="${id}">Ver más</button>`;
        else if (largo) comentario = `${esc(r.comentario)}<button type="button" class="res-vermas" data-accion="vermas" data-id="${id}">Ver menos</button>`;
        else comentario = esc(r.comentario);

        const badge = r.visible ? '' : '<span class="res-badge-oculta"><i class="fa-solid fa-eye-slash"></i>Oculta</span>';
        const btnVis = r.visible
            ? `<button type="button" class="btn btn-sm res-btn-ocultar" data-accion="ocultar" data-id="${id}" data-bs-toggle="tooltip" title="Ocultar del sitio (no se elimina)" aria-label="Ocultar reseña"><i class="fa-solid fa-eye-slash"></i></button>`
            : `<button type="button" class="btn btn-sm res-btn-mostrar" data-accion="ocultar" data-id="${id}" data-bs-toggle="tooltip" title="Mostrar de nuevo en el sitio" aria-label="Mostrar reseña"><i class="fa-solid fa-eye"></i></button>`;

        return `<tr class="${r.visible ? '' : 'res-oculta'}">
            <td class="res-cliente">${esc(r.nombre)}${badge}</td>
            <td>${r.cal ? estrellasHTML(r.cal) : '<span class="text-secondary">—</span>'}</td>
            <td class="res-comentario">${comentario}</td>
            <td class="res-fecha">${r.fecha ? `<time datetime="${r.fecha.toISOString()}">${fmtFecha(r.fecha)}</time>` : '—'}</td>
            <td><div class="res-acciones">${btnVis}
                <button type="button" class="btn btn-sm res-btn-eliminar" data-accion="eliminar" data-id="${id}" data-bs-toggle="tooltip" title="Eliminar reseña definitivamente" aria-label="Eliminar reseña"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }

    function liberarTooltips() {
        tooltips.forEach((t) => { try { t.dispose(); } catch (e) { /* noop */ } });
        tooltips = [];
    }

    function pintarStats() {
        const s = calcularStats(datos);
        const set = (id, html) => { const el = $('#' + id); el.classList.remove('sk'); el.innerHTML = html; };
        set('statTotal', String(s.total));
        $('#statTotalNota').textContent = s.total ? `${plural(datos.filter((r) => r.visible).length, 'visible', 'visibles')} en el sitio` : 'Sin reseñas aún';
        set('statPromedio', s.promedio === null ? '—' : `${s.promedio.toFixed(1)}<small> / 5</small>`);
        $('#statPromedioNota').innerHTML = s.promedio === null ? 'Sin calificaciones' : estrellasHTML(Math.round(s.promedio));
        set('statPositivas', String(s.positivas));
        $('#statPositivasNota').innerHTML = s.total ? `<span class="ok">${s.pctPos}%</span> del total · 4 y 5 ★` : '4 y 5 ★';
        set('statNegativas', String(s.negativas));
        $('#statNegativasNota').textContent = s.total ? `${s.pctNeg}% del total · 1 y 2 ★` : '1 y 2 ★';
    }

    function pintarControles() {
        $$('[data-res-dd]').forEach((dd) => {
            const key = dd.dataset.resDd;
            const def = estadoInicial()[key];
            $$('.dropdown-item', dd).forEach((it) => it.classList.toggle('selected', it.dataset.valor === state[key]));
            const op = OPCIONES[key].find((o) => o[0] === state[key]);
            const pill = $('.res-dd-valor', dd);
            const activo = state[key] !== def;
            pill.hidden = !activo;
            pill.textContent = activo && op ? (op[2] || op[1]) : '';
            $('.btn', dd).classList.toggle('activo', activo);
        });
        $('#resFechaCustom').hidden = state.fecha !== 'custom';
        $$('.res-chip').forEach((c) => {
            const on = String(state[c.dataset.k]) === c.dataset.v;
            c.classList.toggle('activo', on);
            c.setAttribute('aria-pressed', on);
        });
        $('#resLimpiar').disabled = esInicial();
    }

    function filaVacia(html) {
        return `<tr><td colspan="5" class="text-center text-secondary py-5">${html}</td></tr>`;
    }

    function pintarTabla(vista, totalFiltrado) {
        liberarTooltips();
        const tbody = $('#tbodyResenas');
        if (!cargado) return;
        if (!datos.length) tbody.innerHTML = filaVacia('Aún no hay reseñas de clientes.');
        else if (!totalFiltrado) tbody.innerHTML = filaVacia('Ninguna reseña coincide con los filtros.<br><button type="button" class="res-vermas mt-2" data-accion="limpiar">Limpiar filtros</button>');
        else tbody.innerHTML = vista.map(filaHTML).join('');

        if (global.bootstrap && global.bootstrap.Tooltip) {
            $$('[data-bs-toggle="tooltip"]', tbody).forEach((el) => tooltips.push(new global.bootstrap.Tooltip(el, { trigger: 'hover focus' })));
        }
    }

    function pintarPie(total, paginas, ini, cuantas) {
        const pie = $('#resPie');
        $('#resResumen').textContent = cargado
            ? (total === datos.length ? `${plural(total, 'reseña', 'reseñas')}` : `${plural(total, 'reseña encontrada', 'reseñas encontradas')} de ${datos.length}`)
            : '';
        pie.hidden = !cargado || total === 0;
        if (pie.hidden) return;
        $('#resInfo').textContent = `Mostrando ${ini + 1}–${ini + cuantas} de ${plural(total, 'reseña', 'reseñas')} · Página ${pagina} de ${paginas}`;
        $('#resPorPagina').value = String(porPagina);

        const ul = $('#resPaginacion');
        if (paginas <= 1) { ul.innerHTML = ''; return; }
        const item = (html, p, { activo = false, deshabilitado = false, label = '' } = {}) =>
            `<li class="page-item${activo ? ' active' : ''}${deshabilitado ? ' disabled' : ''}"><button type="button" class="page-link" ${p ? `data-pagina="${p}"` : 'tabindex="-1"'} ${label ? `aria-label="${label}"` : ''} ${activo ? 'aria-current="page"' : ''}>${html}</button></li>`;
        ul.innerHTML =
            item('<i class="fa-solid fa-chevron-left"></i>', pagina - 1, { deshabilitado: pagina === 1, label: 'Página anterior' }) +
            numerosPagina(pagina, paginas).map((n) => (n === '…' ? item('…', 0, { deshabilitado: true }) : item(n, n, { activo: n === pagina }))).join('') +
            item('<i class="fa-solid fa-chevron-right"></i>', pagina + 1, { deshabilitado: pagina === paginas, label: 'Página siguiente' });
    }

    function render() {
        const lista = ordenar(filtrar(datos, state), state.orden);
        const total = lista.length;
        const paginas = Math.max(1, Math.ceil(total / porPagina));
        if (pagina > paginas) pagina = paginas;
        const ini = (pagina - 1) * porPagina;
        const vista = lista.slice(ini, ini + porPagina);
        if (cargado) { pintarStats(); if (cfg.alActualizar) cfg.alActualizar(datos.length); }
        pintarControles();
        pintarTabla(vista, total);
        pintarPie(total, paginas, ini, vista.length);
    }

    function limpiar() {
        state = estadoInicial();
        pagina = 1;
        $('#resBuscar').value = '';
        $('#resDesde').value = '';
        $('#resHasta').value = '';
        render();
    }

    function buscarPorId(id) { return datos.find((r) => String(r.id) === String(id)); }

    async function accionFila(btn) {
        const r = buscarPorId(btn.dataset.id);
        if (!r) return;
        const accion = btn.dataset.accion;

        if (accion === 'vermas') {
            const k = String(r.id);
            expandidas.has(k) ? expandidas.delete(k) : expandidas.add(k);
            render();
            return;
        }
        if (accion === 'eliminar' && !cfg.confirmar(`¿Eliminar la reseña de ${r.nombre}? Esta acción no se puede deshacer.`)) return;

        liberarTooltips();
        btn.disabled = true;
        try {
            if (accion === 'ocultar') {
                const nuevo = !r.visible;
                await cfg.cambiarVisibilidad(r.raw, nuevo, r);
                r.visible = nuevo;
            } else if (accion === 'eliminar') {
                await cfg.eliminar(r.raw, r);
                datos = datos.filter((x) => x !== r);
                expandidas.delete(String(r.id));
            }
        } catch (err) {
            console.error('[ResenasAdmin]', err);
            cfg.avisar(accion === 'eliminar' ? 'No se pudo eliminar la reseña.' : 'No se pudo cambiar la visibilidad de la reseña.');
        } finally {
            render();
        }
    }

    function construirMenus() {
        $$('[data-res-dd]').forEach((dd) => {
            const key = dd.dataset.resDd;
            $('[data-res-items]', dd).innerHTML = OPCIONES[key]
                .map(([v, t]) => `<button type="button" class="dropdown-item" data-key="${key}" data-valor="${v}">${t}<i class="fa-solid fa-check"></i></button>`)
                .join('');
        });
    }

    function enlazarEventos() {
        $('#resBuscar').addEventListener('input', (e) => { state.q = e.target.value; pagina = 1; render(); });

        $('#resPorPagina').addEventListener('change', (e) => { porPagina = Number(e.target.value) || 10; pagina = 1; render(); });

        const alCambiarFecha = () => {
            state.desde = $('#resDesde').value;
            state.hasta = $('#resHasta').value;
            $('#resHasta').min = state.desde || '';
            $('#resDesde').max = state.hasta || '';
            pagina = 1;
            render();
        };
        $('#resDesde').addEventListener('change', alCambiarFecha);
        $('#resHasta').addEventListener('change', alCambiarFecha);

        root.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item[data-key]');
            if (item) {
                state[item.dataset.key] = item.dataset.valor;
                pagina = 1;
                if (item.dataset.key === 'fecha' && item.dataset.valor !== 'custom' && global.bootstrap) {
                    global.bootstrap.Dropdown.getOrCreateInstance(item.closest('[data-res-dd]').querySelector('.btn')).hide();
                }
                render();
                if (item.dataset.valor === 'custom') $('#resDesde').focus();
                return;
            }

            const chip = e.target.closest('.res-chip');
            if (chip) {
                const k = chip.dataset.k, def = estadoInicial()[k];
                const activo = String(state[k]) === chip.dataset.v;
                state[k] = activo ? def : (k === 'conComentarios' ? true : chip.dataset.v);
                pagina = 1;
                render();
                return;
            }

            if (e.target.closest('#resLimpiar') || e.target.closest('[data-accion="limpiar"]')) { limpiar(); return; }

            const pag = e.target.closest('[data-pagina]');
            if (pag) { pagina = Number(pag.dataset.pagina); render(); return; }

            const btn = e.target.closest('#tbodyResenas [data-accion]');
            if (btn) accionFila(btn);
        });
    }

    async function cargar() {
        cargado = false;
        if (global.Skeleton && typeof global.Skeleton.tableRows === 'function') global.Skeleton.tableRows('tbodyResenas', 5);
        else $('#tbodyResenas').innerHTML = filaVacia('Cargando…');
        try {
            const crudos = await cfg.obtener();
            datos = (Array.isArray(crudos) ? crudos : []).map((r, i) => normalizar(r, i, cfg.mapear));
            cargado = true;
        } catch (err) {
            console.error('[ResenasAdmin]', err);
            $('#tbodyResenas').innerHTML = filaVacia('No se pudieron cargar las reseñas.<br><button type="button" class="res-vermas mt-2" data-accion-recarga>Reintentar</button>');
            const b = $('[data-accion-recarga]');
            if (b) b.addEventListener('click', cargar);
            return;
        }
        render();
    }

    function init(opciones) {
        root = document.getElementById('resenas');
        if (!root || root.dataset.resListo) return;
        root.dataset.resListo = '1';
        cfg = Object.assign({
            obtener: async () => { throw new Error('Falta la opción "obtener".'); },
            cambiarVisibilidad: async () => { throw new Error('Falta la opción "cambiarVisibilidad".'); },
            eliminar: async () => { throw new Error('Falta la opción "eliminar".'); },
            confirmar: (m) => global.confirm(m),
            avisar: (m) => global.alert(m),
            mapear: null,
            alActualizar: null, // opcional: recibe el total de reseñas tras cada cambio
        }, opciones || {});
        construirMenus();
        enlazarEventos();
        pintarControles();
        return cargar();
    }

    global.ResenasAdmin = {
        init,
        recargar: () => (root ? cargar() : undefined),
        _t: { normalizar, filtrar, ordenar, calcularStats, rangoFecha, estadoInicial, numerosPagina },
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* ---------- Parte 2: conexión con Supabase ---------- */
(() => {
    'use strict';

    if (typeof document === 'undefined' || !document.getElementById('tbodyResenas')) return;

    const statEl = document.getElementById('statResenas'); // contador de la pestaña Inicio

    ResenasAdmin.init({
        // Trae TODAS las reseñas (visibles y ocultas)
        obtener: async () => {
            const { data, error } = await db
                .from('resenas').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        // Misma consulta que ya usabas para ocultar/mostrar
        cambiarVisibilidad: async (r, visible) => {
            const { error } = await db.from('resenas').update({ visible }).eq('id', r.id);
            if (error) throw error;
        },

        // Misma consulta que ya usabas para eliminar
        eliminar: async (r) => {
            const { error } = await db.from('resenas').delete().eq('id', r.id);
            if (error) throw error;
        },

        // Tus columnas: nombre + apellido, calificacion, comentario, created_at, visible
        mapear: (r) => ({
            nombre: `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim(),
            cal: r.calificacion,
            fecha: r.created_at,
        }),

        // Mantiene el número de "Reseñas" en Inicio
        alActualizar: (total) => {
            if (!statEl) return;
            statEl.classList.remove('sk');
            statEl.textContent = total;
        },
    });
})();