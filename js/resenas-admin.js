(() => {
    'use strict';

    const tbody = document.getElementById('tbodyResenas');
    if (!tbody) return;

    const statEl = document.getElementById('statResenas');
    let resenas = [];

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fecha = iso => new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium' });
    const estrellas = n => '<span class="text-warning">' + '★'.repeat(n) + '</span><span class="text-body-tertiary">' + '★'.repeat(5 - n) + '</span>';

    async function cargar() {
        const { data, error } = await db
            .from('resenas').select('*').order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-5">No se pudieron cargar las reseñas.</td></tr>';
            return;
        }
        resenas = data || [];
        render();
    }

    function render() {
        if (statEl) statEl.textContent = resenas.length;

        if (!resenas.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-5">Aún no hay reseñas.</td></tr>';
            return;
        }

        tbody.innerHTML = resenas.map(r => `
            <tr class="${r.visible ? '' : 'opacity-50'}">
                <td class="fw-semibold">${esc(r.nombre)} ${esc(r.apellido)}</td>
                <td class="text-nowrap">${estrellas(r.calificacion)}</td>
                <td style="max-width: 320px;">${esc(r.comentario)}</td>
                <td class="small text-nowrap">${fecha(r.created_at)}</td>
                <td class="text-nowrap">
                    <button class="btn btn-sm ${r.visible ? 'btn-outline-secondary' : 'btn-outline-success'}"
                            data-vis="${r.id}" title="${r.visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}">
                        <i class="fa-solid ${r.visible ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-del="${r.id}" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    }

    tbody.addEventListener('click', async e => {
        const vis = e.target.closest('[data-vis]');
        const del = e.target.closest('[data-del]');

        if (vis) {
            const r = resenas.find(x => x.id === Number(vis.dataset.vis));
            const { error } = await db.from('resenas').update({ visible: !r.visible }).eq('id', r.id);
            if (error) return alert('No se pudo actualizar la reseña.');
            r.visible = !r.visible;
            render();
        }

        if (del) {
            if (!confirm('¿Eliminar esta reseña definitivamente?')) return;
            const id = Number(del.dataset.del);
            const { error } = await db.from('resenas').delete().eq('id', id);
            if (error) return alert('No se pudo eliminar la reseña.');
            resenas = resenas.filter(x => x.id !== id);
            render();
        }
    });

    cargar();
})();