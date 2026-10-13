// 1. Estado Abierto / Cerrado
function updateStatus() {
    const now = new Date();
    const day = now.getDay();   // 0 = domingo
    const hour = now.getHours();
    const isOpen = day >= 1 && day <= 6 && hour >= 8 && hour < 19;

    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    dot.className = 'status-dot ' + (isOpen ? 'open' : 'closed');
    text.textContent = isOpen ? 'ABIERTO' : 'CERRADO';
    text.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';
}
updateStatus();
setInterval(updateStatus, 60000);

// 2. Tema claro / oscuro (usa el modo nativo de Bootstrap 5.3)
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