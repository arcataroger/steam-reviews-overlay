// Pure, file-free border verification: given a decoded RGBA crop of one game card and the
// manifest record that says what SHOULD be drawn on it, decide from pixels alone whether the
// highlight ring/wings/glow are where content.css puts them. No DOM, no CSS, no file I/O here —
// see scripts/check-borders.mjs for the CLI that feeds this from real PNGs.
//
// Geometry cheat sheet (see src/content.css):
//   row   — `box-shadow: inset 0 0 0 2px var(--sro-hl)` on a ::before with inset:0. A crisp 2px
//           ring flush with the card's own edge, entirely INSIDE the box.
//   panel — 5px solid wing fading out to 26px, on two opposite edges only, inset 6px from the
//           OTHER two edges so neighbouring panels' wings never join into one bar. Also inside
//           the box, flush with its edge.
//   card  — `box-shadow: 0 0 0 2px ..., 0 0 4px 2px ...` (no `inset`): a 2px ring plus a soft
//           ~4px blurred glow, both drawn OUTSIDE the box, hugging its edge from without.
//
// A crop has `pad` px of surrounding page on every side, so the card's own box is exactly at
// (pad, pad) sized (width - 2*pad) x (height - 2*pad).

/**
 * Parse a `#rrggbb` / `rrggbb` / `#rgb` / `rgb` string into 0-255 channel values.
 * @param {string} hex
 * @returns {{r:number, g:number, b:number}}
 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError(`hexToRgb: expected a string, got ${typeof hex}`)
  }
  const cleaned = hex.trim().replace(/^#/, '')
  let full
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    full = cleaned.split('').map((c) => c + c).join('')
  } else if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    full = cleaned
  } else {
    throw new RangeError(`hexToRgb: not a valid hex colour: ${JSON.stringify(hex)}`)
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/**
 * Max absolute per-channel difference between two {r,g,b} colours. Deliberately not Euclidean:
 * a single blown channel (e.g. anti-aliasing shifting only blue) should count as "different"
 * even if the other two channels match exactly.
 * @param {{r:number,g:number,b:number}} a
 * @param {{r:number,g:number,b:number}} b
 * @returns {number}
 */
export function colourDistance(a, b) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
}

/**
 * Per-treatment sampling geometry, keyed by the manifest's `shape` field. Each entry says, for
 * every edge, how far from the card's own box edge the sampling band starts (`offset`, positive
 * = inward into the card, negative = outward into the surrounding pad) and how thick the band is
 * (`band`). `corner` (shared default) is how many px to skip at each end of the band, along the
 * edge, to dodge rounded corners and (for panels) the 6px wing inset.
 *
 * - row / panel: the highlight is flush with the box edge and entirely inside it, so sample
 *   straight inward from offset 0.
 * - card: the ring + glow are entirely OUTSIDE the box (a non-inset box-shadow), so the band is
 *   pulled back to straddle the edge — a few px outside meet a few px inside — per the contract's
 *   instruction to straddle rather than sample strictly inward.
 * @type {Record<string, {offset:number, band:number, corner:number}>}
 */
export const TREATMENT_GEOMETRY = {
  row: { offset: 0, band: 4, corner: 10 },
  panel: { offset: 0, band: 4, corner: 10 },
  card: { offset: -3, band: 6, corner: 10 },
}

const DEFAULT_GEOMETRY = { offset: 0, band: 4, corner: 10 }

/**
 * Every colour the overlay can draw a highlight in (src/content.css): positive, mixed, negative.
 * Used to police edges that should carry NO highlight — a ring in any of these fails them.
 */
export const TONE_PALETTE = [
  { r: 0x66, g: 0xc0, b: 0xf4 },
  { r: 0xb9, g: 0xa0, b: 0x74 },
  { r: 0xc8, g: 0x5e, b: 0x2d },
]

export const DEFAULT_OPTIONS = {
  pad: 12,
  band: 4,
  corner: 10,
  offset: 0,
  tolerance: 40,
  // An 85%-alpha ring over an unknown backdrop keeps its chromaticity but loses brightness; these
  // two let such a pixel still count. See pixelMatches().
  chroma: 0.02,
  minBrightness: 0.45,
  minHit: 0.6,
  maxStray: 0.5,
  opMinHit: 0.35,
  // How much of an edge must be colour that the un-highlighted capture does NOT have, before we
  // believe the overlay drew it (rather than Steam's own blue UI happening to sit there).
  minGain: 0.25,
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/**
 * Build the four sampling bands for a crop of `width` x `height` with `pad` px of page around a
 * card box of (width - 2*pad) x (height - 2*pad). Each returned band is an array of "lines" (one
 * per px of `opts.band` thickness), each line an array of `{x,y}` points running along that edge,
 * inset by `opts.corner` px at each end. Line 0 is nearest `opts.offset` from the box edge; later
 * lines move further inward.
 * @param {number} width
 * @param {number} height
 * @param {number} pad
 * @param {{band?:number, corner?:number, offset?:number}} [opts]
 * @returns {{top:Array<Array<{x:number,y:number}>>, right:Array<Array<{x:number,y:number}>>, bottom:Array<Array<{x:number,y:number}>>, left:Array<Array<{x:number,y:number}>>}}
 */
export function edgeBands(width, height, pad, opts = {}) {
  const band = opts.band ?? DEFAULT_OPTIONS.band
  const corner = opts.corner ?? DEFAULT_OPTIONS.corner
  const offset = opts.offset ?? DEFAULT_OPTIONS.offset

  // First/last pixel INSIDE the card box on each side.
  const boxTop = pad
  const boxLeft = pad
  const boxBottom = height - pad - 1
  const boxRight = width - pad - 1

  const xStart = clamp(pad + corner, 0, width)
  const xEnd = clamp(width - pad - corner, 0, width) // exclusive
  const yStart = clamp(pad + corner, 0, height)
  const yEnd = clamp(height - pad - corner, 0, height) // exclusive

  // `inwardSign` is +1 when moving inward increases the depth coordinate (top/left), -1 when it
  // decreases it (bottom/right) — this lets one formula serve every edge symmetrically.
  const horizontal = (edgeAt, inwardSign) => {
    const lines = []
    for (let i = 0; i < band; i++) {
      const y = edgeAt + inwardSign * (offset + i)
      const line = []
      if (y >= 0 && y < height) {
        for (let x = xStart; x < xEnd; x++) line.push({ x, y })
      }
      lines.push(line)
    }
    return lines
  }
  const vertical = (edgeAt, inwardSign) => {
    const lines = []
    for (let i = 0; i < band; i++) {
      const x = edgeAt + inwardSign * (offset + i)
      const line = []
      if (x >= 0 && x < width) {
        for (let y = yStart; y < yEnd; y++) line.push({ x, y })
      }
      lines.push(line)
    }
    return lines
  }

  return {
    top: horizontal(boxTop, +1),
    right: vertical(boxRight, -1),
    bottom: horizontal(boxBottom, -1),
    left: vertical(boxLeft, +1),
  }
}

/**
 * Score one edge's band against a target colour. For every line in the band (each `opts.band`
 * px thick line running along the edge), compute matched/total; report the BEST line's fraction,
 * so a ring thinner than the sampled band (e.g. a 2px ring inside a 4px band) still scores ~1
 * instead of being diluted by the unlit rest of the band.
 * @param {{width:number, height:number, data: {[i:number]: number, length:number}}} image RGBA, 4 bytes/px
 * @param {Array<Array<{x:number,y:number}>>} band one edge's lines, from edgeBands()
 * @param {{r:number,g:number,b:number}} colour
 * @param {{tolerance?:number}} [opts]
 * @returns {{fraction:number, matched:number, total:number}}
 */
/**
 * Chromaticity of a colour: each channel over the sum. Scaling every channel by the same factor
 * (which is what compositing a translucent colour over a darker backdrop does, to a good
 * approximation) leaves this almost unchanged, so it identifies "this is our blue, dimmed" where a
 * plain RGB distance would not.
 * @param {{r:number,g:number,b:number}} c
 * @returns {{r:number,g:number,b:number}|null} null for pure black, which has no chromaticity
 */
export function chromaticity(c) {
  const sum = c.r + c.g + c.b
  if (sum <= 0) return null
  return { r: c.r / sum, g: c.g / sum, b: c.b / sum }
}

/**
 * Does this pixel show the highlight colour?
 *
 * The ring is drawn at 85% alpha (`color-mix(... 85%, transparent)`), so what lands in the
 * screenshot is our colour composited over whatever the page put behind it: the same ring measures
 * (93,176,224) over the page background and (82,153,195) where it crosses darker artwork, 20 and 55
 * away from the pure colour respectively. A single absolute tolerance therefore either misses real
 * rings or admits noise, so a pixel counts when EITHER
 *   - it is within `tolerance` of the pure colour outright, or
 *   - it has the same chromaticity (within `chroma`) AND is bright enough to be a ring rather than
 *     the dark page behind it (`minBrightness` of the colour's own brightest channel).
 * The brightness floor is what keeps Steam's dark blue-grey background (max channel 36 against the
 * colour's 244) from matching on chromaticity alone.
 * @param {{r:number,g:number,b:number}} pixel
 * @param {{r:number,g:number,b:number}} colour
 * @param {{tolerance?:number, chroma?:number, minBrightness?:number}} [opts]
 * @returns {boolean}
 */
export function pixelMatches(pixel, colour, opts = {}) {
  const tolerance = opts.tolerance ?? DEFAULT_OPTIONS.tolerance
  if (colourDistance(pixel, colour) <= tolerance) return true
  const chromaTol = opts.chroma ?? DEFAULT_OPTIONS.chroma
  const minBrightness = opts.minBrightness ?? DEFAULT_OPTIONS.minBrightness
  const a = chromaticity(pixel)
  const b = chromaticity(colour)
  if (!a || !b) return false
  if (Math.abs(a.r - b.r) > chromaTol || Math.abs(a.g - b.g) > chromaTol || Math.abs(a.b - b.b) > chromaTol) return false
  const peak = Math.max(colour.r, colour.g, colour.b)
  const lit = Math.max(pixel.r, pixel.g, pixel.b)
  return peak > 0 && lit / peak >= minBrightness
}

export function edgeHit(image, band, colour, opts = {}) {
  const tolerance = opts.tolerance ?? DEFAULT_OPTIONS.tolerance
  let bestFraction = 0
  let bestMatched = 0
  // `total` reports how many pixels were actually sampled, independent of whether any line
  // "won" — every non-empty line in a band shares the same length, so any of them will do. Do
  // not derive this from the winning line alone: when nothing matches anywhere, every line ties
  // the initial (0/0) best and none would ever update a `bestTotal`, wrongly reporting 0 samples
  // for a band that in fact had plenty (a real bug caught by the check-borders.mjs CLI smoke test).
  let sampledTotal = 0
  for (const line of band) {
    const total = line.length
    if (total === 0) continue
    sampledTotal = total
    let matched = 0
    for (const { x, y } of line) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue
      const idx = (y * image.width + x) * 4
      const pixel = { r: image.data[idx], g: image.data[idx + 1], b: image.data[idx + 2] }
      if (pixelMatches(pixel, colour, { ...opts, tolerance })) matched++
    }
    const fraction = matched / total
    if (fraction > bestFraction || (fraction === bestFraction && matched > bestMatched)) {
      bestFraction = fraction
      bestMatched = matched
    }
  }
  return { fraction: bestFraction, matched: bestMatched, total: sampledTotal }
}

/**
 * Which of the four edges SHOULD carry the highlight colour, from the manifest's `shape`/`axis`
 * alone (mirrors the selectors in src/content.css).
 * @param {{shape?: 'row'|'panel'|'card'|null, axis?: 'x'|'y'|null}} card
 * @returns {{top:boolean, right:boolean, bottom:boolean, left:boolean}}
 */
export function expectedEdges(card = {}) {
  const none = { top: false, right: false, bottom: false, left: false }
  const shape = card.shape || null
  if (!shape || shape === 'none') return none
  if (shape === 'row' || shape === 'card') {
    return { top: true, right: true, bottom: true, left: true }
  }
  if (shape === 'panel') {
    const axis = card.axis || 'y' // panel with no axis behaves like axis:y (left/right wings)
    return axis === 'x'
      ? { top: true, right: false, bottom: true, left: false }
      : { top: false, right: true, bottom: false, left: true }
  }
  return none // unrecognised shape: nothing to expect, checkCard will just see it fail silently
}

const luminance = ({ r, g, b }) => 0.299 * r + 0.587 * g + 0.114 * b

/** Mean luminance of the whole crop (used only to annotate dimmed/filtered cards). */
function meanLuminance(image) {
  const { width, height, data } = image
  const n = width * height
  if (n === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    sum += luminance({ r: data[o], g: data[o + 1], b: data[o + 2] })
  }
  return sum / n
}

/**
 * Full pixel verdict for one card crop.
 * @param {{width:number, height:number, data: {[i:number]: number, length:number}}} image
 * @param {{shape?:string|null, axis?:string|null, color?:string|null, op?:boolean, filtered?:string|null}} card
 * @param {{pad?:number, band?:number, corner?:number, offset?:number, tolerance?:number, minHit?:number, maxStray?:number, opMinHit?:number}} [opts]
 * @returns {{ok:boolean, edges: Record<'top'|'right'|'bottom'|'left', {expected:boolean, fraction:number, matched:number, pass:boolean}>, notes:string[]}}
 */
export function checkCard(image, card = {}, opts = {}) {
  const pad = opts.pad ?? DEFAULT_OPTIONS.pad
  const tolerance = opts.tolerance ?? DEFAULT_OPTIONS.tolerance
  const maxStray = opts.maxStray ?? DEFAULT_OPTIONS.maxStray
  const notes = []

  const minHit = opts.minHit ?? (card.op ? DEFAULT_OPTIONS.opMinHit : DEFAULT_OPTIONS.minHit)
  const minGain = opts.minGain ?? DEFAULT_OPTIONS.minGain
  const chroma = opts.chroma ?? DEFAULT_OPTIONS.chroma
  const minBrightness = opts.minBrightness ?? DEFAULT_OPTIONS.minBrightness
  /** Same crop from the labels-state capture, where no highlight is drawn. Optional. */
  const baseline = opts.baseline ?? null
  /** Real captures set this: an edge that should have no highlight is only judged against a twin. */
  const negativeNeedsBaseline = opts.negativeNeedsBaseline ?? false
  if (card.op) {
    notes.push(`op card: using minHit ${minHit} (orbiting ring is dim on part of its sweep at any instant)`)
  }

  const expected = expectedEdges(card)
  const shape = card.shape || null
  const geometry = TREATMENT_GEOMETRY[shape] || DEFAULT_GEOMETRY
  const bandOpts = {
    band: opts.band ?? geometry.band,
    corner: opts.corner ?? geometry.corner,
    offset: opts.offset ?? geometry.offset,
  }
  const bands = edgeBands(image.width, image.height, pad, bandOpts)

  let colour = null
  if (card.color) {
    try {
      colour = hexToRgb(card.color)
    } catch (err) {
      notes.push(`invalid colour ${JSON.stringify(card.color)}: ${err.message}`)
    }
  } else if (shape) {
    notes.push('highlight shape present but no colour recorded to verify against')
  }

  const edges = {}
  let ok = true
  for (const name of ['top', 'right', 'bottom', 'left']) {
    const isExpected = expected[name]
    // An edge that should carry the highlight is measured against its own colour. An edge that
    // should carry none is measured against every tone we could ever draw, because "this card must
    // stay untouched" (Mostly Positive sits between the levers) is only a real check if a ring in
    // ANY of our colours makes it fail — with no expected colour there would be nothing to look for.
    let hit = { fraction: 0, matched: 0, total: 0 }
    let base = { fraction: 0, matched: 0, total: 0 }
    // An expected edge is checked against the colour this card should be drawn in; an edge that
    // should carry NOTHING is checked against every tone we can draw, or a wrong-toned ring there
    // (a panel's unexpected edges are the only place this can happen) would slip through.
    const probeColours = isExpected ? (colour ? [colour] : TONE_PALETTE) : TONE_PALETTE
    for (const tone of probeColours) {
      const probe = edgeHit(image, bands[name], tone, { tolerance, chroma, minBrightness })
      if (probe.fraction <= hit.fraction) continue
      hit = probe
      // The same edge in the labels state, where the overlay draws no highlight at all. Steam's own
      // accent blue is the very colour we highlight in, so only the DIFFERENCE between the two
      // states is ours; without a baseline the "no highlight here" case cannot be judged at all.
      base = baseline ? edgeHit(baseline, bands[name], tone, { tolerance, chroma, minBrightness }) : base
    }
    const gained = baseline ? Math.max(0, hit.fraction - base.fraction) : null
    // The page can paint over an edge (Steam's sticky category bar, a hover panel). The capture
    // records that per edge; those pixels are not ours to judge, so the edge is skipped.
    const covered = !!(card.occluded && card.occluded[name])
    let pass
    let unverified = false
    if (covered) {
      pass = true
      notes.push(`edge ${name}: occluded by the page, not judged`)
    } else if (card.neighbourHighlight && card.neighbourHighlight[name]) {
      // A highlighted card is butted against this edge. Its ring lands in our band, and it is absent
      // from the un-highlighted twin too, so the difference is not ours either. That cuts both ways:
      // it could mask this card's MISSING ring just as easily as it could fake a stray one. Neither
      // direction is knowable here, so the edge is not judged.
      pass = true
      unverified = true
      notes.push(`edge ${name}: a highlighted neighbour touches this edge, not judged`)
    } else if (isExpected) {
      // Present outright, and (when we can tell) actually gained versus the un-highlighted state.
      pass = hit.fraction >= minHit && (gained === null || gained >= minGain)
    } else if (gained !== null) {
      pass = gained < maxStray
    } else if (negativeNeedsBaseline) {
      // Real captures only: Steam's own accent blue IS our positive colour, so without the twin
      // un-highlighted capture this edge cannot be judged. Say so rather than cry wolf.
      pass = true
      unverified = true
      if (hit.fraction >= maxStray) notes.push(`edge ${name}: ${(hit.fraction * 100).toFixed(0)}% palette colour, but no baseline to tell it from Steam's own`)
    } else {
      pass = hit.fraction < maxStray
    }
    if (!pass) ok = false
    if (!covered && isExpected && hit.total === 0) {
      notes.push(`edge ${name}: no pixels sampled (card too small for corner=${bandOpts.corner}/band=${bandOpts.band})`)
    }
    edges[name] = {
      expected: isExpected,
      fraction: hit.fraction,
      matched: hit.matched,
      pass,
      occluded: covered,
      baseline: baseline ? base.fraction : null,
      gained,
      unverified,
    }
  }

  if (card.filtered === 'dim') {
    notes.push(`mean luminance ${meanLuminance(image).toFixed(1)} (card sits under the dim overlay)`)
  }

  return { ok, edges, notes }
}
