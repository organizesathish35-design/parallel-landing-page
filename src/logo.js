// PARALLEL wordmark, traced from the brand artwork as geometric paths (cap height = 100 units).
// The LL pair is two slanted bars that rise above and drop below the caps - the second carries the lime signal.
// P / R: stem plus a bowl (width w, height h, top/bottom corner radii) and a counter with a round right end
const BOWL = (w, h, top, bot, cTop, cBot, cRight) => {
  const r = (cBot - cTop) / 2
  return `M0 0H${w - top}A${top} ${top} 0 0 1 ${w} ${top}A${bot} ${bot} 0 0 1 ${w - bot} ${h}H22V100H0Z ` +
    `M22 ${cTop}H${cRight - r}A${r} ${r} 0 0 1 ${cRight - r} ${cBot}H22Z`
}
const LAMBDA = 'M0 100L74 0L149 100H124.5L74 33L24.5 100Z'
const BAR = 'M62 -31.5H92L30 130.5H0Z'

const GLYPHS = [
  { x: 0, d: [BOWL(111, 71, 38, 33, 19.5, 52.5, 88.5)] },                          // P
  { x: 138, d: [LAMBDA] },                                                          // A (Λ)
  { x: 326, d: [BOWL(107, 67, 36, 31, 18.5, 48.5, 86), 'M50 60H76L114.5 100H89Z'] }, // R
  { x: 470, d: [LAMBDA] },                                                          // A (Λ)
  { x: 648, d: [BAR], bar: 'a' },                                                   // /
  { x: 706, d: [BAR], bar: 'b' },                                                   // /
  { x: 836, d: ['M0 0H107V19.5H22.5V39.5H103.5V58H22.5V80H107V100H0Z'] },           // E
  { x: 1005, d: ['M0 0H22V80H110V100H0Z'] },                                        // L
]

export function wordmark({ className = '', title = 'Parallel' } = {}) {
  const g = GLYPHS.map(({ x, d, bar }) => {
    const cls = bar ? `glyph glyph--bar glyph--${bar}` : 'glyph'
    const paths = d.map((p) => `<path d="${p}" fill-rule="evenodd"/>`).join('')
    return `<g class="${cls}" transform="translate(${x} 0)"><g class="glyph__inner">${paths}</g></g>`
  }).join('')
  return `<svg class="wordmark ${className}" viewBox="0 -32 1115 163" role="img" aria-label="${title}"><title>${title}</title>${g}</svg>`
}
