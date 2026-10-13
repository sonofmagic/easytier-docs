import '../scripts/mermaid'

const themeButton = document.querySelector<HTMLButtonElement>('#theme-toggle')
const menuButton = document.querySelector<HTMLButtonElement>('#menu-toggle')
const rail = document.querySelector<HTMLElement>('#site-rail')
const updateThemeLabel = () => themeButton?.setAttribute('aria-pressed', String(document.documentElement.classList.contains('dark')))
updateThemeLabel()
themeButton?.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark')
  try {
    localStorage.setItem('easytier-theme', dark ? 'dark' : 'light')
  }
  catch { /* Preference is optional. */ }
  updateThemeLabel()
  document.dispatchEvent(new CustomEvent('easytier:theme-change'))
})
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true'
  menuButton.setAttribute('aria-expanded', String(open))
  rail?.classList.toggle('is-open', open)
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    menuButton?.setAttribute('aria-expanded', 'false')
    rail?.classList.remove('is-open')
  }
})
