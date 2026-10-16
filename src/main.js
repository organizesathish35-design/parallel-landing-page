import './styles.css'
import Lenis from 'lenis'
import gsap from 'gsap'
import { wordmark } from './logo.js'
import { createLightbox } from './lightbox.js'
import { initRooms, progressOf } from './rooms.js'
import { initLeads } from './leads.js'
import { initReveal } from './reveal.js'
import { motion } from './motion.js'
import './focus.js'

// ---------- wordmarks
document.querySelector('[data-logo]').innerHTML = wordmark()
document.querySelector('[data-wordmark]').innerHTML = wordmark({ title: 'PARALLEL' })

// ---------- smooth scroll
// Touch devices already have momentum scrolling. Keep Lenis involved so the
// sticky scenes and anchor jumps stay in the same timing system, but use a
// slightly softer interpolation so it never feels like the page is dragging.
const isTouch = matchMedia('(pointer: coarse)').matches
const smoothLerp = isTouch ? 0.12 : 0.085
const lenis = new Lenis({
  lerp: motion.reduced ? 1 : smoothLerp,
  wheelMultiplier: 0.9,
  touchMultiplier: 1,
  smoothWheel: true,
  syncTouch: false,
})
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)

// In-page links scroll smoothly and also move keyboard focus to the target,
// so the skip link leaves screen-reader users where they landed.
// Links marked data-lead open the quote popup instead (leads.js).
document.querySelectorAll('a[href^="#"]:not([data-lead])').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')
    const target = id.length > 1 && document.querySelector(id)
    if (!target) return
    e.preventDefault()
    lenis.scrollTo(id === '#top' ? 0 : id, { duration: motion.reduced ? 0.01 : 1.6, force: true })
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  }),
)

const lightbox = createLightbox(lenis)
const updateRooms = initRooms({ lenis, lightbox })
initLeads({ lenis })
initReveal()

const root = document.documentElement
const rooms = [...document.querySelectorAll('[data-room]')]
const navLinks = [...document.querySelectorAll('.nav__links a')]
const parallaxEls = [...document.querySelectorAll('[data-parallax]')]
const progressBar = document.querySelector('[data-progress]')
const hero = document.getElementById('hero')

motion.onChange((reduced) => {
  lenis.options.lerp = reduced ? 1 : smoothLerp
  if (reduced) parallaxEls.forEach((el) => el.style.removeProperty('--parallax-y'))
})

function tick() {
  // Shared depth pass: each marked layer gets a small offset based on its
  // distance from the viewport centre. The effect is deliberately subtle so
  // the page feels continuous rather than like a collection of animations.
  if (!motion.reduced) parallaxEls.forEach((el) => {
    const parent = el.closest('.room, .process')
    if (!parent) return
    const b = parent.getBoundingClientRect()
    if (b.bottom < -innerHeight || b.top > innerHeight) return
    // The content is sticky, so its own rect does not change while a scene is
    // pinned. Use the parent section's travel instead to create real depth.
    const q = progressOf(parent) * 2 - 1
    el.style.setProperty('--parallax-y', `${(q * Number(el.dataset.parallax || 0)).toFixed(2)}px`)
  })

  // Navigation state: dark type over the white rooms, light type over the hero and contact
  const mid = innerHeight / 2
  const here = rooms.find((s) => {
    const b = s.getBoundingClientRect()
    return b.top <= mid && b.bottom > mid
  })
  const light = !!rooms.find((s) => {
    const b = s.getBoundingClientRect()
    return b.top <= 60 && b.bottom > 60
  })
  root.classList.toggle('is-light', light)
  // phones: the header belongs to the hero; past it, the bottom bar carries the action
  root.classList.toggle('past-hero', hero.getBoundingClientRect().bottom < 80)
  navLinks.forEach((a) => {
    const on = !!here && a.getAttribute('href') === `#${here.id}`
    if (a.classList.contains('is-here') === on) return
    a.classList.toggle('is-here', on)
    on ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')
  })

  // the scenes are long: show how far through the story the visitor is
  const max = root.scrollHeight - innerHeight
  progressBar.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : '0')

  updateRooms()
}
gsap.ticker.add(tick)
tick()

if (import.meta.env.DEV) {
  // step the page by hand (the preview pane can pause requestAnimationFrame)
  window.__step = (n = 3) => {
    for (let i = 0; i < n; i++) gsap.ticker.tick()
  }
  window.__at = (id, q) => {
    const el = document.getElementById(id)
    lenis.scrollTo(el.offsetTop + q * (el.offsetHeight - innerHeight), { immediate: true, force: true })
    window.__step(4)
  }
}
