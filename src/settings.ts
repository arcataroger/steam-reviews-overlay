/** User settings shared between the popup and the content script. */

export type FilterMode = 'dim' | 'hide'
export type ScoreSource = 'global' | 'local'

/**
 * Lever positions live on Steam's tier ladder: 1 = Overwhelmingly Negative ... 9 = Overwhelmingly
 * Positive (Steam's own review_score). Integer = exactly that tier. A fractional position between
 * two tiers whose percent bands differ means "this percent positive" (linearly interpolated);
 * between tiers that differ only by review count (e.g. Positive vs Very Positive) there is no
 * in-between and the lever snaps to a tier.
 */
export interface Settings {
  mode: FilterMode
  /** 1-9, or OFF_FILTER (0) = parked. Games under this are dimmed/hidden. */
  threshold: number
  source: ScoreSource
  /** 1-9, or OFF_HIGHLIGHT (10) = parked. Games at/above this are outlined. */
  highlightThreshold: number
}

export const OFF_FILTER = 0
export const OFF_HIGHLIGHT = 10

export const DEFAULT_SETTINGS: Settings = {
  mode: 'dim',
  threshold: OFF_FILTER,
  source: 'global',
  highlightThreshold: OFF_HIGHLIGHT,
}

export interface Tier {
  score: number
  name: string
  tone: 'positive' | 'mixed' | 'negative'
  /** Start of the percent band Steam uses for this label. */
  pct: number
  /** Short statement of Steam's rule, for the notch label. */
  rule: string
}

/** Steam's nine labels, in review_score order. Bands per Steam: see README. */
export const TIERS: Tier[] = [
  { score: 1, name: 'Overwhelmingly Negative', tone: 'negative', pct: 0, rule: '0–19%, 500+ reviews' },
  { score: 2, name: 'Very Negative', tone: 'negative', pct: 0, rule: '0–19%, 50+ reviews' },
  { score: 3, name: 'Negative', tone: 'negative', pct: 0, rule: '0–19%' },
  { score: 4, name: 'Mostly Negative', tone: 'negative', pct: 20, rule: '20–39%' },
  { score: 5, name: 'Mixed', tone: 'mixed', pct: 40, rule: '40–69%' },
  { score: 6, name: 'Mostly Positive', tone: 'positive', pct: 70, rule: '70–79%' },
  { score: 7, name: 'Positive', tone: 'positive', pct: 80, rule: '80%+' },
  { score: 8, name: 'Very Positive', tone: 'positive', pct: 80, rule: '80%+, 50+ reviews' },
  { score: 9, name: 'Overwhelmingly Positive', tone: 'positive', pct: 95, rule: '95%+, 500+ reviews' },
]

export const tierAt = (score: number): Tier => TIERS[Math.min(9, Math.max(1, score)) - 1]

/** Can the lever rest between tier `lo` and `lo + 1`? Only if their percent bands differ. */
export function hasPercentGap(lo: number): boolean {
  return lo >= 1 && lo < 9 && tierAt(lo).pct !== tierAt(lo + 1).pct
}

/** Percent positive represented by a position (integer positions map to the band start). */
export function posToPct(pos: number): number {
  const lo = Math.floor(pos)
  const frac = pos - lo
  if (!frac || lo >= 9) return tierAt(lo).pct
  return tierAt(lo).pct + (tierAt(lo + 1).pct - tierAt(lo).pct) * frac
}

/** Snap: to a tier when close, or always when the neighbours differ only by review count. */
export function snapPosition(pos: number, tolerance = 0.12): number {
  const clamped = Math.min(9, Math.max(1, pos))
  const nearest = Math.round(clamped)
  if (Math.abs(clamped - nearest) <= tolerance) return nearest
  const lo = Math.floor(clamped)
  if (!hasPercentGap(lo)) return nearest
  return Math.round(clamped * 100) / 100
}

const KEY = 'sro:settings:v4'
const OLD_KEYS = ['sro:settings:v3', 'sro:settings:v2']
const ext: typeof chrome = (globalThis as any).browser ?? chrome
const area = () => ext.storage.sync ?? ext.storage.local

function normalize(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  s.threshold = Number(s.threshold)
  s.highlightThreshold = Number(s.highlightThreshold)
  if (!Number.isFinite(s.threshold)) s.threshold = OFF_FILTER
  if (!Number.isFinite(s.highlightThreshold)) s.highlightThreshold = OFF_HIGHLIGHT
  s.threshold = s.threshold <= 0 ? OFF_FILTER : snapPosition(s.threshold)
  s.highlightThreshold = s.highlightThreshold >= 10 ? OFF_HIGHLIGHT : snapPosition(s.highlightThreshold)
  if (s.mode !== 'hide') s.mode = 'dim'
  if (s.source !== 'local') s.source = 'global'
  return s
}

/** Older versions stored a 0-100 percent (0/-1 = off on the left, 100/101 = off on the right). */
function pctToPos(pct: number, side: 'filter' | 'highlight'): number {
  if (side === 'filter' && pct < 0) return OFF_FILTER
  if (side === 'highlight' && pct > 100) return OFF_HIGHLIGHT
  // Prefer the "stronger" tier on ties: 0 -> Negative, 80 -> Very Positive
  const exact = [...TIERS].reverse().find((t) => t.pct === pct)
  if (exact) return exact.score
  for (let lo = 1; lo < 9; lo++) {
    const a = tierAt(lo).pct
    const b = tierAt(lo + 1).pct
    if (pct > a && pct < b) return lo + (pct - a) / (b - a)
  }
  return pct < 20 ? 3 : 9
}

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await area().get([KEY, ...OLD_KEYS])
    if (res?.[KEY]) return normalize(res[KEY] as Partial<Settings>)
    const old = (res?.[OLD_KEYS[0]] ?? res?.[OLD_KEYS[1]]) as
      | (Omit<Partial<Settings>, 'mode'> & { mode?: string; highlight?: string })
      | undefined
    if (!old) return { ...DEFAULT_SETTINGS }
    const wasLabel = old.mode === 'label'
    const t = old.threshold ?? -1
    const h = old.highlightThreshold ?? 101
    return normalize({
      mode: wasLabel || old.mode !== 'hide' ? 'dim' : 'hide',
      source: old.source,
      threshold: wasLabel || t <= 0 ? OFF_FILTER : pctToPos(t, 'filter'),
      highlightThreshold: old.highlight === 'off' || h >= 100 ? OFF_HIGHLIGHT : pctToPos(h, 'highlight'),
    })
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await area().set({ [KEY]: s })
}

export function onSettingsChange(cb: (s: Settings) => void): void {
  ext.storage.onChanged.addListener((changes) => {
    const c = changes[KEY]
    if (c) cb(normalize(c.newValue as Partial<Settings> | undefined))
  })
}

type Judged = { score: number; pct: number | null } | null

/**
 * Steam-only comparison: is this game at or above the bar?
 *  - on a tier: compare Steam's review_score (what Steam's own "sort by reviews" does; respects
 *    its review-count rules)
 *  - between tiers: compare Steam's integer percent_positive to the interpolated percent
 * Games Steam gives no score to (fewer than 10 reviews) return null.
 */
export function meetsBar(summary: Judged, pos: number): boolean | null {
  if (!summary || summary.score === 0) return null
  if (Number.isInteger(pos)) return summary.score >= pos
  if (summary.pct === null) return summary.score >= Math.ceil(pos)
  return summary.pct >= posToPct(pos)
}

/** Below the filter bar? Parked lever filters nothing; unscored games are never filtered. */
export function isFiltered(summary: Judged, s: Settings): boolean {
  if (s.threshold <= OFF_FILTER) return false
  return meetsBar(summary, s.threshold) === false
}

/** At or above the highlight bar? Parked lever highlights nothing. */
export function isHighlighted(summary: Judged, s: Settings): boolean {
  if (s.highlightThreshold >= OFF_HIGHLIGHT) return false
  return meetsBar(summary, s.highlightThreshold) === true
}

/** Tone at a position (for colors): the tier at or just below it. */
export function tierFor(pos: number): Tier {
  return tierAt(Math.max(1, Math.floor(Math.min(9, pos))))
}
