const btnLoginModal = document.getElementById('btn-login-modal')
const menuAdmin = document.getElementById('menu-admin')
const formularioLogin = document.getElementById('loginForm')
const btnLogout = document.getElementById('btn-logout')

//interfaz
function mostrarPanelAdmin() {
  btnLoginModal?.classList.add('d-none')
  menuAdmin?.classList.remove('d-none')
}

function mostrarLogin() {
  btnLoginModal?.classList.remove('d-none')
  menuAdmin?.classList.add('d-none')
}

function cerrarModalLogin() {
  const modalElement = document.getElementById('loginModal')
  if (!modalElement) return
  const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement)
  modal.hide()
}

//logica de sesion
async function login(email, password) {
  const { error } = await db.auth.signInWithPassword({ email, password })

  if (error) {
    alert('Correo o contraseña incorrectos')
    return false
  }

  cerrarModalLogin()
  return true
}

async function logout() {
  await db.auth.signOut()

  if (window.location.pathname.endsWith('administrador.html')) {
    window.location.replace('index.html')
  }
}

//eventos
db.auth.onAuthStateChange((evento, session) => {
  if (session) mostrarPanelAdmin()
  else mostrarLogin()
})

formularioLogin?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const boton = formularioLogin.querySelector('button[type="submit"]')
  const correo = document.getElementById('loginEmail').value.trim()
  const contrasena = document.getElementById('loginPassword').value

  boton.disabled = true
  const ok = await login(correo, contrasena)
  boton.disabled = false

  if (ok) formularioLogin.reset()
})

btnLogout?.addEventListener('click', logout);

// ver y ocultar contraseña
function activarToggleContrasena() {
  const modal  = document.getElementById('loginModal');
  const input  = document.getElementById('loginPassword');
  const toggle = document.getElementById('togglePassword');
  if (!modal || !input || !toggle) return;

  const icon = toggle.querySelector('i');

  function setVisible(visible) {
    input.type = visible ? 'text' : 'password';
    icon.classList.toggle('bi-eye', !visible);
    icon.classList.toggle('bi-eye-slash', visible);
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  }

  toggle.addEventListener('click', () => {
    setVisible(input.type === 'password');
    input.focus();
  });

  // al cerrar el modal, la contraseña vuelve a quedar oculta
  modal.addEventListener('hidden.bs.modal', () => setVisible(false));
}

activarToggleContrasena();