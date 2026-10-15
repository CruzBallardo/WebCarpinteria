//Dropdown Abierto/Cerrado
function updateStatus() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const day = now.getDay();
    const hour = now.getHours();

    const weekdayOpen = day >= 1 && day <= 5 && hour >= 10 && hour < 19
    const saturdayOpen = day === 6 && hour >= 10 && hour < 14;
    const isOpen = weekdayOpen || saturdayOpen;

    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    dot.className = 'status-dot ' + (isOpen ? 'open' : 'closed');
    text.textContent = isOpen ? 'ABIERTO' : 'CERRADO';
    text.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';
}
updateStatus();
setInterval(updateStatus, 60000);

//Tema claro / oscuro
const html = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');

function setTheme(theme) {
    html.setAttribute('data-bs-theme', theme);
    themeBtn.innerHTML = theme === 'dark'
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
    localStorage.setItem('theme', theme);
}

setTheme(localStorage.getItem('theme') || 'light');

themeBtn.addEventListener('click', () => {
    setTheme(html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
});

// FUNCIONAMIENTO DE BARRA DE BUSQUEDA 

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const noResults = document.getElementById("noResults");

const cards = document.querySelectorAll(".card-animada");

function buscarProductos() {
    const busqueda = searchInput.value
        .trim()
        .toLowerCase();

    let encontrados = 0;

    cards.forEach((card) => {
        // Obtener el nombre y la descripción de la tarjeta
        const contenido = card.textContent.toLowerCase();

        // Comprobar si coincide con la búsqueda
        const coincide = contenido.includes(busqueda);

        // Mostrar u ocultar la columna de la tarjeta
        card.parentElement.style.display = coincide ? "" : "none";

        if (coincide) {
            encontrados++;
        }
    });

    // Mostrar mensaje si no hay coincidencias
    if (noResults) {
        noResults.classList.toggle("d-none", encontrados > 0);
    }
}

// Buscar mientras el usuario escribe
searchInput.addEventListener("input", buscarProductos);

// Evitar que el formulario recargue la página
searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    buscarProductos();
});
