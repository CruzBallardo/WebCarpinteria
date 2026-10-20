// Si no hay sesión, fuera del panel
(async () => {
  const { data: { session } } = await db.auth.getSession()

  if (!session) {
    window.location.replace('index.html')
    return
  }

  // Hay sesión: mostramos la página
  document.body.style.visibility = 'visible'
})()