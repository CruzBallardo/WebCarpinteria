document.addEventListener('DOMContentLoaded', () => {

    // ========== 1. Estado Abierto / Cerrado ==========
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    function updateStatus() {
        if (!dot || !statusText) return;

        // Hora actual en Ciudad de México
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Mexico_City',
            weekday: 'short',
            hour: 'numeric',
            hourCycle: 'h23'
        }).formatToParts(new Date());

        const weekday = parts.find(p => p.type === 'weekday').value;
        const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);

        const weekdayOpen = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)
            && hour >= 10 && hour < 19;
        const saturdayOpen = weekday === 'Sat' && hour >= 10 && hour < 14;
        const isOpen = weekdayOpen || saturdayOpen;

        dot.className = 'status-dot ' + (isOpen ? 'open' : 'closed');
        statusText.textContent = isOpen ? 'ABIERTO' : 'CERRADO';
        statusText.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';
    }

    updateStatus();
    setInterval(updateStatus, 60000);

    // ========== 2. Tema claro / oscuro ==========
    const html = document.documentElement;
    const themeBtn = document.getElementById('theme-toggle');

    function getSavedTheme() {
        try {
            return localStorage.getItem('theme') || 'light';
        } catch {
            return 'light';
        }
    }

    function setTheme(theme) {
        html.setAttribute('data-bs-theme', theme);
        if (themeBtn) {
            themeBtn.innerHTML = theme === 'dark'
                ? '<i class="fa-solid fa-sun"></i>'
                : '<i class="fa-solid fa-moon"></i>';
        }
        try {
            localStorage.setItem('theme', theme);
        } catch { /* almacenamiento no disponible */ }
    }

    setTheme(getSavedTheme());

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            setTheme(html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
        });
    }

    // ========== 3. Barra de búsqueda ==========
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const noResults = document.getElementById('noResults');
    const cards = document.querySelectorAll('.card-animada');

    // Quita acentos y pasa a minúsculas: "Café" -> "cafe"
    const normalizar = (texto) =>
        texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    function buscarProductos() {
        const busqueda = normalizar(searchInput.value.trim());
        let encontrados = 0;

        cards.forEach((card) => {
            const coincide = normalizar(card.textContent).includes(busqueda);
            const contenedor = card.parentElement;

            if (contenedor) contenedor.style.display = coincide ? '' : 'none';
            if (coincide) encontrados++;
        });

        if (noResults) {
            noResults.classList.toggle('d-none', encontrados > 0);
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', buscarProductos);
    }

    if (searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (searchInput) buscarProductos();
        });
    }

    // ========== 4. Animación del HERO ==========
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        setTimeout(() => {
            heroContent.querySelectorAll('h1, p, .btn').forEach(el => el.classList.add('show'));
        }, 300);
    }

    // ========== 5. Animación al hacer scroll ==========
    const revealElements = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window) {
        const revealOnScroll = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target); // se anima solo una vez
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -80px 0px',
            threshold: 0.15
        });

        revealElements.forEach(el => revealOnScroll.observe(el));
    } else {
        // Respaldo para navegadores sin soporte
        revealElements.forEach(el => el.classList.add('visible'));
    }
});