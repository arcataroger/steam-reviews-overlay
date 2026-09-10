/** User settings shared between the popup and the content script. */

export type FilterMode = 'label' | 'dim' | 'hide'

export interface Settings {
  /** What to do with games whose score is below `threshold`. */
  mode: FilterMode
  /** Steam review_score tier (1-9). Games with score < threshold are filtered. */
  threshold: number
  /** Also filter games with no / too few reviews (score 0). */
  includeUnreviewed: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'label',
  threshold: 5, // Mixed
  includeUnreviewed: false,
}

/** Steam's review_score tiers, index = score. */
export const TIERS = [
  'No user reviews',
  'Overwhelmingly Negative',
  'Very Negative',
  'Negative',
  'Mostly Negative',
  'Mixed',
  'Mostly Positive',
  'Positive',
  'Very Positive',
  'Overwhelmingly Positive',
] as const

const KEY = 'sro:settings:v1'
const ext: typeof chrome = (globalThis as any).browser ?? chrome
const area = () => ext.storage.sync ?? ext.storage.local

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await area().get(KEY)
    return { ...DEFAULT_SETTINGS, ...(res?.[KEY] ?? {}) }
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
    if (c) cb({ ...DEFAULT_SETTINGS, ...(c.newValue ?? {}) })
  })
}

/** Is a game with this score below the user's bar? */
export function isFiltered(score: number, s: Settings): boolean {
  if (s.mode === 'label') return false
  if (score === 0) return s.includeUnreviewed
  return score < s.threshold
}
