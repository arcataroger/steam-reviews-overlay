/** User settings shared between the popup and the content script. */

export type FilterMode = 'label' | 'dim' | 'hide'

export interface Settings {
  /** What to do with games whose positive-review percentage is below `threshold`. */
  mode: FilterMode
  /** 0-100. Games with (positive / total * 100) < threshold are filtered. */
  threshold: number
  /** Also filter games with no reviews at all. */
  includeUnreviewed: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'label',
  threshold: 40, // Mixed
  includeUnreviewed: false,
}

/**
 * Steam's named tiers and the minimum positive-% at which they start.
 * (Steam also requires review counts: e.g. Overwhelmingly needs 500+, Very needs 50+;
 * the label the store shows is authoritative — these are the % bands behind it.)
 */
export const SETPOINTS: { pct: number; name: string; tone: 'positive' | 'mixed' | 'negative' }[] = [
  { pct: 0, name: 'Negative', tone: 'negative' },
  { pct: 20, name: 'Mostly Negative', tone: 'negative' },
  { pct: 40, name: 'Mixed', tone: 'mixed' },
  { pct: 70, name: 'Mostly Positive', tone: 'positive' },
  { pct: 80, name: 'Very Positive', tone: 'positive' },
  { pct: 95, name: 'Overwhelmingly Positive', tone: 'positive' },
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

const KEY = 'sro:settings:v2'
const ext: typeof chrome = (globalThis as any).browser ?? chrome
const area = () => ext.storage.sync ?? ext.storage.local

function normalize(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  s.threshold = Math.min(100, Math.max(0, Math.round(Number(s.threshold) || 0)))
  return s
}

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await area().get(KEY)
    return normalize(res?.[KEY] as Partial<Settings> | undefined)
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

/** Positive percentage (0-100) for a game, or null if it has no reviews. */
export function positivePct(positive: number, total: number): number | null {
  if (!total) return null
  return (positive / total) * 100
}

/** Is a game below the user's bar? */
export function isFiltered(positive: number, total: number, s: Settings): boolean {
  if (s.mode === 'label') return false
  const pct = positivePct(positive, total)
  if (pct === null) return s.includeUnreviewed
  return pct < s.threshold
}
