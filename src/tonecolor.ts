/**
 * The lever gradient, shared by the popup rails and the highlight outline, on the tier ladder
 * (position 1..9 mapped to 0..100% of track). Steam's three review colors sit on their tiers:
 * negative solid through Mostly Negative (4), mixed at Mixed (5), positive solid from Mostly
 * Positive (6), blended between.
 */
export const NEGATIVE = '#c85e2d'
export const MIXED = '#b9a074'
export const POSITIVE = '#66c0f4'

const p = (pos: number) => ((pos - 1) / 8) * 100

export const STOPS: [number, string][] = [
  [0, NEGATIVE],
  [p(4), NEGATIVE],
  [p(5), MIXED],
  [p(6), POSITIVE],
  [100, POSITIVE],
]

export const GRADIENT_CSS = `linear-gradient(to top, ${STOPS.map(([pc, c]) => `${c} ${pc}%`).join(', ')})`

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
}

/** Color at a ladder position (1..9), as #rrggbb. */
export function toneColorAt(pos: number): string {
  const pc = Math.min(100, Math.max(0, p(pos)))
  for (let i = 1; i < STOPS.length; i++) {
    const [p0, c0] = STOPS[i - 1]
    const [p1, c1] = STOPS[i]
    if (pc <= p1) {
      const t = p1 === p0 ? 0 : (pc - p0) / (p1 - p0)
      const a = hex(c0)
      const b = hex(c1)
      const mix = a.map((x, k) => Math.round(x + (b[k] - x) * t))
      return '#' + mix.map((x) => x.toString(16).padStart(2, '0')).join('')
    }
  }
  return POSITIVE
}
