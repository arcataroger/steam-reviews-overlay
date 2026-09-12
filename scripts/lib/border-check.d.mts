// Hand-written type surface for border-check.mjs, so tests/unit/border-check.test.ts (checked by
// tsconfig.tests.json, which has no `allowJs`) can import the .mjs module without an implicit any.
// Keep in sync with the JSDoc in border-check.mjs by hand — there is no build step in between.

export interface RgbColour {
  r: number
  g: number
  b: number
}

export interface RgbaImage {
  width: number
  height: number
  data: { [index: number]: number; length: number }
}

export type Point = { x: number; y: number }
export type Band = Point[][]

export interface EdgeBands {
  top: Band
  right: Band
  bottom: Band
  left: Band
}

export type EdgeName = 'top' | 'right' | 'bottom' | 'left'

export interface EdgeBooleans {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export interface EdgeHitResult {
  fraction: number
  matched: number
  total: number
}

export interface CardLike {
  /** Per-edge flag: a highlighted card is butted against that edge, so its ring bleeds into ours. */
  neighbourHighlight?: Partial<Record<EdgeName, boolean>> | null
  /** Per-edge flag: the page paints over that edge, so its pixels are not judged. */
  occluded?: Partial<Record<EdgeName, boolean>>
  highlight?: string | null
  shape?: 'row' | 'panel' | 'card' | 'none' | null
  axis?: 'x' | 'y' | null
  color?: string | null
  op?: boolean | null
  filtered?: string | null
}

export interface EdgeBandOpts {
  band?: number
  corner?: number
  offset?: number
}

export interface EdgeHitOpts {
  tolerance?: number
}

export interface CheckCardOpts {
  baseline?: RgbaImage | null
  negativeNeedsBaseline?: boolean
  minGain?: number
  chroma?: number
  minBrightness?: number
  pad?: number
  band?: number
  corner?: number
  offset?: number
  tolerance?: number
  minHit?: number
  maxStray?: number
  opMinHit?: number
}

export interface CheckCardResult {
  ok: boolean
  edges: Record<EdgeName, { expected: boolean; fraction: number; matched: number; sampled: number; pass: boolean; occluded: boolean; baseline: number | null; gained: number | null; unverified: boolean }>
  notes: string[]
}

export interface TreatmentGeometry {
  offset: number
  band: number
  corner: number
}

export declare const TREATMENT_GEOMETRY: Record<string, TreatmentGeometry>

export declare const DEFAULT_OPTIONS: {
  pad: number
  band: number
  corner: number
  offset: number
  tolerance: number
  minHit: number
  maxStray: number
  opMinHit: number
}

export declare function hexToRgb(hex: string): RgbColour
export declare function colourDistance(a: RgbColour, b: RgbColour): number
export declare function edgeBands(width: number, height: number, pad: number, opts?: EdgeBandOpts): EdgeBands
export declare function edgeHit(image: RgbaImage, band: Band, colour: RgbColour, opts?: EdgeHitOpts): EdgeHitResult
export interface EdgeGainResult {
  fraction: number
  matched: number
  baseFraction: number
  gain: number
  total: number
}

/** Best line of a band scored by how much more of `colour` it holds than the same line of `baseline`. */
export declare function edgeGain(
  image: RgbaImage,
  baseline: RgbaImage | null,
  band: Point[][],
  colour: RgbColour,
  opts?: EdgeHitOpts,
): EdgeGainResult

export declare function expectedEdges(card?: CardLike): EdgeBooleans
export declare function checkCard(image: RgbaImage, card?: CardLike, opts?: CheckCardOpts): CheckCardResult

/** Chromaticity (each channel over their sum); null for pure black. */
export function chromaticity(c: RgbColour): RgbColour | null

/** Does this pixel show the highlight colour, allowing for alpha compositing over any backdrop? */
export function pixelMatches(
  pixel: RgbColour,
  colour: RgbColour,
  opts?: { tolerance?: number; chroma?: number; minBrightness?: number },
): boolean

/** Every colour the overlay can draw a highlight in. */
export declare const TONE_PALETTE: RgbColour[]
