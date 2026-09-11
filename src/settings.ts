/** User settings shared between the popup and the content script. */

export type FilterMode = 'dim' | 'hide'
export type ScoreSource = 'global' | 'local'

/**
 * Lever positions live on Steam's tier ladder: 1 = Overwhelmingly Negative ... 9 = Overwhelmingly
 * Positive (Steam's own review_score). Levers always rest on a tier.
 */
export interface Settings {
  mode: FilterMode
  /** 1-9, or OFF_FILTER (0) = parked. Games at this tier or lower are dimmed/hidden. */
  threshold: number
  source: ScoreSource
  /** 1-9, or OFF_HIGHLIGHT (10) = parked. Games at this tier or higher are outlined. */
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

/** Start of the percent band for a tier position. */
export function posToPct(pos: number): number {
  return tierAt(Math.round(pos)).pct
}

/** Levers always snap to the nearest tier. */
export function snapPosition(pos: number): number {
  return Math.round(Math.min(9, Math.max(1, pos)))
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
  // Whatever storage or a migration handed us, the levers must not collide (highlight strictly above filter)
  return reconcile(s, 'filter')
}

/**
 * Older versions stored a 0-100 percent (0/-1 = off on the left, 100/101 = off on the right).
 * The old filter meant "under P%"; the new one is inclusive, so map to the tier just below the band
 * that starts at P. The highlight ("at or above P%") maps to the tier whose band starts at P.
 */
export function pctToPos(pct: number, side: 'filter' | 'highlight'): number {
  if (side === 'filter') {
    if (pct <= 0) return OFF_FILTER
    const first = TIERS.find((t) => t.pct >= pct)
    return first ? Math.max(OFF_FILTER, first.score - 1) : 9
  }
  if (pct > 100) return OFF_HIGHLIGHT
  // "at or above 80%" included Positive as well as Very Positive: take the LOWEST tier on a tie
  const exact = TIERS.find((t) => t.pct === pct)
  if (exact) return exact.score
  const next = TIERS.find((t) => t.pct > pct)
  return next ? next.score : 9
}

const STAMP = `${KEY}:t`

/** Read the newest copy from sync and local (saves mirror to both; sync can be throttled or absent). */
async function readNewest(): Promise<Record<string, unknown> | undefined> {
  const [syncRes, localRes] = await Promise.all([
    ext.storage.sync ? ext.storage.sync.get([KEY, STAMP, ...OLD_KEYS]).catch(() => undefined) : undefined,
    ext.storage.local.get([KEY, STAMP, ...OLD_KEYS]).catch(() => undefined),
  ])
  const ts = (r?: Record<string, unknown>) => Number(r?.[STAMP] ?? 0)
  if (localRes?.[KEY] && (!syncRes?.[KEY] || ts(localRes) > ts(syncRes))) return localRes
  if (syncRes?.[KEY]) return syncRes
  // No current settings anywhere: surface legacy keys from either area for migration
  return { ...(localRes ?? {}), ...(syncRes ?? {}) }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await readNewest()
    if (res?.[KEY]) return normalize(res[KEY] as Partial<Settings>)
    const old = (res?.[OLD_KEYS[0]] ?? res?.[OLD_KEYS[1]]) as
      | (Omit<Partial<Settings>, 'mode'> & { mode?: string; highlight?: string })
      | undefined
    if (!old) return { ...DEFAULT_SETTINGS }
    const wasLabel = old.mode === 'label'
    const t = old.threshold ?? -1
    const h = old.highlightThreshold ?? 101
    const migrated = normalize({
      mode: wasLabel || old.mode !== 'hide' ? 'dim' : 'hide',
      source: old.source,
      threshold: wasLabel || t <= 0 ? OFF_FILTER : pctToPos(t, 'filter'),
      highlightThreshold: old.highlight === 'off' || h >= 100 ? OFF_HIGHLIGHT : pctToPos(h, 'highlight'),
    })
    // Persist once and retire the old keys so this doesn't re-run on every load
    void saveSettings(migrated).then(() => area().remove(OLD_KEYS)).catch(() => {})
    return migrated
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  const payload = { [KEY]: s, [STAMP]: Date.now() }
  // Local always (fast, never throttled); sync as well so other devices follow. Whichever is newer wins on load.
  await ext.storage.local.set(payload)
  if (ext.storage.sync) {
    try {
      await ext.storage.sync.set(payload)
    } catch (e) {
      console.warn('[SRO] settings sync write failed (kept locally)', e)
    }
  }
}

export function onSettingsChange(cb: (s: Settings) => void): void {
  ext.storage.onChanged.addListener((changes) => {
    const c = changes[KEY]
    if (c) cb(normalize(c.newValue as Partial<Settings> | undefined))
  })
}

type Judged = { score: number; pct: number | null } | null

/**
 * Steam-only comparison: is this game at or above the tier? Compares Steam's review_score, which
 * is what Steam's own "sort by reviews" does and respects its review-count rules.
 * Games Steam gives no score to (fewer than 10 reviews) return null.
 */
export function meetsBar(summary: Judged, pos: number): boolean | null {
  if (!summary || summary.score === 0) return null
  return summary.score >= Math.round(pos)
}

/** At the filter tier or lower? Parked lever filters nothing; unscored games are never filtered. */
export function isFiltered(summary: Judged, s: Settings): boolean {
  if (s.threshold <= OFF_FILTER) return false
  if (!summary || summary.score === 0) return false
  return summary.score <= s.threshold
}

/** At the highlight tier or higher? Parked lever highlights nothing. */
export function isHighlighted(summary: Judged, s: Settings): boolean {
  if (s.highlightThreshold >= OFF_HIGHLIGHT) return false
  return meetsBar(summary, s.highlightThreshold) === true
}

/** Top of the percent band a tier occupies (next tier with a higher band start, minus one). */
export function bandEndPct(score: number): number {
  const here = tierAt(score).pct
  const next = TIERS.find((t) => t.pct > here)
  return next ? next.pct - 1 : 100
}

/**
 * Keep the highlight tier strictly above the filter tier: both are inclusive, so a shared tier
 * would be filtered and could never show its outline. The lever the user moved wins and pushes the
 * other, into its parking gate if it runs out of ladder.
 */
export function reconcile(s: Settings, moved: 'filter' | 'highlight'): Settings {
  const filterOn = s.threshold > OFF_FILTER
  const highlightOn = s.highlightThreshold < OFF_HIGHLIGHT
  if (!filterOn || !highlightOn || s.highlightThreshold > s.threshold) return s
  return moved === 'filter'
    ? { ...s, highlightThreshold: Math.min(OFF_HIGHLIGHT, s.threshold + 1) }
    : { ...s, threshold: Math.max(OFF_FILTER, s.highlightThreshold - 1) }
}

/** Tone at a position (for colors): the tier at or just below it. */
export function tierFor(pos: number): Tier {
  return tierAt(Math.max(1, Math.floor(Math.min(9, pos))))
}
