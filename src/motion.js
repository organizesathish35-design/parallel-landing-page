// One switch for all motion on the site, driven by the visitor's OS setting
// (prefers-reduced-motion). There is no on-page control.
const media = matchMedia('(prefers-reduced-motion: reduce)')
const listeners = new Set()

// an earlier version let visitors turn motion off on the page; drop that saved choice
try {
  localStorage.removeItem('parallel-motion')
} catch {}

let reduced = media.matches

function apply() {
  document.documentElement.classList.toggle('reduce-motion', reduced)
  listeners.forEach((fn) => fn(reduced))
}

export const motion = {
  get reduced() {
    return reduced
  },
  onChange(fn) {
    listeners.add(fn)
  },
}

media.addEventListener('change', (e) => {
  reduced = e.matches
  apply()
})
apply()
