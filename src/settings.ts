/** User settings shared between the popup and the content script. */

export type FilterMode = 'dim' | 'hide'
export type ScoreSource = 'global' | 'local'

export interface Settings {
  /** What to do with games under `threshold`. */
  mode: FilterMode
  /** 0-100, or OFF_FILTER (-1) = lever parked, nothing filtered. */
  threshold: number
  /** Which Steam score the filter looks at: all languages, or the user's language. */
  source: ScoreSource
  /** 0-100, or OFF_HIGHLIGHT (101) = lever parked, nothing outlined. */
  highlightThreshold: number
}

/** Sentinel lever positions: parked in the gate beyond the end notch. */
export const OFF_FILTER = -1
export const OFF_HIGHLIGHT = 101

export const DEFAULT_SETTINGS: Settings = {
  mode: 'dim',
  threshold: OFF_FILTER,
  source: 'global',
  highlightThreshold: OFF_HIGHLIGHT,
}

/**
 * Steam's named tiers and the minimum positive-% at which they start.
 * (Steam also requires review counts: e.g. Overwhelmingly needs 500+, Very needs 50+;
 * the label the store shows is authoritative — these are the % bands behind it.)
 */
export interface Setpoint {
  pct: number
  name: string
  tone: 'positive' | 'mixed' | 'negative'
  /** Minimum Steam review_score (0-9) that counts as "at or above" this notch. */
  minScore: number
}

export const SETPOINTS: Setpoint[] = [
  // "Under Negative" = Very Negative and Overwhelmingly Negative (Steam scores 1-2)
  { pct: 0, name: 'Negative', tone: 'negative', minScore: 3 },
  { pct: 20, name: 'Mostly Negative', tone: 'negative', minScore: 4 },
  { pct: 40, name: 'Mixed', tone: 'mixed', minScore: 5 },
  { pct: 70, name: 'Mostly Positive', tone: 'positive', minScore: 6 },
  // Steam's "Positive" (score 7) is the same 80%+ band with 10-49 reviews, so it passes this notch too.
  { pct: 80, name: 'Very Positive', tone: 'positive', minScore: 7 },
  { pct: 95, name: 'Overwhelmingly Positive', tone: 'positive', minScore: 9 },
]

/** Snap a raw slider value to a named setpoint when it's close. */
export function snapThreshold(pct: number, tolerance = 3): number {
  for (const s of SETPOINTS) if (Math.abs(pct - s.pct) <= tolerance) return s.pct
  return pct
}

/** The tier band a percentage falls in. */
export function tierFor(pct: number) {
  let cur = SETPOINTS[0]
  for (const s of SETPOINTS) if (pct >= s.pct) cur = s
  return cur
}

const KEY = 'sro:settings:v3'
const OLD_KEY = 'sro:settings:v2'
const ext: typeof chrome = (globalThis as any).browser ?? chrome
const area = () => ext.storage.sync ?? ext.storage.local

function normalize(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  s.threshold = Math.min(100, Math.max(OFF_FILTER, Math.round(Number(s.threshold))))
  s.highlightThreshold = Math.min(OFF_HIGHLIGHT, Math.max(0, Math.round(Number(s.highlightThreshold))))
  if (Number.isNaN(s.threshold)) s.threshold = OFF_FILTER
  if (Number.isNaN(s.highlightThreshold)) s.highlightThreshold = OFF_HIGHLIGHT
  return s
}

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await area().get([KEY, OLD_KEY])
    if (res?.[KEY]) return normalize(res[KEY] as Partial<Settings>)
    // v2 -> v3: in v2, 0 / 100 meant "off"; those are now real notches, the gates are beyond them.
    const old = res?.[OLD_KEY] as (Omit<Partial<Settings>, 'mode'> & { mode?: string; highlight?: string }) | undefined
    if (!old) return { ...DEFAULT_SETTINGS }
    const wasLabel = old.mode === 'label'
    const m: Partial<Settings> & { includeUnreviewed?: boolean } = { ...old, mode: wasLabel || !old.mode ? 'dim' : (old.mode as FilterMode) }
    delete m.includeUnreviewed
    if (wasLabel || !old.threshold) m.threshold = OFF_FILTER
    if (old.highlight === 'off' || old.highlightThreshold === undefined || old.highlightThreshold >= 100) m.highlightThreshold = OFF_HIGHLIGHT
    delete (m as any).highlight
    return normalize(m)
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
 *  - on a named notch, compare Steam's tier (review_score), which is what Steam's own
 *    "sort by reviews" does and accounts for its review-count requirements
 *  - between notches, compare Steam's integer percent_positive
 * Games Steam gives no score to (fewer than 10 reviews) return null: the caller decides.
 */
export function meetsBar(summary: Judged, threshold: number): boolean | null {
  if (!summary || summary.score === 0) return null
  const notch = SETPOINTS.find((p) => p.pct === threshold)
  if (notch) return summary.score >= notch.minScore
  if (summary.pct === null) return summary.score >= tierFor(threshold).minScore
  return summary.pct >= threshold
}

/** Below the filter bar? Parked lever filters nothing; games Steam hasn't scored are never filtered. */
export function isFiltered(summary: Judged, s: Settings): boolean {
  if (s.threshold < 0) return false
  return meetsBar(summary, s.threshold) === false
}

/** At or above the highlight bar? Parked lever highlights nothing. */
export function isHighlighted(summary: Judged, s: Settings): boolean {
  if (s.highlightThreshold > 100) return false
  return meetsBar(summary, s.highlightThreshold) === true
}
