function updateStatus() {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 1 = Lunes ... 6 = Sábado
    const hour = now.getHours(); // 0-23
    
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    let isOpen = false;
    
    // Abierto de Lunes a Sábado (días 1 a 6) de 8:00 AM (8) a 6:59 PM (< 19)
    if (day >= 1 && day <= 6) {
        if (hour >= 8 && hour < 19) {
            isOpen = true;
        }
    }
    
    if (isOpen) {
        statusDot.className = 'status-dot open';
        statusText.textContent = 'ABIERTO';
        statusText.style.color = 'var(--status-open)';
    } else {
        statusDot.className = 'status-dot closed';
        statusText.textContent = 'CERRADO';
        statusText.style.color = 'var(--status-closed)';
    }
}

updateStatus(); // Ejecutar al cargar
setInterval(updateStatus, 60000); // Actualizar cada minuto

// 2. Dropdown del horario
const dropdownToggle = document.getElementById('status-dropdown-toggle');
dropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownToggle.classList.toggle('active');
});

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!dropdownToggle.contains(e.target)) {
        dropdownToggle.classList.remove('active');
    }
});