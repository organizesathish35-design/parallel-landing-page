import './styles.css'
import Lenis from 'lenis'
import gsap from 'gsap'
import { HeroScene } from './hero/HeroScene.js'
import { wordmark } from './logo.js'
import { createLightbox } from './lightbox.js'
import { initRooms, progressOf } from './rooms.js'

const { clamp } = gsap.utils
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const seg = (q, a, b) => {
  const t = clamp(0, 1, (q - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// ---------- wordmarks
document.querySelector('[data-logo]').innerHTML = wordmark()
const title = document.querySelector('[data-wordmark]')
title.innerHTML = wordmark({ title: 'PARALLEL' })

// ---------- smooth scroll
// Touch devices already have momentum scrolling. Keep Lenis involved so the
// sticky scenes and anchor jumps stay in the same timing system, but use a
// slightly softer interpolation so it never feels like the page is dragging.
const isTouch = matchMedia('(pointer: coarse)').matches
const lenis = new Lenis({
  lerp: reducedMotion ? 1 : (isTouch ? 0.12 : 0.085),
  wheelMultiplier: 0.9,
  touchMultiplier: 1,
  smoothWheel: true,
  syncTouch: false,
})
lenis.stop()
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
document.querySelectorAll('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')
    if (id.length < 2 || !document.querySelector(id)) return
    e.preventDefault()
    lenis.scrollTo(id === '#top' ? 0 : id, { duration: 2.4 })
  }),
)

const lightbox = createLightbox(lenis)
const updateRooms = initRooms({ lenis, lightbox })

// ---------- the building (3D exterior, reused on the rooftop)
const hero = document.getElementById('hero')
const heroStage = hero.querySelector('.hero__stage')
const roof = document.getElementById('rooftop')
const roofStage = roof.querySelector('[data-rooftop-stage]')
const canvas = document.getElementById('gl')
const scene = new HeroScene(canvas)
const root = document.documentElement
const countEl = document.getElementById('loader-count')
// One scroll plays the whole day: the first nudge starts sunrise, the sun sets on its own,
// and the rest of the hero is the walk into the building.
const DAY_TRIGGER = 0.015
const ENTER_START = 0.3
const DAY_SECONDS = 4.2
const day = { v: 0 }
let dayTarget = 0
function playDay(to, seconds) {
  dayTarget = to
  gsap.to(day, { v: to, duration: seconds, ease: 'sine.inOut', overwrite: true })
}

const intro = hero.querySelector('.intro')
const cue = hero.querySelector('.scrollcue')
const enterCue = hero.querySelector('.enter-cue')
const glass = hero.querySelector('.hero__glass')
const white = document.createElement('div')
white.className = 'hero__white'
heroStage.append(white)

if (!isTouch) {
  addEventListener('pointermove', (e) => {
    scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1))
  }, { passive: true })
}
new ResizeObserver(() => scene.resize()).observe(canvas)

// the one canvas lives wherever it is needed
const seen = new Map()
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => seen.set(e.target, e.isIntersecting))
  if (seen.get(roof)) {
    if (canvas.parentElement !== roofStage) roofStage.prepend(canvas)
    scene.setMode('roof')
    scene.start(onFrame)
  } else if (seen.get(hero)) {
    if (canvas.parentElement !== heroStage) heroStage.prepend(canvas)
    scene.setMode('street')
    scene.start(onFrame)
  } else scene.stop()
})
io.observe(hero)
io.observe(roof)

function onFrame({ el }) {
  if (scene.mode === 'roof') return
  root.style.setProperty('--shade', (0.2 + clamp(0, 1, el / 40) * 0.36).toFixed(3))
}

const rooms = [...document.querySelectorAll('[data-room]')]
const navLinks = [...document.querySelectorAll('.nav__links a')]
const parallaxEls = [...document.querySelectorAll('[data-parallax]')]

function tick() {
  // exterior
  const hp = progressOf(hero)
  const enter = clamp(0, 1, (hp - ENTER_START) / (1 - ENTER_START))
  const want = hp > DAY_TRIGGER ? 1 : 0
  if (want !== dayTarget) playDay(want, want ? DAY_SECONDS : 2.2)
  // scrolled on before the sun went down: hurry the day along
  if (enter > 0.02 && day.v < 1 && !day.hurry) {
    day.hurry = true
    gsap.to(day, { v: 1, duration: 0.9, ease: 'power2.out', overwrite: true, onComplete: () => (day.hurry = false) })
  }
  if (scene.mode === 'street') {
    scene.setProgress(day.v)
    scene.setEnter(enter)
  } else scene.setRoof(progressOf(roof))

  // the statement stays up through the whole day and leaves as we walk in
  intro.style.opacity = (1 - seg(enter, 0, 0.14)).toFixed(3)
  intro.style.transform = `translateY(${-50 * seg(enter, 0, 0.14)}px)`
  cue.style.opacity = (1 - seg(hp, 0, DAY_TRIGGER * 2)).toFixed(3)
  // once the sun is down, invite the next scroll
  enterCue.style.opacity = (seg(day.v, 0.85, 1) * (1 - seg(enter, 0.25, 0.4))).toFixed(3)
  glass.style.opacity = (seg(enter, 0.45, 0.8) * (1 - seg(enter, 0.86, 1))).toFixed(3)
  white.style.opacity = seg(enter, 0.8, 1).toFixed(3)

  // Shared depth pass: each marked layer gets a small offset based on its
  // distance from the viewport centre. The effect is deliberately subtle so
  // the page feels continuous rather than like a collection of animations.
  if (!reducedMotion) parallaxEls.forEach((el) => {
    const parent = el.closest('.hero, .room, .process, .rooftop')
    if (!parent) return
    const b = parent.getBoundingClientRect()
    if (b.bottom < -innerHeight || b.top > innerHeight) return
    // The content is sticky, so its own rect does not change while a scene is
    // pinned. Use the parent section's travel instead to create real depth.
    const q = progressOf(parent) * 2 - 1
    el.style.setProperty('--parallax-y', `${(q * Number(el.dataset.parallax || 0)).toFixed(2)}px`)
  })

  // Navigation state
  const mid = innerHeight / 2
  const inHero = hero.getBoundingClientRect().bottom > mid
  const here = inHero ? null : rooms.find((s) => {
    const b = s.getBoundingClientRect()
    return b.top <= mid && b.bottom > mid
  })
  // dark type over the white rooms, light type over the photos outside
  const light = !!rooms.find((s) => {
    const b = s.getBoundingClientRect()
    return b.top <= 60 && b.bottom > 60
  }) || enter > 0.9
  root.classList.toggle('is-light', light)
  navLinks.forEach((a) => a.classList.toggle('is-here', !!here && a.getAttribute('href') === `#${here.id}`))

  updateRooms()
}
gsap.ticker.add(tick)

// ---------- load + intro
const counter = { v: 0 }
function setCount(v) {
  gsap.to(counter, { v: v * 100, duration: 0.6, overwrite: true, onUpdate: () => (countEl.textContent = String(Math.round(counter.v)).padStart(3, '0')) })
}

const fontsReady = document.fonts?.ready ?? Promise.resolve()
Promise.all([scene.load(setCount), fontsReady])
  .then(() => {
    setCount(1)
    tick()
    scene.start(onFrame)
    playIntro()
  })
  .catch((err) => {
    console.error(err)
    document.getElementById('loader').remove()
    document.body.classList.remove('is-loading')
    lenis.start()
  })

function playIntro() {
  const glyphs = title.querySelectorAll('.glyph:not(.glyph--bar) .glyph__inner')
  gsap.timeline({ delay: 0.5, defaults: { ease: 'expo.out' } })
    .to('#loader', { autoAlpha: 0, duration: 1.1, ease: 'power2.inOut' })
    .add(() => {
      document.body.classList.remove('is-loading')
      lenis.start()
    }, 0.6)
    .from(glyphs, { yPercent: 90, autoAlpha: 0, duration: 1.4, stagger: 0.06 }, 0.55)
    .from(title.querySelector('.glyph--a .glyph__inner'), { yPercent: -160, xPercent: 60, autoAlpha: 0, duration: 1.6 }, 0.75)
    .from(title.querySelector('.glyph--b .glyph__inner'), { yPercent: 160, xPercent: -60, autoAlpha: 0, duration: 1.6 }, 0.85)
    .from('.intro .eyebrow, .intro .statement, .intro .tagline', { y: 20, autoAlpha: 0, duration: 1.2, stagger: 0.12 }, 1.1)
    .from('.nav > *', { y: -12, autoAlpha: 0, duration: 1.2, stagger: 0.06, clearProps: 'opacity,visibility,transform' }, 1.2)
}

if (import.meta.env.DEV) {
  window.__hero = scene
  window.__day = day
  // step the page by hand (the preview pane can pause requestAnimationFrame)
  window.__step = (n = 3) => {
    for (let i = 0; i < n; i++) {
      gsap.ticker.tick()
      scene.smooth = scene.progress
      scene.enterSmooth = scene.enter
      if (scene.ready) scene.update()
    }
  }
  window.__at = (id, q) => {
    const el = document.getElementById(id)
    lenis.scrollTo(el.offsetTop + q * (el.offsetHeight - innerHeight), { immediate: true, force: true })
    window.__step(4)
  }
}
