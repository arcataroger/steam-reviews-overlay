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

/** A vivid color at a hue (0..359), as #rrggbb: light enough to read on Steam's dark pages. */
export function hueToHex(hue: number): string {
  const s = 0.9
  const l = 0.65
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** The hue (0..359) of a #rrggbb color; 0 for greys, which have none. */
export function hexToHue(color: string): number {
  const [r, g, b] = hex(color)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (!d) return 0
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(h * 60) % 360
}

/**
 * The frame swatches: red, orange, yellow, green, blue, indigo, violet and pink, at the slider's
 * own lightness. Blue is Steam's positive blue, which every default frame wears.
 * Each swatch is a notch on the hue slider: the slider spaces them evenly, red at one end and pink
 * at the other, and stretches the hues between.
 */
export const FRAME_NOTCHES: { name: string; hue: number; color: string }[] = [
  { name: 'red', hue: 0 },
  { name: 'orange', hue: 24 },
  { name: 'yellow', hue: 52 },
  { name: 'green', hue: 125 },
  { name: 'blue', hue: 202 },
  { name: 'indigo', hue: 240 },
  { name: 'violet', hue: 280 },
  { name: 'pink', hue: 330 },
].map((n) => ({ ...n, color: n.name === 'blue' ? POSITIVE : hueToHex(n.hue) }))

/** Slider units between two notches. The slider runs 0..SLIDER_MAX, red to pink. */
export const NOTCH_SPAN = 100
export const SLIDER_MAX = NOTCH_SPAN * (FRAME_NOTCHES.length - 1)
/** A drag that ends this close to a notch lands on it. */
const SNAP = 5
const LAST = FRAME_NOTCHES.length - 1

/** The hue at a slider value. */
export function sliderToHue(v: number): number {
  const x = Math.min(SLIDER_MAX, Math.max(0, v)) / NOTCH_SPAN
  const i = Math.min(LAST - 1, Math.floor(x))
  const h0 = FRAME_NOTCHES[i].hue
  return h0 + (FRAME_NOTCHES[i + 1].hue - h0) * (x - i)
}

/** The slider value nearest a hue. Hues past pink sit at the pink end. */
export function hueToSlider(hue: number): number {
  const h = ((hue % 360) + 360) % 360
  if (h >= FRAME_NOTCHES[LAST].hue) return SLIDER_MAX
  let i = LAST - 1
  while (i > 0 && h < FRAME_NOTCHES[i].hue) i--
  const h0 = FRAME_NOTCHES[i].hue
  return Math.round(NOTCH_SPAN * (i + (h - h0) / (FRAME_NOTCHES[i + 1].hue - h0)))
}

/** The notch a slider value rests on (within SNAP), or undefined between notches. */
export function notchAt(v: number): number | undefined {
  const i = Math.round(v / NOTCH_SPAN)
  return i >= 0 && i <= LAST && Math.abs(v - i * NOTCH_SPAN) <= SNAP ? i : undefined
}

/** The frame color at a slider value: a notch's exact color when it rests on one. */
export function sliderToColor(v: number): string {
  const n = notchAt(v)
  return n === undefined ? hueToHex(sliderToHue(v)) : FRAME_NOTCHES[n].color
}

/** The slider value that shows a color: its notch when it is a swatch, else its nearest hue. */
export function colorToSlider(color: string): number {
  const n = FRAME_NOTCHES.findIndex((s) => s.color === color)
  if (n >= 0) return n * NOTCH_SPAN
  // The slider's own colors go back to the step that made them; hue rounding can miss it by a few
  const v = hueToSlider(hexToHue(color))
  for (let d = 0; d <= 6; d++) for (const w of [v - d, v + d]) if (sliderToColor(w) === color) return w
  return v
}

/** Whether the slider or a swatch can make this color. Anything else is the user's own pick. */
export function onSlider(color: string): boolean {
  return sliderColors().has(color)
}
let sliderSet: Set<string> | undefined
const sliderColors = () => (sliderSet ??= new Set(Array.from({ length: SLIDER_MAX + 1 }, (_, v) => sliderToColor(v))))

/** The slider's track, drawn through the same stretched hues the slider picks. */
export function sliderGradientCss(): string {
  const stops: string[] = []
  for (let v = 0; v <= SLIDER_MAX; v += NOTCH_SPAN / 4) stops.push(`${sliderToColor(v)} ${((v / SLIDER_MAX) * 100).toFixed(2)}%`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}
