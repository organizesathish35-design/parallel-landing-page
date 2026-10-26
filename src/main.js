import './styles.css'
import Lenis from 'lenis'
import gsap from 'gsap'
import { HeroScene } from './hero/HeroScene.js'
import { wordmark } from './logo.js'
import { createLightbox } from './lightbox.js'
import { initRooms, progressOf } from './rooms.js'
import { initLeads } from './leads.js'
import { initReveal } from './reveal.js'
import { motion } from './motion.js'
import './focus.js'

// ---------- wordmarks
document.querySelector('[data-logo]').innerHTML = wordmark()
const title = document.querySelector('[data-wordmark]')
title.innerHTML = wordmark({ title: 'PARALLEL' })

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
let piloting = false // a scripted scroll is running; the hero autopilot stays out of its way
document.querySelectorAll('a[href^="#"]:not([data-lead])').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')
    const target = id.length > 1 && document.querySelector(id)
    if (!target) return
    e.preventDefault()
    piloting = true
    lenis.scrollTo(id === '#top' ? 0 : id, { duration: motion.reduced ? 0.01 : 1.6, force: true, onComplete: () => (piloting = false) })
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  }),
)

const lightbox = createLightbox(lenis)
const updateRooms = initRooms({ lenis, lightbox })
initLeads({ lenis })
initReveal()

// service cards with a film loop: play only while on screen, and not at all with reduced motion
const svcVideos = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
  if (isIntersecting && !motion.reduced) v.play().catch(() => {})
  else v.pause()
}), { rootMargin: '100px 0px' })
document.querySelectorAll('[data-svc-video]').forEach((v) => svcVideos.observe(v))

const root = document.documentElement
const rooms = [...document.querySelectorAll('[data-room]')]
const navLinks = [...document.querySelectorAll('.nav__links a')]
const parallaxEls = [...document.querySelectorAll('[data-parallax]')]
const progressBar = document.querySelector('[data-progress]')
const hero = document.getElementById('hero')

// ---------- the hero: the first part of its scroll is one day over the tower (sunrise to night),
// the rest is the walk through the lit office glass into the next section
const canvas = document.getElementById('gl')
const scene = new HeroScene(canvas)
const { clamp } = gsap.utils
const seg = (q, a, b) => {
  const t = clamp(0, 1, (q - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const ENTER_START = 0.3 // share of the hero's scroll that is the day; the rest is the walk in
const DAY_SECONDS = 1.6
const WALK_SECONDS = 1.1
const heroUi = hero.querySelector('.hero__ui')
const cue = hero.querySelector('.scrollcue')
const glass = hero.querySelector('.hero__glass')
const white = hero.querySelector('.hero__white')
if (!isTouch) {
  addEventListener('pointermove', (e) => {
    scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1))
  }, { passive: true })
}
new ResizeObserver(() => scene.resize()).observe(canvas)
let heroOnScreen = true
new IntersectionObserver(([e]) => {
  heroOnScreen = e.isIntersecting
  heroOnScreen ? scene.start() : scene.stop()
}).observe(hero)

const fontsReady = document.fonts?.ready ?? Promise.resolve()
Promise.all([scene.load(), fontsReady])
  .then(() => {
    hero.classList.add('is-live')
    if (heroOnScreen) scene.start()
  })
  .catch((err) => console.error(err)) // the still photo stays as the hero

// ---------- autopilot: one scroll down inside the hero plays it through to the next section;
// one scroll up from there plays it back to the top. Visitors never scrub the scene by hand.
const heroTravel = () => hero.offsetHeight - innerHeight
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
function glide([[to, duration], ...rest]) {
  lenis.scrollTo(to, {
    duration, easing: easeInOut, lock: true, force: true,
    onComplete: () => (rest.length ? glide(rest) : (piloting = false)),
  })
}
lenis.on('scroll', ({ scroll, direction }) => {
  if (piloting || motion.reduced) return
  const next = hero.offsetTop + hero.offsetHeight // top of the next section
  const dayEnd = ENTER_START * heroTravel()
  if (scroll <= 1 || scroll >= next - 1) return
  piloting = true
  if (direction > 0) {
    glide(scroll < dayEnd
      ? [[dayEnd, DAY_SECONDS * (1 - scroll / dayEnd) + 0.2], [next, WALK_SECONDS]]
      : [[next, WALK_SECONDS * ((next - scroll) / (next - dayEnd)) + 0.2]])
  } else {
    glide(scroll > dayEnd
      ? [[dayEnd, WALK_SECONDS * ((scroll - dayEnd) / (next - dayEnd))], [0, DAY_SECONDS * 0.7]]
      : [[0, DAY_SECONDS * 0.7 * (scroll / dayEnd) + 0.2]])
  }
})
// touch scrolling is native: hold the page still while the autopilot drives
addEventListener('touchmove', (e) => piloting && e.cancelable && e.preventDefault(), { passive: false })

// the wordmark builds itself: letters rise, the two bars cross in from either side
if (!motion.reduced) {
  gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } })
    .from(title.querySelectorAll('.glyph:not(.glyph--bar) .glyph__inner'), { yPercent: 90, autoAlpha: 0, duration: 1.4, stagger: 0.06 }, 0)
    .from(title.querySelector('.glyph--a .glyph__inner'), { yPercent: -160, xPercent: 60, autoAlpha: 0, duration: 1.6 }, 0.2)
    .from(title.querySelector('.glyph--b .glyph__inner'), { yPercent: 160, xPercent: -60, autoAlpha: 0, duration: 1.6 }, 0.3)
}

motion.onChange((reduced) => {
  lenis.options.lerp = reduced ? 1 : smoothLerp
  if (reduced) parallaxEls.forEach((el) => el.style.removeProperty('--parallax-y'))
})

function tick() {
  // the hero: day first, then the walk in
  const hp = progressOf(hero)
  const enter = clamp(0, 1, (hp - ENTER_START) / (1 - ENTER_START))
  scene.setProgress(clamp(0, 1, hp / ENTER_START)) // the day rewinds when the scroll does
  scene.setEnter(enter)
  // the words and the action stay up through the whole day and leave as we walk in
  const leave = seg(enter, 0, 0.14)
  heroUi.style.opacity = (1 - leave).toFixed(3)
  heroUi.style.transform = `translateY(${(-50 * leave).toFixed(1)}px)`
  heroUi.style.visibility = leave > 0.98 ? 'hidden' : ''
  cue.style.opacity = (1 - seg(hp, 0, 0.03)).toFixed(3)
  glass.style.opacity = (seg(enter, 0.45, 0.8) * (1 - seg(enter, 0.86, 1))).toFixed(3)
  white.style.opacity = seg(enter, 0.8, 1).toFixed(3)

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
  window.__hero = scene
  window.__step = (n = 3) => {
    for (let i = 0; i < n; i++) {
      gsap.ticker.tick()
      if (scene.ready) scene.update()
    }
  }
  window.__at = (id, q) => {
    const el = document.getElementById(id)
    lenis.scrollTo(el.offsetTop + q * (el.offsetHeight - innerHeight), { immediate: true, force: true })
    window.__step(4)
  }
}
