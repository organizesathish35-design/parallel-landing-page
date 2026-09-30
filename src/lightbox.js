// Full-screen player for the films (with sound).
export function createLightbox(lenis) {
  const el = document.getElementById('lb')
  const video = el.querySelector('[data-lb-video]')
  const kind = el.querySelector('[data-lb-kind]')
  const title = el.querySelector('[data-lb-title]')
  let lastFocus = null

  function open({ src, poster, heading, sub }) {
    lastFocus = document.activeElement
    video.src = src
    video.poster = poster || ''
    title.textContent = heading || ''
    kind.textContent = sub || ''
    el.hidden = false
    lenis?.stop()
    video.play().catch(() => {})
    el.querySelector('[data-lb-close]').focus()
  }
  function close() {
    video.pause()
    video.removeAttribute('src')
    video.load()
    el.hidden = true
    lenis?.start()
    lastFocus?.focus?.()
  }
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-lb-close]')) close()
  })
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hidden) close()
  })
  return { open, close }
}
