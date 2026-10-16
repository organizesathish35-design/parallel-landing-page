// Focus mode: the white rooms go dark like a cinema so the film on screen is
// the only bright thing. Every "Focus mode" switch on the page shares one state.
const KEY = 'parallel-focus'
const switches = [...document.querySelectorAll('[data-focus-toggle]')]

function read() {
  try {
    return sessionStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

function apply(on) {
  document.documentElement.classList.toggle('focus-mode', on)
  switches.forEach((b) => b.setAttribute('aria-checked', String(on)))
}

let on = read()
apply(on)
switches.forEach((b) =>
  b.addEventListener('click', () => {
    on = !on
    try {
      sessionStorage.setItem(KEY, on ? 'on' : 'off')
    } catch {}
    apply(on)
  }),
)
