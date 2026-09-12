// @vitest-environment node
// Pure pixel-geometry tests for scripts/lib/border-check.mjs. Every image here is synthesized in
// memory (no PNG files, no pngjs) — pngjs only matters to the CLI (scripts/check-borders.mjs).
import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  colourDistance,
  edgeBands,
  edgeHit,
  expectedEdges,
  checkCard,
  type RgbaImage,
  type EdgeName,
  type Point,
  pixelMatches,
} from '../../scripts/lib/border-check.mjs'

const POSITIVE = '#66c0f4'
const MIXED = '#b9a074'
const NEGATIVE = '#c85e2d'

// A generous default crop: 200x140 with the contract's default 12px pad, so the card box itself
// is 176x116 — plenty of room for every treatment's band + corner skip.
const W = 200
const H = 140
const PAD = 12

function makeImage(width: number, height: number, bg: [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    data[o] = bg[0]
    data[o + 1] = bg[1]
    data[o + 2] = bg[2]
    data[o + 3] = 255
  }
  return { width, height, data }
}

function paintRect(image: RgbaImage, x0: number, y0: number, x1: number, y1: number, colour: [number, number, number]) {
  const xLo = Math.max(0, x0)
  const xHi = Math.min(image.width, x1)
  const yLo = Math.max(0, y0)
  const yHi = Math.min(image.height, y1)
  for (let y = yLo; y < yHi; y++) {
    for (let x = xLo; x < xHi; x++) {
      const o = (y * image.width + x) * 4
      image.data[o] = colour[0]
      image.data[o + 1] = colour[1]
      image.data[o + 2] = colour[2]
      image.data[o + 3] = 255
    }
  }
}

/** Paint a ring/wing flush with the box edge (offset 0), `thickness` px deep, on the given edges. */
function paintInwardRing(
  image: RgbaImage,
  pad: number,
  thickness: number,
  colour: [number, number, number],
  edges: EdgeName[] = ['top', 'right', 'bottom', 'left'],
) {
  const { width, height } = image
  if (edges.includes('top')) paintRect(image, pad, pad, width - pad, pad + thickness, colour)
  if (edges.includes('bottom')) paintRect(image, pad, height - pad - thickness, width - pad, height - pad, colour)
  if (edges.includes('left')) paintRect(image, pad, pad, pad + thickness, height - pad, colour)
  if (edges.includes('right')) paintRect(image, width - pad - thickness, pad, width - pad, height - pad, colour)
}

/** Paint colour only in the 8px zone nearest each of the 4 box corners — inside the default 10px
 * corner skip on every edge, so none of it should ever land in a sampled band. */
function paintCornersOnly(image: RgbaImage, pad: number, thickness: number, colour: [number, number, number]) {
  const { width: w, height: h } = image
  const size = 8
  paintRect(image, pad, pad, pad + size, pad + thickness, colour) // top, left end
  paintRect(image, w - pad - size, pad, w - pad, pad + thickness, colour) // top, right end
  paintRect(image, pad, h - pad - thickness, pad + size, h - pad, colour) // bottom, left end
  paintRect(image, w - pad - size, h - pad - thickness, w - pad, h - pad, colour) // bottom, right end
  paintRect(image, pad, pad, pad + thickness, pad + size, colour) // left, top end
  paintRect(image, pad, h - pad - size, pad + thickness, h - pad, colour) // left, bottom end
  paintRect(image, w - pad - thickness, pad, w - pad, pad + size, colour) // right, top end
  paintRect(image, w - pad - thickness, h - pad - size, w - pad, h - pad, colour) // right, bottom end
}

/** Paint only the first `coverage` fraction of one exact sampled line (from edgeBands) — used to
 * hit precise fraction values for threshold-boundary tests. */
function paintAlongLine(image: RgbaImage, line: Point[], coverage: number, colour: [number, number, number]) {
  const n = Math.round(line.length * coverage)
  for (let i = 0; i < n; i++) {
    const { x, y } = line[i]
    const o = (y * image.width + x) * 4
    image.data[o] = colour[0]
    image.data[o + 1] = colour[1]
    image.data[o + 2] = colour[2]
    image.data[o + 3] = 255
  }
}

const gray: [number, number, number] = [40, 40, 40]

describe('hexToRgb', () => {
  it('parses 6-digit hex with a leading #', () => {
    expect(hexToRgb('#66c0f4')).toEqual({ r: 102, g: 192, b: 244 })
  })
  it('parses 6-digit hex without a leading #', () => {
    expect(hexToRgb('66c0f4')).toEqual({ r: 102, g: 192, b: 244 })
  })
  it('expands 3-digit shorthand', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })
  it('throws on an invalid colour', () => {
    expect(() => hexToRgb('not-a-colour')).toThrow()
  })
})

describe('colourDistance', () => {
  it('is zero for identical colours', () => {
    expect(colourDistance({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0)
  })
  it('is the MAX channel difference, not the sum or Euclidean distance', () => {
    expect(colourDistance({ r: 0, g: 0, b: 0 }, { r: 10, g: 5, b: 255 })).toBe(255)
  })
})

describe('expectedEdges', () => {
  it('no shape -> all false', () => {
    expect(expectedEdges({ shape: null })).toEqual({ top: false, right: false, bottom: false, left: false })
  })
  it('shape "none" -> all false', () => {
    expect(expectedEdges({ shape: 'none' })).toEqual({ top: false, right: false, bottom: false, left: false })
  })
  it('row -> all true', () => {
    expect(expectedEdges({ shape: 'row' })).toEqual({ top: true, right: true, bottom: true, left: true })
  })
  it('card -> all true', () => {
    expect(expectedEdges({ shape: 'card' })).toEqual({ top: true, right: true, bottom: true, left: true })
  })
  it('panel + axis:y -> left/right true, top/bottom false', () => {
    expect(expectedEdges({ shape: 'panel', axis: 'y' })).toEqual({ top: false, right: true, bottom: false, left: true })
  })
  it('panel + axis:x -> top/bottom true, left/right false', () => {
    expect(expectedEdges({ shape: 'panel', axis: 'x' })).toEqual({ top: true, right: false, bottom: true, left: false })
  })
  it('panel with no axis behaves like axis:y', () => {
    expect(expectedEdges({ shape: 'panel' })).toEqual(expectedEdges({ shape: 'panel', axis: 'y' }))
  })
})

describe('edgeBands geometry', () => {
  it('returns `band` lines per edge, skipping `corner` px at each end', () => {
    const bands = edgeBands(W, H, PAD, { band: 4, corner: 10, offset: 0 })
    expect(bands.top).toHaveLength(4)
    expect(bands.right).toHaveLength(4)
    expect(bands.bottom).toHaveLength(4)
    expect(bands.left).toHaveLength(4)
    // top band's lines run along x, starting after the corner skip
    const xs = bands.top[0].map((p) => p.x)
    expect(Math.min(...xs)).toBe(PAD + 10)
    expect(Math.max(...xs)).toBe(W - PAD - 10 - 1)
  })
  it('offset 0 starts exactly at the box edge and moves inward', () => {
    const bands = edgeBands(W, H, PAD, { band: 4, corner: 10, offset: 0 })
    expect(bands.top[0][0].y).toBe(PAD) // first line flush with the top of the box
    expect(bands.top[1][0].y).toBe(PAD + 1) // second line one px further in
    expect(bands.left[0][0].x).toBe(PAD)
    expect(bands.right[0][0].x).toBe(W - PAD - 1)
    expect(bands.bottom[0][0].y).toBe(H - PAD - 1)
  })
  it('a negative offset straddles the edge (used for the "card" glow, drawn outside the box)', () => {
    const bands = edgeBands(W, H, PAD, { band: 6, corner: 10, offset: -3 })
    const ys = bands.top.map((line) => line[0]?.y)
    expect(ys).toEqual([PAD - 3, PAD - 2, PAD - 1, PAD, PAD + 1, PAD + 2])
  })
})

describe('edgeHit best-line scoring', () => {
  it('reports the best single line, not an average across the band', () => {
    const image = makeImage(20, 20, gray)
    const colour = hexToRgb(POSITIVE)
    paintRect(image, 5, 5, 15, 6, [102, 192, 244]) // one fully-matching row
    const band = [
      [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], // matches
      [{ x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }], // does not
    ]
    const result = edgeHit(image, band, colour, { tolerance: 40 })
    expect(result.fraction).toBe(1)
    expect(result.matched).toBe(4)
  })
  it('lines with zero sampled pixels do not win and do not crash', () => {
    const image = makeImage(20, 20, gray)
    const colour = hexToRgb(POSITIVE)
    const band = [[], [{ x: 1, y: 1 }]] // first line empty (e.g. ran off the image), second gray
    const result = edgeHit(image, band, colour, { tolerance: 40 })
    expect(result.fraction).toBe(0)
    expect(result.matched).toBe(0)
  })
  it('reports the real sample count even when nothing matches (not 0 just because no line "won")', () => {
    // Regression test: an earlier version derived `total` from whichever line had the best
    // fraction, so when every line scored a tying 0, `total` stayed 0 even though pixels really
    // were sampled — checkCard then wrongly claimed "no pixels sampled" for a plain, unhighlighted
    // card. Caught via the check-borders.mjs CLI smoke test, not the unit tests, hence this case.
    const image = makeImage(20, 20, gray) // no matching colour anywhere
    const colour = hexToRgb(POSITIVE)
    const band = [
      [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
      [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
    ]
    const result = edgeHit(image, band, colour, { tolerance: 40 })
    expect(result.fraction).toBe(0)
    expect(result.matched).toBe(0)
    expect(result.total).toBe(3)
  })
})

describe('checkCard: row and card treatments on a full 4-edge ring', () => {
  const image = makeImage(W, H, gray)
  paintInwardRing(image, PAD, 2, [102, 192, 244]) // #66c0f4, 2px, flush inward on all 4 edges

  it('passes as a row', () => {
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(true)
    expect(result.edges.top.fraction).toBeGreaterThanOrEqual(0.6)
  })
  it('also passes as a card (band straddles the edge, still covers the inward ring)', () => {
    const result = checkCard(image, { shape: 'card', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(true)
  })
  it('fails as panel-y: top and bottom are unexpected (stray) highlight', () => {
    const result = checkCard(image, { shape: 'panel', axis: 'y', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(false)
    expect(result.edges.top.expected).toBe(false)
    expect(result.edges.top.fraction).toBeGreaterThanOrEqual(0.5)
    expect(result.edges.left.expected).toBe(true)
    expect(result.edges.left.fraction).toBeGreaterThanOrEqual(0.6)
  })
})

describe('checkCard: panel wings on left/right only', () => {
  const image = makeImage(W, H, gray)
  paintInwardRing(image, PAD, 2, [102, 192, 244], ['left', 'right'])

  it('passes as panel-y', () => {
    const result = checkCard(image, { shape: 'panel', axis: 'y', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(true)
  })
  it('fails as row: top and bottom never got the highlight colour', () => {
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(false)
    expect(result.edges.top.fraction).toBeLessThan(0.6)
    expect(result.edges.bottom.fraction).toBeLessThan(0.6)
  })
})

describe('checkCard: no highlight at all', () => {
  const plain = makeImage(W, H, gray)

  it('passes when no highlight is expected', () => {
    const result = checkCard(plain, { shape: null, color: null }, { pad: PAD })
    expect(result.ok).toBe(true)
    expect(expectedEdges({ shape: null })).toEqual({ top: false, right: false, bottom: false, left: false })
  })
  it('fails if we (incorrectly) expect a row ring on it', () => {
    const result = checkCard(plain, { shape: 'row', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(false)
  })
})

describe('checkCard: colour tolerance', () => {
  it('a close variant (#63bcef) still matches #66c0f4 at the default tolerance', () => {
    const image = makeImage(W, H, gray)
    paintInwardRing(image, PAD, 2, [0x63, 0xbc, 0xef])
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(true)
  })
  it('the mixed tone (#b9a074) does NOT match #66c0f4', () => {
    const image = makeImage(W, H, gray)
    paintInwardRing(image, PAD, 2, [0xb9, 0xa0, 0x74])
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(false)
    expect(result.edges.top.fraction).toBe(0)
  })
  it('sanity: the mixed colour really is far outside tolerance of positive', () => {
    expect(colourDistance(hexToRgb(MIXED), hexToRgb(POSITIVE))).toBeGreaterThan(40)
  })
})

describe('checkCard: corner skipping', () => {
  it('colour present ONLY in the corners does not make an edge pass', () => {
    const image = makeImage(W, H, gray)
    paintCornersOnly(image, PAD, 2, [102, 192, 244])
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(false)
    expect(result.edges.top.fraction).toBe(0)
    expect(result.edges.left.fraction).toBe(0)
  })
})

describe('checkCard: a ring just one pixel thick', () => {
  it('still scores ~1 on its one matching line inside a wider band', () => {
    const image = makeImage(W, H, gray)
    paintInwardRing(image, PAD, 1, [102, 192, 244])
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: PAD, band: 4 })
    expect(result.ok).toBe(true)
    expect(result.edges.top.fraction).toBe(1)
  })
})

describe('checkCard: op (orbiting) cards use a lower minHit', () => {
  // Paint only ~45% of each edge's sampled line: below the default minHit (0.6) but above the
  // op-specific minHit (0.35).
  function partialRingImage() {
    const image = makeImage(W, H, gray)
    const bands = edgeBands(W, H, PAD, { band: 4, corner: 10, offset: 0 })
    for (const name of ['top', 'right', 'bottom', 'left'] as const) {
      paintAlongLine(image, bands[name][0], 0.45, [102, 192, 244])
      paintAlongLine(image, bands[name][1], 0.45, [102, 192, 244])
    }
    return image
  }

  it('fails a plain row check at the default minHit', () => {
    const result = checkCard(partialRingImage(), { shape: 'row', color: POSITIVE, op: false }, { pad: PAD })
    expect(result.ok).toBe(false)
  })
  it('passes once op:true relaxes minHit to 0.35, and notes why', () => {
    const result = checkCard(partialRingImage(), { shape: 'row', color: POSITIVE, op: true }, { pad: PAD })
    expect(result.ok).toBe(true)
    expect(result.notes.some((n) => n.includes('0.35'))).toBe(true)
  })
})

describe('checkCard: maxStray gap between "passes clean" and "fails as bleed"', () => {
  function panelWithTopBottomStray(coverage: number) {
    const image = makeImage(W, H, gray)
    paintInwardRing(image, PAD, 2, [102, 192, 244], ['left', 'right']) // the real, expected wings
    const bands = edgeBands(W, H, PAD, { band: 4, corner: 10, offset: 0 })
    paintAlongLine(image, bands.top[0], coverage, [102, 192, 244])
    paintAlongLine(image, bands.top[1], coverage, [102, 192, 244])
    paintAlongLine(image, bands.bottom[0], coverage, [102, 192, 244])
    paintAlongLine(image, bands.bottom[1], coverage, [102, 192, 244])
    return image
  }

  it('a little stray bleed (0.3, below 0.5) does not fail the card', () => {
    const result = checkCard(panelWithTopBottomStray(0.3), { shape: 'panel', axis: 'y', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(true)
  })
  it('heavier stray bleed (0.7, above 0.5) does fail the card', () => {
    const result = checkCard(panelWithTopBottomStray(0.7), { shape: 'panel', axis: 'y', color: POSITIVE }, { pad: PAD })
    expect(result.ok).toBe(false)
    expect(result.edges.top.expected).toBe(false)
  })
})

describe('checkCard: filtered "dim" cards record mean luminance', () => {
  it('adds a luminance note without changing pass/fail', () => {
    const image = makeImage(W, H, [10, 10, 10])
    paintInwardRing(image, PAD, 2, [102, 192, 244])
    const result = checkCard(image, { shape: 'row', color: POSITIVE, filtered: 'dim' }, { pad: PAD })
    expect(result.ok).toBe(true)
    expect(result.notes.some((n) => /mean luminance/.test(n))).toBe(true)
  })
})

describe('degenerate geometry: bands that run off the crop or off the card', () => {
  it('a band wider than the card yields empty (not crashing) lines past the image edge', () => {
    // pad=2, height=10 -> box rows [2,8); a 6px-thick band offset -3 (the "card" geometry)
    // pushes one end of top and one end of bottom past the image bounds.
    const bands = edgeBands(40, 10, 2, { band: 6, corner: 10, offset: -3 })
    expect(bands.top[0]).toEqual([]) // y = -1, out of range
    expect(bands.top[1].length).toBeGreaterThan(0) // y = 0, in range
    expect(bands.bottom[0]).toEqual([]) // y = 10, out of range
    const image = makeImage(40, 10, gray)
    expect(() => edgeHit(image, bands.top, hexToRgb(POSITIVE))).not.toThrow()
  })

  it('a card smaller than the corner skip samples nothing on any edge, and checkCard says so', () => {
    // pad=4, width=height=24 -> box is 16x16; corner=10 skipped from each end leaves nothing.
    const image = makeImage(24, 24, gray)
    paintInwardRing(image, 4, 2, [102, 192, 244])
    const result = checkCard(image, { shape: 'row', color: POSITIVE }, { pad: 4, corner: 10, band: 4 })
    expect(result.ok).toBe(false)
    expect(result.edges.top.fraction).toBe(0)
    expect(result.notes.some((n) => n.includes('no pixels sampled'))).toBe(true)
  })
})

describe('occluded edges', () => {
  // Steam's sticky category bar covers a card's top edge while the card is still fully on screen;
  // those pixels belong to the page, not to us, so that edge must not be judged either way.
  const blue: [number, number, number] = [0x66, 0xc0, 0xf4]

  it('does not fail an expected edge that the page paints over', () => {
    const img = makeImage(W, H, gray)
    paintInwardRing(img, PAD, 2, blue)
    paintRect(img, PAD, PAD, W - PAD, PAD + 2, gray) // the bar wiped the top ring
    const card = { shape: 'row' as const, color: POSITIVE }
    expect(checkCard(img, card, { pad: PAD }).ok).toBe(false)
    const skipped = checkCard(img, { ...card, occluded: { top: true } }, { pad: PAD })
    expect(skipped.ok).toBe(true)
    expect(skipped.edges.top.occluded).toBe(true)
  })

  it('does not fail a stray hit on an edge the page paints over', () => {
    const img = makeImage(W, H, gray)
    paintInwardRing(img, PAD, 2, blue) // colour where nothing should be highlighted
    const card = { shape: null, color: POSITIVE }
    expect(checkCard(img, card, { pad: PAD }).ok).toBe(false)
    const all = { top: true, right: true, bottom: true, left: true }
    expect(checkCard(img, { ...card, occluded: all }, { pad: PAD }).ok).toBe(true)
  })
})

describe('alpha-composited rings (pixelMatches)', () => {
  // The ring is drawn at 85% alpha, so the same ring measures differently depending on what the
  // page put behind it. These are real values sampled from a capture of the category hero capsule.
  const blue = hexToRgb(POSITIVE)

  it('accepts the ring over both a dark artwork and the page background', () => {
    expect(pixelMatches({ r: 82, g: 153, b: 195 }, blue)).toBe(true) // over dark artwork
    expect(pixelMatches({ r: 93, g: 176, b: 224 }, blue)).toBe(true) // over the page background
  })

  it('still rejects the dark page background itself', () => {
    expect(pixelMatches({ r: 15, g: 25, b: 36 }, blue)).toBe(false)
    expect(pixelMatches({ r: 5, g: 7, b: 11 }, blue)).toBe(false)
    expect(pixelMatches({ r: 0, g: 0, b: 0 }, blue)).toBe(false)
  })

  it('rejects the other tone colours and unrelated bright pixels', () => {
    expect(pixelMatches(hexToRgb(MIXED), blue)).toBe(false)
    expect(pixelMatches(hexToRgb(NEGATIVE), blue)).toBe(false)
    expect(pixelMatches({ r: 255, g: 255, b: 255 }, blue)).toBe(false)
  })

  it('rejects a ring dimmed far below the brightness floor', () => {
    // e.g. the same blue under a 75% black overlay: right hue, far too dark to read as a ring
    expect(pixelMatches({ r: 26, g: 48, b: 61 }, blue)).toBe(false)
  })

  it('accepts a blended mixed-tone ring against the mixed colour', () => {
    expect(pixelMatches({ r: 157, g: 136, b: 99 }, hexToRgb(MIXED))).toBe(true)
  })
})

describe('unexpected edges are policed against every tone', () => {
  // A panel card is the one shape with both a colour and edges that must stay bare. Checking those
  // edges only against the card's own tone let a ring in a DIFFERENT tone pass unnoticed.
  it('fails a panel-y card with a wrong-tone ring on its bare top and bottom', () => {
    const img = makeImage(W, H, gray)
    const blue: [number, number, number] = [0x66, 0xc0, 0xf4]
    const orange: [number, number, number] = [0xc8, 0x5e, 0x2d]
    paintInwardRing(img, PAD, 3, blue, ['left', 'right']) // correct wings
    paintInwardRing(img, PAD, 3, orange, ['top', 'bottom']) // must not be there, and is not our tone
    const card = { shape: 'panel' as const, axis: 'y' as const, color: POSITIVE }
    const res = checkCard(img, card, { pad: PAD })
    expect(res.edges.left.pass).toBe(true)
    expect(res.edges.right.pass).toBe(true)
    expect(res.edges.top.pass).toBe(false)
    expect(res.edges.bottom.pass).toBe(false)
    expect(res.ok).toBe(false)
  })
})
