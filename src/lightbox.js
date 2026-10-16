// Full-screen player for the films (with sound).
export function createLightbox(lenis) {
  const el = document.getElementById('lb')
  const video = el.querySelector('[data-lb-video]')
  const kind = el.querySelector('[data-lb-kind]')
  const title = el.querySelector('[data-lb-title]')
  let lastFocus = null
  // while the player is open, everything behind it is inert (focus stays in the dialog)
  const behind = [document.querySelector('.nav'), document.querySelector('main')]

  // In focus mode only the film is on screen: the title, switch and close
  // button fade out after a moment of stillness and return on any input.
  const focusOn = () => document.documentElement.classList.contains('focus-mode')
  let idleTimer
  let wokeAt = 0
  function wake() {
    if (el.classList.contains('is-idle')) wokeAt = performance.now()
    el.classList.remove('is-idle')
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => el.classList.add('is-idle'), 2200)
  }
  ;['pointermove', 'pointerdown', 'keydown', 'focusin'].forEach((ev) => el.addEventListener(ev, wake))

  function open({ src, poster, heading, sub }) {
    lastFocus = document.activeElement
    video.src = src
    video.poster = poster || ''
    title.textContent = heading || ''
    kind.textContent = sub || ''
    el.hidden = false
    behind.forEach((b) => (b.inert = true))
    lenis?.stop()
    video.play().catch(() => {})
    el.querySelector('[data-lb-close]').focus()
    wake()
  }
  function close() {
    video.pause()
    video.removeAttribute('src')
    video.load()
    el.hidden = true
    clearTimeout(idleTimer)
    el.classList.remove('is-idle')
    behind.forEach((b) => (b.inert = false))
    lenis?.start()
    lastFocus?.focus?.()
  }
  el.addEventListener('click', (e) => {
    // with the controls hidden, a tap on the black only brings them back
    if (focusOn() && performance.now() - wokeAt < 500 && !e.target.closest('[data-lb-close]')) return
    if (e.target === el || e.target.closest('[data-lb-close]')) close()
  })
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hidden) close()
  })
  return { open, close }
}
