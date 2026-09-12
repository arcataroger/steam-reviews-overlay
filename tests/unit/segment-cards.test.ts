import { describe, it, expect } from 'vitest'
// @ts-expect-error - plain JS script, no declaration file
import { tierWord, tierSegment, treatmentString, slugify, titleSegment, colourSegment, buildFileName, cropRect } from '../../scripts/segment-cards.mjs'

const baseCard = (over: Record<string, unknown> = {}) => ({
  appid: 620,
  title: 'Portal 2',
  score: 9,
  color: '#66c0f4',
  highlight: null,
  shape: null,
  axis: null,
  filtered: null,
  op: false,
  ...over,
})

describe('tierWord / tierSegment', () => {
  it('names every score 0-9', () => {
    expect(tierWord(0)).toBe('none')
    expect(tierWord(1)).toBe('overwhelmingly-negative')
    expect(tierWord(2)).toBe('very-negative')
    expect(tierWord(3)).toBe('negative')
    expect(tierWord(4)).toBe('mostly-negative')
    expect(tierWord(5)).toBe('mixed')
    expect(tierWord(6)).toBe('mostly-positive')
    expect(tierWord(7)).toBe('positive')
    expect(tierWord(8)).toBe('very-positive')
    expect(tierWord(9)).toBe('overwhelmingly-positive')
  })
  it('builds the tN-word segment', () => {
    expect(tierSegment(9)).toBe('t9-overwhelmingly-positive')
    expect(tierSegment(0)).toBe('t0-none')
    expect(tierSegment(5)).toBe('t5-mixed')
  })
})

describe('treatmentString', () => {
  it('is "none" when not highlighted', () => {
    expect(treatmentString(baseCard())).toBe('none')
  })
  it('is the shape alone for row and card (no axis)', () => {
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'row' }))).toBe('row')
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'card' }))).toBe('card')
  })
  it('is shape-axis for panel', () => {
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'panel', axis: 'y' }))).toBe('panel-y')
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'panel', axis: 'x' }))).toBe('panel-x')
  })
  it('appends -dim when filtered is dim', () => {
    expect(treatmentString(baseCard({ filtered: 'dim' }))).toBe('none-dim')
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'row', filtered: 'dim' }))).toBe('row-dim')
  })
  it('appends -hide for both hide and hiding', () => {
    expect(treatmentString(baseCard({ filtered: 'hide' }))).toBe('none-hide')
    expect(treatmentString(baseCard({ filtered: 'hiding' }))).toBe('none-hide')
  })
  it('appends -op when op is true, after the filtered suffix', () => {
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'panel', axis: 'y', op: true }))).toBe('panel-y-op')
    expect(treatmentString(baseCard({ highlight: 'positive', shape: 'row', filtered: 'dim', op: true }))).toBe('row-dim-op')
  })
})

describe('slugify', () => {
  it('lowercases and collapses non [a-z0-9] runs to a single dash', () => {
    expect(slugify('Portal 2')).toBe('portal-2')
    expect(slugify('Half-Life: Alyx!!')).toBe('half-life-alyx')
    expect(slugify('  leading & trailing  ')).toBe('leading-trailing')
    expect(slugify('Amnesia™: Rebirth')).toBe('amnesia-rebirth')
  })
  it('trims leading/trailing dashes', () => {
    expect(slugify('---abc---')).toBe('abc')
  })
  it('handles empty/null input', () => {
    expect(slugify('')).toBe('')
    expect(slugify(undefined)).toBe('')
  })
})

describe('titleSegment', () => {
  it('slugifies a normal title', () => {
    expect(titleSegment('Portal 2')).toBe('portal-2')
  })
  it('falls back to "untitled" when empty or unknown', () => {
    expect(titleSegment('')).toBe('untitled')
    expect(titleSegment(undefined)).toBe('untitled')
  })
  it('falls back to "untitled" when the title is pure punctuation', () => {
    expect(titleSegment('!!!')).toBe('untitled')
  })
  it('truncates to 40 chars before slugifying', () => {
    const longTitle = 'A'.repeat(40) + 'ZZZZZZZZZZ' // only the first 40 chars should survive
    expect(titleSegment(longTitle)).toBe('a'.repeat(40))
  })
})

describe('colourSegment', () => {
  it('strips the # and lowercases', () => {
    expect(colourSegment('#66C0F4')).toBe('66c0f4')
  })
  it('is "nocolour" when there is no colour', () => {
    expect(colourSegment(null)).toBe('nocolour')
    expect(colourSegment(undefined)).toBe('nocolour')
    expect(colourSegment('')).toBe('nocolour')
  })
})

describe('buildFileName', () => {
  it('assembles every segment in order', () => {
    const used = new Set<string>()
    const card = baseCard({ highlight: 'positive', shape: 'panel', axis: 'y' })
    const name = buildFileName({ slug: 'home', state: 'active', stop: 3, card }, used)
    expect(name).toBe('home__active__3__app620__portal-2__t9-overwhelmingly-positive__panel-y__66c0f4.png')
  })
  it('slugifies the slug/state segments too', () => {
    const used = new Set<string>()
    const card = baseCard()
    const name = buildFileName({ slug: 'search_term-Portal', state: 'Active State', stop: 0, card }, used)
    expect(name.startsWith('search-term-portal__active-state__0__')).toBe(true)
  })
  it('appends -2, -3, ... on collision, and leaves the first instance bare', () => {
    const used = new Set<string>()
    const card = baseCard()
    const first = buildFileName({ slug: 'home', state: 'active', stop: 0, card }, used)
    const second = buildFileName({ slug: 'home', state: 'active', stop: 0, card }, used)
    const third = buildFileName({ slug: 'home', state: 'active', stop: 0, card }, used)
    expect(first.endsWith('-2.png')).toBe(false)
    expect(second).toBe(first.replace(/\.png$/, '-2.png'))
    expect(third).toBe(first.replace(/\.png$/, '-3.png'))
  })
})

describe('cropRect', () => {
  const rect = { x: 40, y: 220, w: 616, h: 353 }

  it('pads and scales by dpr 1 with room to spare', () => {
    const crop = cropRect(rect, 1, 12, 2000, 2000)
    expect(crop).toEqual({ x: 28, y: 208, w: 640, h: 377 })
  })
  it('pads and scales by dpr 2 with room to spare', () => {
    const crop = cropRect(rect, 2, 12, 4000, 4000)
    expect(crop).toEqual({ x: 56, y: 416, w: 1280, h: 754 })
  })
  it('clamps at the left/top edge of the image', () => {
    const crop = cropRect({ x: 0, y: 0, w: 100, h: 50 }, 1, 12, 2000, 2000)
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(0)
    expect(crop.w).toBe(112) // 100 + 12 pad on the right only, left pad clipped
    expect(crop.h).toBe(62)
  })
  it('clamps at the right/bottom edge of the image', () => {
    const crop = cropRect({ x: 1900, y: 1950, w: 100, h: 50 }, 1, 12, 2000, 2000)
    expect(crop.x).toBe(1888)
    expect(crop.y).toBe(1938)
    expect(crop.w).toBe(112) // right pad clipped at image width 2000
    expect(crop.h).toBe(62)
  })
  it('clamps on both dpr 2 and every edge at once for a tiny image', () => {
    const crop = cropRect({ x: 0, y: 0, w: 10, h: 10 }, 2, 12, 20, 20)
    expect(crop).toEqual({ x: 0, y: 0, w: 20, h: 20 })
  })
  it('never returns a negative width/height', () => {
    const crop = cropRect({ x: 5, y: 5, w: 1, h: 1 }, 1, 12, 4, 4)
    expect(crop.w).toBeGreaterThanOrEqual(0)
    expect(crop.h).toBeGreaterThanOrEqual(0)
  })
})

describe('manifest padding units', () => {
  // The crop is cut in device pixels (pad * dpr), so the manifest must hand the pixel checker the
  // same units it measured in. Recording only the CSS-px pad made every sampling band land short of
  // the card box at dpr 2, failing every correct highlight.
  it('crop padding is the CSS pad scaled by dpr on every side', () => {
    const rect = { x: 100, y: 50, w: 200, h: 120 }
    const c1 = cropRect(rect, 1, 12, 4000, 4000)
    expect(c1.x).toBe(100 - 12)
    expect(c1.w).toBe(200 + 24)
    const c2 = cropRect(rect, 2, 12, 4000, 4000)
    expect(c2.x).toBe(200 - 24)
    expect(c2.y).toBe(100 - 24)
    expect(c2.w).toBe(400 + 48)
    expect(c2.h).toBe(240 + 48)
    // what the checker must be told, in the crop's own units
    expect(c2.w - rect.w * 2).toBe(12 * 2 * 2)
  })
})
