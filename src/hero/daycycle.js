import { Color, Vector3, MathUtils } from 'three'

// Art-directed look keyed by sun elevation (degrees above the skyline).
// Colours are written as sRGB hex; THREE.Color stores them linear.
const KEYS = [
  { el: -14, zenith: 0x03050c, horizon: 0x0a0f22, glow: 0x0b0d1c, sun: 0xff5a2a, cloudLit: 0x1a2036, cloudShadow: 0x05070e, amb: [0.12, 0.14, 0.26], sat: 0.55, win: 1.08, haze: 0x0a0f22, hazeAmt: 0.55, mist: 0.0, stars: 1, cover: 0.46, bloom: 0.62 },
  { el: -6, zenith: 0x0a1233, horizon: 0x3b2c58, glow: 0x7b3e5c, sun: 0xff5a2a, cloudLit: 0x5e4068, cloudShadow: 0x151a34, amb: [0.3, 0.3, 0.46], sat: 0.7, win: 1.0, haze: 0x3a3052, hazeAmt: 0.5, mist: 0.25, stars: 0.55, cover: 0.5, bloom: 0.55 },
  { el: -1.5, zenith: 0x1f2b5e, horizon: 0xd2685a, glow: 0xff7a3c, sun: 0xff6a2a, cloudLit: 0xff8c5c, cloudShadow: 0x3b3558, amb: [0.62, 0.55, 0.62], sat: 0.85, win: 0.85, haze: 0x9a5f6c, hazeAmt: 0.45, mist: 0.45, stars: 0.05, cover: 0.52, bloom: 0.65 },
  { el: 4, zenith: 0x3e5692, horizon: 0xf59a64, glow: 0xffa860, sun: 0xffb070, cloudLit: 0xffb48c, cloudShadow: 0x5b5b82, amb: [0.98, 0.92, 0.9], sat: 1.0, win: 0.5, haze: 0xd9a28c, hazeAmt: 0.35, mist: 0.35, stars: 0, cover: 0.5, bloom: 0.42 },
  { el: 14, zenith: 0x3a6cc4, horizon: 0xe6d3bd, glow: 0xfff0d6, sun: 0xfff4e2, cloudLit: 0xfff6ee, cloudShadow: 0x8d96b3, amb: [1.04, 1.02, 1.04], sat: 0.95, win: 0.25, haze: 0xcbd1da, hazeAmt: 0.24, mist: 0.12, stars: 0, cover: 0.44, bloom: 0.2 },
  { el: 34, zenith: 0x1f58c4, horizon: 0xa2c6ee, glow: 0xffffff, sun: 0xffffff, cloudLit: 0xffffff, cloudShadow: 0xb9c3d8, amb: [1.02, 1.06, 1.16], sat: 0.86, win: 0.12, haze: 0xb9cde3, hazeAmt: 0.22, mist: 0.0, stars: 0, cover: 0.4, bloom: 0.14 },
  { el: 60, zenith: 0x1a50bb, horizon: 0x9ec2ea, glow: 0xffffff, sun: 0xffffff, cloudLit: 0xffffff, cloudShadow: 0xbcc6db, amb: [1.02, 1.07, 1.18], sat: 0.84, win: 0.1, haze: 0xb4cae4, hazeAmt: 0.22, mist: 0.0, stars: 0, cover: 0.38, bloom: 0.12 },
]

const COLOR_KEYS = ['zenith', 'horizon', 'glow', 'sun', 'cloudLit', 'cloudShadow', 'haze']
const NUM_KEYS = ['sat', 'win', 'hazeAmt', 'mist', 'stars', 'cover', 'bloom']
const cache = KEYS.map((k) => {
  const o = { ...k }
  for (const c of COLOR_KEYS) o[c] = new Color(k[c])
  o.amb = new Color(...k.amb)
  return o
})

export function lookAt(el) {
  const i = Math.max(0, cache.findIndex((k) => k.el > el) - 1)
  const a = cache[Math.min(i, cache.length - 1)]
  const b = cache[Math.min(i + 1, cache.length - 1)]
  const t = a === b ? 0 : MathUtils.smoothstep(el, a.el, b.el) * 0.6 + MathUtils.clamp((el - a.el) / (b.el - a.el), 0, 1) * 0.4
  const out = {}
  for (const c of [...COLOR_KEYS, 'amb']) out[c] = a[c].clone().lerp(b[c], t)
  for (const n of NUM_KEYS) out[n] = MathUtils.lerp(a[n], b[n], t)
  return out
}

// Catmull-Rom through (progress, value) keys.
function spline(keys, p) {
  p = MathUtils.clamp(p, keys[0][0], keys[keys.length - 1][0])
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)]
  const t = (p - k1[0]) / (k2[0] - k1[0])
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * k1[1] + (-k0[1] + k2[1]) * t + (2 * k0[1] - 5 * k1[1] + 4 * k2[1] - k3[1]) * t2 + (-k0[1] + 3 * k1[1] - 3 * k2[1] + k3[1]) * t3)
}

// Scroll progress -> sun elevation (deg). Blue hour -> sunrise -> noon -> sunset -> night.
const EL_KEYS = [[0, -7], [0.1, 0.5], [0.3, 30], [0.5, 56], [0.7, 30], [0.88, 0.5], [1, -13]]
// Scroll progress -> clock (hours)
const CLOCK_KEYS = [[0, 5.4], [0.1, 6.1], [0.5, 12.2], [0.88, 18.4], [1, 21.5]]

export const sunElevation = (p) => spline(EL_KEYS, p)
export const clockHours = (p) => spline(CLOCK_KEYS, p)

export function phaseLabel(el, p) {
  if (el < -4) return p < 0.5 ? 'Blue hour' : 'Night'
  if (el < 3) return p < 0.5 ? 'Sunrise' : 'Sunset'
  if (el < 18) return p < 0.5 ? 'Morning' : 'Golden hour'
  if (el < 45) return p < 0.5 ? 'Late morning' : 'Afternoon'
  return 'High noon'
}

export function formatClock(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function dirFromAngles(azRad, elRad, target = new Vector3()) {
  // az: 0 = straight ahead (-z), positive to the right
  return target.set(Math.sin(azRad) * Math.cos(elRad), Math.sin(elRad), -Math.cos(azRad) * Math.cos(elRad)).normalize()
}
