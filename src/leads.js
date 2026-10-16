// Lead capture: one quote form, mounted inline (contact section) and in the
// popup that every "Get a quote" opens. Plus exit intent on desktop and the
// sticky bar on phones. Where submissions go is set in content/site.js (leads).
import { contact, leads } from './content/site.js'

const SENT = 'parallel-lead'
const EXIT = 'parallel-exit'
const UTM = 'parallel-utm'

const store = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { sessionStorage.setItem(k, v) } catch {} },
}

// keep the campaign that brought the visitor, for the whole visit
const params = new URLSearchParams(location.search)
const utmNow = Object.fromEntries([...params].filter(([k]) => k.startsWith('utm_') || k === 'gclid' || k === 'fbclid'))
if (Object.keys(utmNow).length) store.set(UTM, JSON.stringify(utmNow))
const utm = () => JSON.parse(store.get(UTM) || '{}')

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function formHTML(p) {
  const needs = leads.needs
    .map((n, i) => `<label class="need"><input type="radio" name="need" value="${esc(n)}" id="${p}-need-${i}" /><span>${esc(n)}</span></label>`)
    .join('')
  return `
    <form class="lead" novalidate>
      <div class="field field--half">
        <label for="${p}-name">Your name</label>
        <input id="${p}-name" name="name" autocomplete="name" required aria-describedby="${p}-name-err" />
        <p class="field__err" id="${p}-name-err"></p>
      </div>
      <div class="field field--half">
        <label for="${p}-phone">Phone or WhatsApp</label>
        <input id="${p}-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required aria-describedby="${p}-phone-err" />
        <p class="field__err" id="${p}-phone-err"></p>
      </div>
      <div class="field">
        <label for="${p}-email">Email <span class="field__opt">optional</span></label>
        <input id="${p}-email" name="email" type="email" autocomplete="email" aria-describedby="${p}-email-err" />
        <p class="field__err" id="${p}-email-err"></p>
      </div>
      <fieldset class="field">
        <legend>What do you need? <span class="field__opt">optional</span></legend>
        <div class="needs">${needs}</div>
      </fieldset>
      <div class="field">
        <label for="${p}-brief">About the project <span class="field__opt">optional</span></label>
        <textarea id="${p}-brief" name="brief" rows="3" aria-describedby="${p}-brief-hint"></textarea>
        <p class="field__hint" id="${p}-brief-hint">Brand, product, on-air date, budget range: whatever you know so far.</p>
      </div>
      <div class="hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off" /></label></div>
      <button class="btn btn--accent btn--lg lead__submit" type="submit"><span>Get my quote</span><i aria-hidden="true">→</i></button>
      <p class="lead__note">We only use these details to reply to you.</p>
      <p class="lead__status" role="status" aria-live="polite"></p>
    </form>`
}

const rules = {
  name: (v) => (v.trim().length < 2 ? 'Please tell us your name.' : ''),
  phone: (v) => (v.replace(/\D/g, '').length < 8 ? 'Please add a phone or WhatsApp number we can reach.' : ''),
  email: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'That email looks incomplete. Check it, or leave it empty.' : ''),
}

function waLink(text) {
  return `${contact.whatsapp}?text=${encodeURIComponent(text)}`
}

function mount(el, source) {
  const p = `lead-${el.dataset.leadMount}`
  el.innerHTML = formHTML(p)
  const form = el.querySelector('form')
  form.dataset.source = source
  const status = form.querySelector('.lead__status')
  const submit = form.querySelector('.lead__submit')
  let tried = false

  const check = (name) => {
    const input = form.elements[name]
    const msg = rules[name](input.value)
    msg ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid')
    form.querySelector(`#${p}-${name}-err`).textContent = msg
    return msg
  }
  // validate as people leave a field, once they've typed in it or tried to send
  Object.keys(rules).forEach((name) =>
    form.elements[name].addEventListener('blur', (e) => {
      if (tried || e.target.value) check(name)
    }),
  )

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    tried = true
    if (form.elements.website.value) return // bots fill hidden fields
    const bad = Object.keys(rules).filter((name) => check(name))
    if (bad.length) {
      status.textContent = bad.length > 1 ? `Please check ${bad.length} fields.` : ''
      form.elements[bad[0]].focus()
      return
    }
    const data = Object.fromEntries(new FormData(form))
    delete data.website
    const lead = {
      ...data,
      source: form.dataset.source,
      page: location.href.split('#')[0],
      ...utm(),
    }

    // no endpoint yet: hand the brief to WhatsApp (must open synchronously, inside the click)
    if (!leads.endpoint) {
      const text = [
        `Hi PARALLEL, I'd like a quote.`,
        `Name: ${lead.name}`,
        `Phone: ${lead.phone}`,
        lead.email && `Email: ${lead.email}`,
        lead.need && `Need: ${lead.need}`,
        lead.brief && `About: ${lead.brief}`,
      ].filter(Boolean).join('\n')
      window.open(waLink(text), '_blank', 'noopener')
      done(el, lead, { whatsapp: waLink(text) })
      return
    }

    submit.disabled = true
    submit.querySelector('span').textContent = 'Sending…'
    status.textContent = ''
    try {
      const body = { ...lead, subject: `Quote request: ${lead.need || 'new project'} from ${lead.name}` }
      if (leads.accessKey) body.access_key = leads.accessKey
      const res = await fetch(leads.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(res.status)
      done(el, lead)
    } catch {
      submit.disabled = false
      submit.querySelector('span').textContent = 'Get my quote'
      // keep everything they typed; offer the direct lines
      status.innerHTML = `That didn't go through. Please try again, or reach us on <a href="${contact.whatsapp}" target="_blank" rel="noopener">WhatsApp</a> or <a href="tel:${contact.tel}">${contact.phone}</a>.`
    }
  })
}

function done(el, lead, { whatsapp } = {}) {
  store.set(SENT, '1')
  window.dataLayer?.push({ event: 'generate_lead', lead_source: lead.source, lead_need: lead.need || '' })
  const first = esc(lead.name.trim().split(/\s+/)[0])
  el.innerHTML = `
    <div class="lead__done" tabindex="-1">
      <p class="eyebrow"><span>Brief received</span></p>
      <h3>Thanks, ${first}.</h3>
      ${whatsapp
        ? `<p>WhatsApp has opened with your brief. Press send there and we'll pick it up. <a href="${whatsapp}" target="_blank" rel="noopener">Didn't open? Open WhatsApp</a></p>`
        : `<p>We'll come back with an idea, a plan and a budget. Need us sooner? Call <a href="tel:${contact.tel}">${contact.phone}</a>.</p>`}
    </div>`
  el.querySelector('.lead__done').focus()
}

export function initLeads({ lenis, beforeOpen = () => {} }) {
  document.querySelectorAll('[data-lead-mount]').forEach((el) => mount(el, el.dataset.leadMount))

  // ---------- popup
  const dialog = document.getElementById('quote')
  const popupForm = () => dialog.querySelector('form')
  function open(source) {
    beforeOpen()
    const f = popupForm()
    if (f) f.dataset.source = source
    dialog.showModal()
    lenis.stop()
    ;(dialog.querySelector('input[name="name"]') || dialog.querySelector('.lead__done'))?.focus()
  }
  dialog.addEventListener('close', () => lenis.start())
  dialog.querySelector('[data-quote-close]').addEventListener('click', () => dialog.close())
  // a click on the dimmed backdrop closes it
  dialog.addEventListener('click', (e) => {
    const r = dialog.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close()
  })
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lead]')
    if (!t) return
    e.preventDefault()
    open(t.dataset.lead)
  })

  // ---------- exit intent (desktop): once per visit, never after a brief is sent
  if (matchMedia('(pointer: fine)').matches) {
    const armedAt = performance.now() + 10000
    document.addEventListener('mouseout', (e) => {
      if (e.relatedTarget || e.clientY > 0 || performance.now() < armedAt) return
      if (store.get(EXIT) || store.get(SENT) || dialog.open) return
      if (!document.getElementById('lb').hidden || !document.getElementById('menu').hidden) return
      store.set(EXIT, '1')
      open('exit-intent')
    })
  }

  // ---------- phone bar: after the hero, hidden once the contact form is on screen
  const bar = document.querySelector('[data-mbar]')
  bar.querySelector('[data-mbar-wa]').href = waLink(`Hi PARALLEL, I'd like a quote for a project.`)
  bar.querySelector('[data-mbar-call]').href = `tel:${contact.tel}`
  const links = bar.querySelectorAll('a')
  const seen = new Map()
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => seen.set(e.target.id, e.isIntersecting))
    const on = !seen.get('hero') && !seen.get('contact')
    bar.classList.toggle('is-on', on)
    bar.setAttribute('aria-hidden', String(!on))
    links.forEach((a) => (a.tabIndex = on ? 0 : -1))
  })
  io.observe(document.getElementById('hero'))
  io.observe(document.getElementById('contact'))

  return { open }
}
