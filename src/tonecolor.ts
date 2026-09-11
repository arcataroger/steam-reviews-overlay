/**
 * The lever gradient, shared by the popup rails and the highlight outline.
 * Steam's three review colors sit at the centers of their bands and blend between them:
 *   negative solid up to 20%, mixed at 55% (center of Mixed 40-70), positive solid from 85%.
 */
export const STOPS: [number, string][] = [
  [0, '#a34c25'],
  [20, '#a34c25'],
  [55, '#b9a074'],
  [85, '#66c0f4'],
  [100, '#66c0f4'],
]

export const GRADIENT_CSS = `linear-gradient(to top, ${STOPS.map(([p, c]) => `${c} ${p}%`).join(', ')})`

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
}

/** Color at a position on the gradient, as #rrggbb. */
export function toneColorAt(pct: number): string {
  const p = Math.min(100, Math.max(0, pct))
  for (let i = 1; i < STOPS.length; i++) {
    const [p0, c0] = STOPS[i - 1]
    const [p1, c1] = STOPS[i]
    if (p <= p1) {
      const t = p1 === p0 ? 0 : (p - p0) / (p1 - p0)
      const a = hex(c0)
      const b = hex(c1)
      const mix = a.map((x, k) => Math.round(x + (b[k] - x) * t))
      return '#' + mix.map((x) => x.toString(16).padStart(2, '0')).join('')
    }
  }
  return STOPS[STOPS.length - 1][1]
}
