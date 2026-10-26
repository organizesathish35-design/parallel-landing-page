import gsap from 'gsap'
import {
  byId, fmtDur, media, onAir, script, panels, compare, crew,
  films, filmFormats, labTracks, labSteps, sets, podcastSteps, contact,
} from './content/site.js'
import { motion } from './motion.js'

const { clamp, mapRange } = gsap.utils
// Phones get their own version: every scene is a normal section with native
// scroll (no pinning), so the scroll-driven choreography below is skipped there.
const mobile = matchMedia('(max-width: 720px)')
const ease = (t) => t * t * (3 - 2 * t)
const seg = (q, a, b) => ease(clamp(0, 1, (q - a) / (b - a)))
const $ = (root, s) => root.querySelector(s)
const h = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}

// progress of a tall section while its sticky stage is pinned: 0 at pin, 1 at release
export function progressOf(el) {
  const r = el.getBoundingClientRect()
  return clamp(0, 1, -r.top / Math.max(1, r.height - innerHeight))
}
const near = (el) => {
  const r = el.getBoundingClientRect()
  return r.bottom > -innerHeight * 0.5 && r.top < innerHeight * 1.5
}

// play only what is on screen, and nothing while motion is paused
const onScreen = (el) => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < innerHeight
}
const autoplaying = new Set()
const vis = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const v = e.target
    if (e.isIntersecting && !motion.reduced) v.play().catch(() => {})
    else v.pause()
  }
}, { threshold: 0.15 })
function autoplay(v) {
  v.muted = true
  v.playsInline = true
  autoplaying.add(v)
  vis.observe(v)
}
function setSrc(v, src) {
  if (v.getAttribute('src') === src) return
  v.src = src
  if (onScreen(v) && !motion.reduced) v.play().catch(() => {})
}
const cards = new Set()
motion.onChange((reduced) => {
  autoplaying.forEach((v) => (reduced || !onScreen(v) ? v.pause() : v.play().catch(() => {})))
  if (reduced) cards.forEach((c) => c._stop())
})

function card(v, { wide = true } = {}) {
  const m = media(v.id)
  const el = h(`
    <button class="card" type="button" data-id="${v.id}">
      <span class="card__media" style="--car:${v.w}/${v.h}">
        <img src="${m.thumb}" alt="" loading="lazy" decoding="async" />
        <video muted playsinline loop preload="none"></video>
        <span class="card__play" aria-hidden="true">▶</span>
      </span>
      <span class="card__title">${v.title}</span>
      ${wide ? `<span class="card__meta"><span>${v.client}</span><span>${fmtDur(v.dur)}</span></span>` : ''}
    </button>`)
  el.setAttribute('aria-label', `Play ${v.title} — ${v.client}`)
  const video = el.querySelector('video')
  const live = () => {
    if (motion.reduced) return
    if (!video.src) video.src = m.loop
    video.play().then(() => el.classList.add('is-live')).catch(() => {})
  }
  const idle = () => {
    if (el.classList.contains('is-active')) return // the featured film keeps playing
    video.pause()
    el.classList.remove('is-live')
  }
  el.addEventListener('pointerenter', live)
  el.addEventListener('pointerleave', idle)
  el.addEventListener('focus', live)
  el.addEventListener('blur', idle)
  el._live = live
  el._idle = idle
  el._stop = () => {
    video.pause()
    el.classList.remove('is-live')
  }
  cards.add(el)
  return el
}

export function initRooms({ lenis, lightbox }) {
  const play = (id, sub) => {
    const v = byId[id]
    const m = media(id)
    lightbox.open({ src: m.full, poster: m.poster, heading: v.title, sub: sub || v.client })
  }
  const updaters = []

  // ================= 01 SCREENING ROOM =================
  {
    const room = document.getElementById('screening')
    const screen = $(room, '[data-screen]')
    const video = $(room, '[data-screen-video]')
    const stat = $(room, '[data-static]')
    const head = $(room, '[data-head]')
    const reel = $(room, '[data-reel]')
    const list = $(room, '[data-reel-list]')
    const kind = $(room, '[data-reel-kind]')
    const title = $(room, '[data-reel-title]')
    const line = $(room, '[data-reel-line]')
    autoplay(video)

    const START = 0.3 // the reel starts once the screen fills the room
    const span = (1 - START) / onAir.length
    const items = onAir.map((o, i) => {
      const v = byId[o.id]
      const b = h(`<li><button type="button"><span>${v.title}</span><em>${v.client}</em></button></li>`)
      b.firstElementChild.addEventListener('click', () => {
        const top = room.offsetTop + (START + span * (i + 0.35)) * (room.offsetHeight - innerHeight)
        lenis.scrollTo(top, { duration: 1.4 })
      })
      list.append(b)
      return b.firstElementChild
    })
    let current = -1
    function tune(i) {
      if (i === current) return
      current = i
      const o = onAir[i], v = byId[o.id]
      gsap.fromTo(stat, { opacity: 0.9 }, { opacity: 0, duration: 0.45, ease: 'power2.in' })
      setSrc(video, media(o.id).full) // the real 720p film on the big screen
      video.poster = media(o.id).poster
      kind.textContent = `${o.kind} · ${fmtDur(v.dur)}`
      title.textContent = `${v.title}`
      line.textContent = `${v.client} — ${o.line}`
      items.forEach((b, j) => b.classList.toggle('is-on', j === i))
      gsap.fromTo([kind, title, line], { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out' })
    }
    tune(0)
    $(room, '[data-reel-play]').addEventListener('click', () => play(onAir[current].id, onAir[current].kind))
    screen.addEventListener('click', () => play(onAir[current].id, onAir[current].kind))

    // phones: the player grows from under the heading to full bleed, and the
    // credits ride directly beneath it, so the pinned screen never has dead space
    function phoneLayout(W, H, g) {
      const w0 = W - 2 * g, w1 = W, h1 = (W * 9) / 16
      const bar = 72 // the quote bar along the bottom
      // the heading and the small player start as one group, centred above the bar
      const top = Math.max(40, (H - bar - (head.offsetHeight + 24 + (w0 * 9) / 16)) / 2)
      head.style.top = `${top.toFixed(1)}px`
      const y0 = top + head.offsetHeight + 24
      const gap = 28 // player to credits
      const group = h1 + gap + reel.offsetHeight
      const y1 = Math.max(72, (H - bar - group) / 2 + 8)
      reel.style.setProperty('--reel-y', `${(y1 + h1 + gap).toFixed(1)}px`)
      return { w0, x0: g, y0, w1, x1: 0, y1 }
    }

    updaters.push(() => {
      if (!near(room)) return
      const q = progressOf(room)
      const grow = seg(q, 0.04, START) // walk up to the screen
      const W = innerWidth, H = innerHeight
      const g = W <= 720 ? 22 : Math.min(88, Math.max(24, W * 0.05)) // matches --gutter
      const wide = W / H > 1.2 && W > 1100
      let w0, x0, y0, w1, x1, y1
      if (mobile.matches) ({ w0, x0, y0, w1, x1, y1 } = phoneLayout(W, H, g))
      else {
        head.style.top = ''
        // start: beside the heading (wide) or under it (tall)
        w0 = wide ? W * 0.44 : W - 2 * g
        x0 = wide ? W - g - w0 : g
        y0 = wide ? (H - (w0 * 9) / 16) / 2 + 20 : H * 0.52
        // end: the biggest 16:9 player that still leaves room for the credits below it
        w1 = Math.min(W - 2 * g, ((H - (wide ? 96 : 90) - (wide ? 210 : 280)) * 16) / 9)
        x1 = (W - w1) / 2
        y1 = wide ? 88 : Math.max(96, (H - (w1 * 9) / 16 - 250) / 2 + 40)
      }
      const w = w0 + (w1 - w0) * grow
      screen.style.setProperty('--w', `${w.toFixed(1)}px`)
      screen.style.setProperty('--x', `${(x0 + (x1 - x0) * grow).toFixed(1)}px`)
      screen.style.setProperty('--y', `${(y0 + (y1 - y0) * grow).toFixed(1)}px`)
      head.style.opacity = (1 - seg(q, 0.08, 0.2)).toFixed(3)
      head.style.transform = `translateY(${-40 * seg(q, 0.08, 0.2)}px)`
      reel.style.opacity = seg(q, START - 0.04, START + 0.03).toFixed(3)
      const k = clamp(0, onAir.length - 1, Math.floor((q - START) / span))
      tune(q < START ? 0 : k)
      items.forEach((b, j) => b.style.setProperty('--fill', clamp(0, 1, (q - START - span * j) / span).toFixed(3)))
    })
  }

  // ================= HOW WE MAKE A TVC — a fly-through, far layers drift slower =================
  {
    const room = document.getElementById('process')
    const depth = $(room, '[data-depth]')
    const layers = [...room.querySelectorAll('[data-layer]')].sort((a, b) => a.dataset.layer - b.dataset.layer)
    const texts = [...room.querySelectorAll('[data-ptext]')]
    const rail = [...room.querySelectorAll('[data-rail] li')]

    // the script page, with the three beats highlighted
    const sheet = $(room, '[data-script]')
    const marks = []
    for (const l of script) {
      const p = document.createElement('p')
      p.className = l.t
      if (l.hl) {
        const m = document.createElement('mark')
        m.textContent = l.text
        const n = document.createElement('span')
        n.className = 'note'
        n.textContent = l.hl
        p.append(m, n)
        marks.push(p)
      } else p.textContent = l.text
      sheet.append(p)
    }

    // the storyboard wall: panels hung at slightly different depths
    const board = $(room, '[data-board]')
    const spots = [[-19, -21, 120], [3, -25, -80], [20, -9, 60], [-15, 15, -40], [5, 21, 140], [22, 25, -120]]
    const panelsEls = spots.map(([x, y, dz], i) => {
      const im = h(`<img class="panel" src="/story/panel-${panels[i]}.webp" alt="" loading="lazy" decoding="async" />`)
      im.dataset.x = x
      im.dataset.y = y
      im.dataset.dz = dz
      board.append(im)
      return im
    })

    // the shoot: real 1080p BTS footage
    const bts = $(room, '[data-bts]')
    bts.src = media('bts').loop
    bts.poster = media('bts').poster
    autoplay(bts)
    $(room, '[data-crew]').innerHTML = crew.map(([t]) => `<li>${t}</li>`).join('')
    $(room, '[data-play="bts"]').addEventListener('click', () => play('bts', 'Behind the scenes · ZestBot shoot'))

    // sketch vs screen
    const box = $(room, '[data-compare]')
    const fin = $(room, '[data-compare-final]')
    const ink = $(room, '[data-compare-ink]')
    const handle = $(room, '[data-compare-handle]')
    const chips = $(room, '[data-compare-chips]')
    let touched = false
    const setX = (x) => {
      box.style.setProperty('--x', `${x}%`)
      handle.setAttribute('aria-valuenow', Math.round(x))
      handle.setAttribute('aria-valuetext', `${Math.round(x)}% storyboard`)
    }
    const pick = (id) => {
      fin.src = `/story/final-${id}.webp`
      ink.src = `/story/ink-${id}.webp`
      chips.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.id === id))
    }
    compare.forEach(({ id, label }) => {
      const b = h(`<button type="button" data-id="${id}">${label}</button>`)
      b.addEventListener('click', () => pick(id))
      chips.append(b)
    })
    pick(compare[0].id)
    const drag = (e) => {
      const r = box.getBoundingClientRect()
      touched = true
      setX(clamp(2, 98, ((e.clientX - r.left) / r.width) * 100))
    }
    box.addEventListener('pointerdown', (e) => {
      drag(e)
      box.setPointerCapture(e.pointerId)
      box.addEventListener('pointermove', drag)
    })
    box.addEventListener('pointerup', () => box.removeEventListener('pointermove', drag))
    handle.addEventListener('keydown', (e) => {
      const cur = parseFloat(box.style.getPropertyValue('--x')) || 50
      const to = { ArrowLeft: cur - 5, ArrowDown: cur - 5, ArrowRight: cur + 5, ArrowUp: cur + 5, Home: 2, End: 98 }[e.key]
      if (to === undefined) return
      touched = true
      setX(clamp(2, 98, to))
      e.preventDefault()
    })

    // phones: the first time the slider is on screen, it shows that it can be dragged
    const sweep = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || !mobile.matches) return
      sweep.disconnect()
      if (touched || motion.reduced) return
      const o = { x: 50 }
      gsap.timeline({ delay: 0.6, onUpdate: () => !touched && setX(o.x) })
        .to(o, { x: 84, duration: 0.8, ease: 'power2.inOut' })
        .to(o, { x: 18, duration: 1.2, ease: 'power2.inOut' })
        .to(o, { x: 50, duration: 0.8, ease: 'power2.inOut' })
    }, { threshold: 0.6 })
    sweep.observe(box)

    // camera path: hold on each layer long enough to read it, glide between them
    const GAP = 1600 // z distance between layers
    const P = 1100 // perspective distance
    const holds = [[0, 0.1], [0.28, 0.4], [0.58, 0.7], [0.88, 1]]
    const camAt = (q) => {
      for (let i = 0; i < holds.length; i++) {
        if (q <= holds[i][1]) return i * GAP
        if (i < holds.length - 1 && q < holds[i + 1][0]) return (i + seg(q, holds[i][1], holds[i + 1][0])) * GAP
      }
      return (holds.length - 1) * GAP
    }
    let stage = -1
    const place = (el, relZ, x, y, extraRot = 0) => {
      const s = P / (P - relZ)
      // ahead: hidden in the white haze until it is the next stop; behind the camera: gone
      const o = relZ > 0 ? 1 - seg(relZ, 120, 520) : seg(relZ, -1.2 * GAP, -0.35 * GAP)
      // anchored at the vanishing point; the trailing translate centres the element on it
      el.style.transform = `translate3d(${(x * s).toFixed(2)}vw, ${(y * s).toFixed(2)}vh, 0) scale(${s.toFixed(4)}) rotate(${extraRot}deg) translate(-50%, -50%)`
      el.style.opacity = o.toFixed(3)
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
      el.style.zIndex = String(Math.round(5000 + relZ))
      return o
    }

    updaters.push(() => {
      if (!near(room) || mobile.matches) return
      const q = progressOf(room)
      const cam = camAt(q)
      const wide = innerWidth > 1100
      layers.forEach((layer, i) => {
        const relZ = cam - i * GAP
        if (layer === board) {
          // each panel hangs at its own depth, so the wall itself has parallax
          panelsEls.forEach((im) => place(im, relZ + +im.dataset.dz, +im.dataset.x * (wide ? 1 : 1.3), +im.dataset.y))
          return
        }
        place(layer, relZ, 0, 0, i === 0 ? -1.5 : 0)
        layer.style.pointerEvents = Math.abs(relZ) < 200 ? 'auto' : 'none'
      })
      depth.style.setProperty('--vx', wide ? '67vw' : '50vw')

      const s = Math.round(cam / GAP)
      if (s !== stage) {
        stage = s
        texts.forEach((t, i) => t.classList.toggle('is-on', i === s))
        rail.forEach((r, i) => {
          r.classList.toggle('is-on', i === s)
          i === s ? r.setAttribute('aria-current', 'step') : r.removeAttribute('aria-current')
          r.classList.toggle('is-done', i < s)
        })
      }
      marks.forEach((m, i) => m.style.setProperty('--hl', seg(q, 0.01 + i * 0.03, 0.04 + i * 0.03).toFixed(3)))
      if (!touched) setX(mapRange(0, 1, 88, 14, seg(q, 0.9, 1)))
    })
  }

  // ================= 04 EDIT SUITE =================
  {
    const room = document.getElementById('edit')
    const track = $(room, '[data-strip-track]')
    $(room, '[data-formats]').innerHTML = filmFormats.map((f) => `<li>${f}</li>`).join('')
    const cards = films.map((id) => {
      const c = card(byId[id])
      c.addEventListener('click', () => play(id))
      track.append(c)
      return c
    })
    let active = -1
    const setActive = (i) => {
      if (i === active) return
      active = i
      cards.forEach((c, j) => {
        c.classList.toggle('is-active', j === i)
        j === i ? c._live() : c._idle()
      })
    }
    setActive(0)
    // the film nearest the middle plays on the monitor
    const pickCentre = () => {
      let best = 0, bd = Infinity
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - innerWidth / 2)
        if (d < bd) (bd = d), (best = i)
      })
      setActive(best)
    }
    $(room, '[data-strip]').addEventListener('scroll', () => mobile.matches && pickCentre(), { passive: true })
    updaters.push(() => {
      if (!near(room) || mobile.matches) return
      const q = progressOf(room)
      const max = Math.max(0, track.scrollWidth - innerWidth)
      const x = -max * seg(q, 0.08, 0.94)
      track.style.transform = `translate3d(${x}px,0,0)`
      pickCentre()
    })
  }

  // ================= 05 RENDER LAB =================
  {
    const room = document.getElementById('lab')
    const wrap = $(room, '[data-lab]')
    $(room, '[data-lab-steps]').innerHTML = labSteps.map((s) => `<li>${s}</li>`).join('')
    const cols = labTracks.map((ids) => {
      const col = h('<div class="lab__col"></div>')
      // doubled so the column never runs out while it drifts
      ;[...ids, ...ids].forEach((id, i) => {
        const c = card(byId[id], { wide: false })
        c.addEventListener('click', () => play(id))
        // the second copy is only there for the drift: hide it from keyboard and screen readers
        if (i >= ids.length) c.inert = true
        col.append(c)
      })
      wrap.append(col)
      return col
    })
    // hovering is not needed here: the visible cards play on their own
    // 1080p loops are heavy: play at most four of the visible cards at once
    const visible = new Set()
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : (visible.delete(e.target), e.target._idle())))
      ;[...visible].forEach((c, i) => (i < 4 ? c._live() : c._idle()))
    }, { threshold: 0.5 })
    let watching = false
    updaters.push(() => {
      const on = near(room)
      if (on !== watching) {
        watching = on
        room.querySelectorAll('.card').forEach((c) => (on ? io.observe(c) : (io.unobserve(c), c._idle())))
      }
      if (!on || mobile.matches) return
      const q = progressOf(room)
      cols.forEach((c, i) => {
        const dir = i % 2 ? 1 : -1
        const y = dir > 0 ? -50 + q * 30 : -q * 30
        c.style.transform = `translate3d(0,${y}%,0)`
      })
    })
  }

  // ================= 06 STORY ROOM =================
  {
    const room = document.getElementById('story-room')
    const bg = $(room, '[data-sets-bg]')
    const picker = $(room, '[data-sets]')
    const colors = { teal: '#18b7c4', blush: '#f4a07c', forest: '#5fae3a', gold: '#d9a441', indigo: '#243a86', sage: '#9fc3b8' }
    // ~700w for phones, full size for wide screens; the photo spans about half the viewport on desktop
    const photo = (name, alt) => h(`<img src="/studio/${name}.webp" srcset="/studio/${name}-sm.webp 700w, /studio/${name}.webp 1800w"
      sizes="(max-width: 1100px) 100vw, 55vw" alt="${alt}" loading="lazy" decoding="async" />`)
    const imgs = sets.map(([id, name]) => {
      const i = photo(`set-${id}`, `The ${name} set in the Story Room`)
      bg.append(i)
      return i
    })
    const live = photo('live-1', 'A podcast being recorded in the Story Room')
    bg.prepend(live)
    let chosen = null, touched = false
    const btns = sets.map(([id, name], i) => {
      const b = h(`<button type="button" role="radio" aria-checked="false" style="--c:${colors[id]}"><i></i>${name}</button>`)
      b.addEventListener('click', () => {
        touched = true
        choose(i)
      })
      picker.append(b)
      return b
    })
    function choose(i) {
      if (i === chosen) return
      chosen = i
      // only the photo on show is announced
      ;[live, ...imgs].forEach((im, j) => {
        const on = j - 1 === i
        im.classList.toggle('is-on', on)
        im.toggleAttribute('aria-hidden', !on)
      })
      btns.forEach((b, j) => {
        b.setAttribute('aria-checked', String(j === i))
        b.tabIndex = j === Math.max(0, i) ? 0 : -1
      })
    }
    // radio group keyboard pattern: one tab stop, arrows move the choice
    picker.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
      if (!step) return
      e.preventDefault()
      touched = true
      const next = chosen < 0 ? (step > 0 ? 0 : btns.length - 1) : (chosen + step + btns.length) % btns.length
      choose(next)
      btns[next].focus()
    })
    choose(-1)
    $(room, '[data-pod]').innerHTML = podcastSteps.map(([k, d], i) => `<li><b>${k}</b><span>${d}</span></li>`).join('')
    updaters.push(() => {
      if (!near(room) || touched || mobile.matches) return
      const q = progressOf(room)
      choose(q < 0.2 ? -1 : Math.min(sets.length - 1, Math.floor(((q - 0.2) / 0.8) * sets.length)))
    })
  }

  // ================= ROOFTOP (contact) =================
  {
    const box = document.querySelector('[data-contact]')
    const items = [
      ['Call', contact.phone, `tel:${contact.tel}`],
      ['WhatsApp', 'Chat for a quote', contact.whatsapp],
      ['Email', contact.email, `mailto:${contact.email}`],
      ['Studio', contact.address, 'https://maps.google.com/?q=' + encodeURIComponent(contact.address)],
    ]
    box.innerHTML = items
      .map(([k, v, href]) => `<a href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span class="contact__k">${k}</span><span class="contact__v">${v}</span></a>`)
      .join('')
    document.querySelector('[data-cities]').textContent = contact.cities
    document.querySelectorAll('[data-whatsapp]').forEach((a) => (a.href = contact.whatsapp))
  }

  return () => updaters.forEach((u) => u())
}
