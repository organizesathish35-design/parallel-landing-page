// PARALLEL wordmark, rebuilt as geometric paths (cap height = 100 units).
// The LL pair becomes two slanted bars - the second one carries the lime signal.
const GLYPHS = [
  { x: 0, d: ['M0 0H44A31 31 0 0 1 44 62H15V100H0Z M15 15H44A16 16 0 0 1 44 47H15Z'] },            // P
  { x: 99, d: ['M0 100L37 0H53L90 100H73L45 22L17 100Z'] },                                            // A (Λ)
  { x: 213, d: ['M0 0H44A31 31 0 0 1 44 62H15V100H0Z M15 15H44A16 16 0 0 1 44 47H15Z', 'M38 56H56L78 100H60Z'] }, // R
  { x: 316, d: ['M0 100L37 0H53L90 100H73L45 22L17 100Z'] },                                           // A (Λ)
  { x: 424, d: ['M31 0H53L22 100H0Z'], bar: 'a' },                                                     // /
  { x: 458, d: ['M31 0H53L22 100H0Z'], bar: 'b' },                                                     // /
  { x: 545, d: ['M0 0H64V15H15V42.5H58V57.5H15V85H64V100H0Z'] },                                       // E
  { x: 632, d: ['M0 0H15V85H60V100H0Z'] },                                                             // L
]

export function wordmark({ className = '', title = 'Parallel' } = {}) {
  const g = GLYPHS.map(({ x, d, bar }) => {
    const cls = bar ? `glyph glyph--bar glyph--${bar}` : 'glyph'
    const paths = d.map((p) => `<path d="${p}" fill-rule="evenodd"/>`).join('')
    return `<g class="${cls}" transform="translate(${x} 0)"><g class="glyph__inner">${paths}</g></g>`
  }).join('')
  return `<svg class="wordmark ${className}" viewBox="0 0 692 100" role="img" aria-label="${title}"><title>${title}</title>${g}</svg>`
}
