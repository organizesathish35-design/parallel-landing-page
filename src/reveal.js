// Phones: the scenes are flat sections there, so things arrive as they scroll in.
// Text rises, footage opens from a slightly cropped frame, swipe rows slide in.
// Each element animates once, then its reveal classes are removed so its own
// hover/press transitions come back. Desktop keeps its pinned choreography.
import { motion } from './motion.js'

const mobile = matchMedia('(max-width: 720px)')

const TEXT = [
  '.room:not(.room--screening) .room__head > :not(div)', '.room__head--row > div > *', '.room__head--lab > *',
  '.process__copy > .eyebrow', '.ptext > *',
  '.story__copy > *',
  '.contact-sec__copy > *', '.contact a',
]
const MEDIA = ['.script', '.panel', '.shoot', '.compare', '.story__photo', '.contact-sec__form']
const ROW = ['.strip .card', '.lab__col .card:not([inert])']

const STEP = 90 // ms between siblings
const MAX_STEPS = 5
const CLASSES = ['rv', 'rv--media', 'rv--row', 'is-in']

const done = (el) => {
  el.classList.remove(...CLASSES)
  el.style.removeProperty('--rv-d')
}
function show(el) {
  el.classList.add('is-in')
  const d = parseFloat(el.style.getPropertyValue('--rv-d')) || 0
  setTimeout(() => done(el), 1500 + d)
}

const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return
    io.unobserve(e.target)
    show(e.target)
  }),
  { rootMargin: '0px 0px -10% 0px' },
)

function mark(selectors, kind) {
  document.querySelectorAll(selectors.join(',')).forEach((el) => {
    if (el.classList.contains('rv')) return
    el.classList.add('rv')
    if (kind) el.classList.add(kind)
  })
}

function init() {
  if (!mobile.matches || motion.reduced) return
  mark(TEXT)
  mark(MEDIA, 'rv--media')
  mark(ROW, 'rv--row')
  const items = [...document.querySelectorAll('.rv')]
  // stagger siblings that arrive together
  items.forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('rv'))
    const i = Math.min(sibs.indexOf(el), MAX_STEPS)
    if (i > 0) el.style.setProperty('--rv-d', `${i * STEP}ms`)
  })
  // anything already scrolled past (deep link, reload mid-page) is simply there
  items.forEach((el) => (el.getBoundingClientRect().bottom < 0 ? done(el) : io.observe(el)))
}

const showAll = () => document.querySelectorAll('.rv').forEach((el) => (io.unobserve(el), done(el)))

// call once the rooms have built their cards, panels and script
export function initReveal() {
  // leaving the phone layout, or pausing motion, shows everything at once
  mobile.addEventListener('change', (e) => (e.matches ? init() : showAll()))
  motion.onChange((reduced) => reduced && showAll())

  // the script page: as you scroll, the highlighter sweeps each beat while it
  // crosses the lower part of the screen, and its label slides in (as on desktop)
  const beats = [...document.querySelectorAll('.script p:has(mark)')]
  let queued = false
  const sweep = () => {
    queued = false
    if (!mobile.matches) return
    const vh = innerHeight
    beats.forEach((p) => {
      const hl = motion.reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.85 - p.getBoundingClientRect().top) / (vh * 0.25)))
      p.style.setProperty('--hl', hl.toFixed(3))
    })
  }
  addEventListener('scroll', () => queued || (queued = true, requestAnimationFrame(sweep)), { passive: true })
  sweep()

  // a page opened in a hidden tab has no width yet: decide once it has one
  if (innerWidth) init()
  else addEventListener('resize', init, { once: true })
}
