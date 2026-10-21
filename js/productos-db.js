/* ==========================================================
   productos-db.js – Capa de datos del catálogo con Supabase
   Requiere cargar antes: supabase-js (CDN) y db.js (cliente `db`).
   Expone el mismo CatalogoDB que usaba el código anterior.
   ========================================================== */
const CatalogoDB = (() => {
    const TABLA = 'productos';
    const BUCKET = 'productos';

    // Fila de la tabla -> objeto que esperan admin y catálogo
    const desdeFila = f => ({
        id: f.id,
        nombre: f.nombre,
        categoria: f.categoria,
        precio: f.precio != null ? Number(f.precio) : null,
        descripcion: f.descripcion,
        imagenes: f.imagenes || [],
        creado: new Date(f.created_at).getTime()
    });

    // URL pública -> ruta dentro del bucket (para poder borrar el archivo)
    const rutaDesdeUrl = url => {
        const marca = `/object/public/${BUCKET}/`;
        const i = url.indexOf(marca);
        return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length).split('?')[0]);
    };

    async function subirImagen(productoId, dataUrl, indice) {
        const blob = await (await fetch(dataUrl)).blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const ruta = `${productoId}/${Date.now()}-${indice}.${ext}`;

        const { error } = await db.storage.from(BUCKET).upload(ruta, blob, {
            contentType: blob.type || 'image/jpeg',
            cacheControl: '31536000'
        });
        if (error) throw error;

        return db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
    }

    async function borrarImagenes(urls) {
        const rutas = urls.map(rutaDesdeUrl).filter(Boolean);
        if (!rutas.length) return;
        const { error } = await db.storage.from(BUCKET).remove(rutas);
        if (error) console.warn('No se pudieron borrar algunas imágenes:', error.message);
    }

    return {
        async obtenerTodos() {
            const { data, error } = await db
                .from(TABLA)
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(desdeFila);
        },

        // producto.imagenes puede mezclar dataURLs (fotos nuevas) y URLs (ya subidas)
        async guardar(producto) {
            const { data: previo, error: errPrevio } = await db
                .from(TABLA).select('imagenes').eq('id', producto.id).maybeSingle();
            if (errPrevio) throw errPrevio;
            const anteriores = previo?.imagenes || [];

            const subidas = [];
            const urls = [];
            try {
                for (let i = 0; i < producto.imagenes.length; i++) {
                    const img = producto.imagenes[i];
                    if (img.startsWith('data:')) {
                        const url = await subirImagen(producto.id, img, i);
                        subidas.push(url);
                        urls.push(url);
                    } else {
                        urls.push(img);
                    }
                }

                const { error } = await db.from(TABLA).upsert({
                    id: producto.id,
                    nombre: producto.nombre,
                    categoria: producto.categoria,
                    precio: producto.precio,
                    descripcion: producto.descripcion,
                    imagenes: urls
                });
                if (error) throw error;
            } catch (err) {
                await borrarImagenes(subidas); // no dejar archivos huérfanos
                throw err;
            }

            // Borra las fotos que se quitaron o reemplazaron al editar
            await borrarImagenes(anteriores.filter(u => !urls.includes(u)));
        },

        async eliminar(id) {
            const { data: previo } = await db
                .from(TABLA).select('imagenes').eq('id', id).maybeSingle();

            const { error } = await db.from(TABLA).delete().eq('id', id);
            if (error) throw error;

            await borrarImagenes(previo?.imagenes || []);
        }
    };
})();