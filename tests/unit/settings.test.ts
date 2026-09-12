// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import './setup'
import {
  meetsBar,
  isFiltered,
  isHighlighted,
  snapPosition,
  posToPct,
  pctToPos,
  TIERS,
  DEFAULT_SETTINGS,
  OFF_FILTER,
  OFF_HIGHLIGHT,
  reconcile,
  type Settings,
  mergeIncoming,
} from '../../src/settings'

const s = (over: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...over })
const game = (score: number, pct: number | null = null) => ({ score, pct })

describe('Steam tier ladder', () => {
  it('has all nine Steam labels in review_score order', () => {
    expect(TIERS.map((t) => t.score)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(TIERS[8].name).toBe('Overwhelmingly Positive')
    expect(TIERS[0].name).toBe('Overwhelmingly Negative')
  })

  it('maps tier positions to their band start', () => {
    expect(posToPct(5)).toBe(40)
    expect(posToPct(6)).toBe(70)
    expect(posToPct(9)).toBe(95)
  })

  it('always snaps to the nearest tier', () => {
    expect(snapPosition(5.05)).toBe(5)
    expect(snapPosition(5.5)).toBe(6)
    expect(snapPosition(7.4)).toBe(7)
    expect(snapPosition(7.6)).toBe(8)
    expect(snapPosition(0.2)).toBe(1)
    expect(snapPosition(12)).toBe(9)
  })
})

describe('meetsBar follows Steam, never our own math', () => {
  it('on a tier, compares Steam review_score (count rules included)', () => {
    // 96% with 300 reviews is "Very Positive" (8) on Steam: under an Overwhelmingly Positive bar
    expect(meetsBar(game(8, 96), 9)).toBe(false)
    expect(meetsBar(game(9, 96), 9)).toBe(true)
    // Positive (7) ranks under Very Positive (8)
    expect(meetsBar(game(7, 85), 8)).toBe(false)
    expect(meetsBar(game(8, 85), 8)).toBe(true)
    // Under Negative = Very/Overwhelmingly Negative
    expect(meetsBar(game(2, 10), 3)).toBe(false)
    expect(meetsBar(game(3, 10), 3)).toBe(true)
  })

  it('ignores percent entirely: only Steam’s tier counts', () => {
    expect(meetsBar(game(5, 69), 5)).toBe(true)
    expect(meetsBar(game(4, 39), 5)).toBe(false)
    expect(meetsBar(game(5, 40), 6)).toBe(false)
  })

  it('returns null for games Steam has not scored', () => {
    expect(meetsBar(game(0), 5)).toBeNull()
    expect(meetsBar(null, 5)).toBeNull()
  })
})

describe('filter and highlight', () => {
  it('parked levers do nothing', () => {
    expect(isFiltered(game(1, 5), s({ threshold: OFF_FILTER }))).toBe(false)
    expect(isHighlighted(game(9, 99), s({ highlightThreshold: OFF_HIGHLIGHT }))).toBe(false)
  })
  it('never filters unscored games (protects new releases)', () => {
    expect(isFiltered(game(0), s({ threshold: 9 }))).toBe(false)
  })
  it('filters at-or-below and highlights at-or-above (both inclusive)', () => {
    expect(isFiltered(game(4, 30), s({ threshold: 5 }))).toBe(true)
    expect(isFiltered(game(5, 50), s({ threshold: 5 }))).toBe(true) // Mixed itself is filtered at "Mixed"
    expect(isFiltered(game(6, 75), s({ threshold: 5 }))).toBe(false)
    expect(isHighlighted(game(8, 90), s({ highlightThreshold: 8 }))).toBe(true)
    expect(isHighlighted(game(7, 90), s({ highlightThreshold: 8 }))).toBe(false)
  })
})

describe('levers never invert or share a tier', () => {
  it('moving the filter up to or past the highlight pushes the highlight one tier above it', () => {
    expect(reconcile(s({ threshold: 8, highlightThreshold: 5 }), 'filter').highlightThreshold).toBe(9)
    expect(reconcile(s({ threshold: 5, highlightThreshold: 5 }), 'filter').highlightThreshold).toBe(6)
  })
  it('moving the highlight down to or past the filter pushes the filter one tier below it', () => {
    expect(reconcile(s({ threshold: 8, highlightThreshold: 5 }), 'highlight').threshold).toBe(4)
    expect(reconcile(s({ threshold: 5, highlightThreshold: 5 }), 'highlight').threshold).toBe(4)
  })
  it('pushes into the parking gate when out of ladder', () => {
    expect(reconcile(s({ threshold: 9, highlightThreshold: 9 }), 'filter').highlightThreshold).toBe(OFF_HIGHLIGHT)
    expect(reconcile(s({ threshold: 1, highlightThreshold: 1 }), 'highlight').threshold).toBe(OFF_FILTER)
  })
  it('leaves valid or parked states alone', () => {
    expect(reconcile(s({ threshold: 5, highlightThreshold: 8 }), 'filter')).toEqual(s({ threshold: 5, highlightThreshold: 8 }))
    expect(reconcile(s({ threshold: OFF_FILTER, highlightThreshold: 2 }), 'highlight').threshold).toBe(OFF_FILTER)
    expect(reconcile(s({ threshold: 8, highlightThreshold: OFF_HIGHLIGHT }), 'filter').highlightThreshold).toBe(OFF_HIGHLIGHT)
  })
})

describe('settings migration from the percent-based versions', () => {
  it('maps an old "under P%" filter to the tier just below the band starting at P (inclusive filter)', () => {
    expect(pctToPos(40, 'filter')).toBe(4) // under 40% → Mostly Negative and below
    expect(pctToPos(80, 'filter')).toBe(6) // under 80% → Mostly Positive and below
    expect(pctToPos(95, 'filter')).toBe(8)
    expect(pctToPos(0, 'filter')).toBe(OFF_FILTER)
    expect(pctToPos(-1, 'filter')).toBe(OFF_FILTER)
  })
  it('maps an old "at or above P%" highlight to the tier whose band starts at P', () => {
    expect(pctToPos(80, 'highlight')).toBe(7) // "at or above 80%" included Positive: lowest tier on a tie
    expect(pctToPos(95, 'highlight')).toBe(9)
    expect(pctToPos(50, 'highlight')).toBe(6) // between bands: next tier up
    expect(pctToPos(101, 'highlight')).toBe(OFF_HIGHLIGHT)
  })
})

describe('loaded settings never collide', () => {
  it('normalize reconciles a colliding pair (e.g. from a percent-era migration)', async () => {
    const { loadSettings } = await import('../../src/settings')
    // simulate a v3 store with "under 96%" + "at/above 97%": both map to tier 9
    const { storageStore } = await import('./setup')
    storageStore['sro:settings:v3'] = { mode: 'dim', threshold: 96, source: 'global', highlightThreshold: 97 }
    delete storageStore['sro:settings:v4']
    const s = await loadSettings()
    expect(s.threshold).toBe(9)
    expect(s.highlightThreshold).toBe(OFF_HIGHLIGHT) // pushed off the top rather than colliding
  })
})

describe('settings change events', () => {
  it('ignores an older save echoed after a newer one', async () => {
    const { onSettingsChange, saveSettings, DEFAULT_SETTINGS } = await import('../../src/settings')
    const listeners: Array<(c: Record<string, { newValue?: unknown }>) => void> = []
    ;(globalThis as any).chrome.storage.onChanged.addListener = (fn: (typeof listeners)[number]) => listeners.push(fn)
    const seen: number[] = []
    onSettingsChange((s) => seen.push(s.threshold))
    await saveSettings({ ...DEFAULT_SETTINGS, threshold: 3 })
    await saveSettings({ ...DEFAULT_SETTINGS, threshold: 5 })
    const fire = (threshold: number, stamp: number) => listeners.forEach((fn) => fn({ 'sro:settings:v4': { newValue: { ...DEFAULT_SETTINGS, threshold } }, 'sro:settings:v4:t': { newValue: stamp } }))
    const now = Date.now()
    fire(5, now + 10) // the newer save's local write
    fire(3, now - 10) // the older save's slower sync write landing late
    fire(7, now + 20) // a genuinely newer change from another device
    expect(seen).toEqual([5, 7])
  })

  it('a context that only loads settings still ignores echoes older than what it loaded', async () => {
    const { onSettingsChange, loadSettings, DEFAULT_SETTINGS } = await import('../../src/settings')
    const listeners: Array<(c: Record<string, { newValue?: unknown }>) => void> = []
    const store = (globalThis as any).chrome.storage
    store.onChanged.addListener = (fn: (typeof listeners)[number]) => listeners.push(fn)
    const stamp = Date.now() + 1000
    await store.local.set({ 'sro:settings:v4': { ...DEFAULT_SETTINGS, threshold: 6 }, 'sro:settings:v4:t': stamp })
    expect((await loadSettings()).threshold).toBe(6)
    const seen: number[] = []
    onSettingsChange((s) => seen.push(s.threshold))
    listeners.forEach((fn) => fn({ 'sro:settings:v4': { newValue: { ...DEFAULT_SETTINGS, threshold: 2 } }, 'sro:settings:v4:t': { newValue: stamp - 500 } }))
    expect(seen).toEqual([]) // the stale echo was dropped
  })
})

describe('an external settings change arriving mid-drag', () => {
  // Another popup window or a sync from another device can land while a lever is still being
  // dragged. Dropping it outright meant the drag's own save then wrote back the pre-change value
  // and silently undid the other edit; taking it outright would have yanked the lever from under
  // the user's cursor. Keep only the keys this window says it is changing.
  const base: Settings = { mode: 'dim', threshold: 3, source: 'global', highlightThreshold: 8 }

  it('keeps the dragged key and takes every other key from the incoming change', () => {
    const local = { ...base, threshold: 5 } // user has dragged the filter lever to 5, not yet saved
    const incoming = { ...base, threshold: 1, mode: 'hide' as const, source: 'local' as const }
    expect(mergeIncoming(incoming, local, ['threshold'], 'filter')).toEqual({ mode: 'hide', threshold: 5, source: 'local', highlightThreshold: 8 })
  })

  it('takes the incoming change whole when nothing local is unsaved', () => {
    const incoming = { ...base, threshold: 1 }
    expect(mergeIncoming(incoming, base, [], null)).toEqual(incoming)
  })

  it('keeps both keys when a lever push has moved two of them', () => {
    const local = { ...base, threshold: 8, highlightThreshold: 9 }
    const incoming = { ...base, mode: 'hide' as const }
    expect(mergeIncoming(incoming, local, ['threshold', 'highlightThreshold'], 'filter')).toEqual({ mode: 'hide', threshold: 8, source: 'global', highlightThreshold: 9 })
  })
})

describe('a second external change during the same drag', () => {
  // The dirty keys are stated by the caller, so folding one change in does not make every key it
  // touched look edited. Inferring them by diffing against a drag-start snapshot did exactly that,
  // and the next external change to such a key was dropped, then overwritten by the drag's flush.
  const start: Settings = { mode: 'dim', threshold: 3, source: 'global', highlightThreshold: 8 }

  it('lands, while the dragged key still holds', () => {
    const dragging = { ...start, threshold: 5 }
    const first = mergeIncoming({ ...start, mode: 'hide' }, dragging, ['threshold'], 'filter')
    expect(first.mode).toBe('hide')
    const stillDragging = { ...first, threshold: 6 }
    const second = mergeIncoming({ ...start, mode: 'dim', source: 'local' }, stillDragging, ['threshold'], 'filter')
    expect(second.mode).toBe('dim') // not stuck on the first change's value
    expect(second.source).toBe('local')
    expect(second.threshold).toBe(6) // the lever the user is holding is still theirs
  })

  it('holds the lever the user is dragging even after an overshoot pushed and released its sibling', () => {
    // Drag the filter up past the highlight (pushing it to 9), then correct back down to 4. The
    // highlight stays at 9 because the push is sticky, so the filter now matches where the drag
    // started and only the untouched lever looks different. Inferring dirtiness from that snapshot
    // handed the filter to the remote value and held the highlight the user never touched.
    const dragging = { ...start, threshold: 3, highlightThreshold: 9 }
    const merged = mergeIncoming({ ...start, threshold: 7, highlightThreshold: 8 }, dragging, ['threshold', 'highlightThreshold'], 'filter')
    expect(merged.threshold).toBe(3)
    expect(merged.highlightThreshold).toBe(9)
  })
})

describe('merging a drag with an external change to the other lever', () => {
  // Both sides are valid on their own, but one lever from each can still cross them. Here the user
  // is dragging the filter lever up in this window while another window drags the highlight lever
  // down; taking one from each left the highlight sitting below the filter, a state reconcile()
  // rules out everywhere else and the popup then renders as crossed levers.
  const base: Settings = { mode: 'dim', threshold: 3, source: 'global', highlightThreshold: 6 }

  it('pushes the untouched lever out of the way instead of crossing them', () => {
    const dragging = { ...base, threshold: 5 } // still valid here: 6 > 5
    const incoming = { ...base, highlightThreshold: 4 } // valid there: 4 > 3
    const merged = mergeIncoming(incoming, dragging, ['threshold'], 'filter')
    expect(merged.threshold).toBe(5) // the lever under the user's cursor is theirs
    expect(merged.highlightThreshold).toBeGreaterThan(merged.threshold)
  })

  it('pushes the filter down when the highlight is the lever being dragged', () => {
    const dragging = { ...base, highlightThreshold: 4 }
    const incoming = { ...base, threshold: 5 }
    const merged = mergeIncoming(incoming, dragging, ['highlightThreshold'], 'highlight')
    expect(merged.highlightThreshold).toBe(4)
    expect(merged.threshold).toBeLessThan(merged.highlightThreshold)
  })
})
