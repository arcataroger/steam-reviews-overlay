// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { storageStore } from './setup'

const CACHE_KEY = 'sro:cache:v3'
const NEG_KEY = `${CACHE_KEY}:neg`

describe('persisted cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    for (const k of Object.keys(storageStore)) delete storageStore[k]
    vi.resetModules()
  })
  afterEach(() => vi.useRealTimers())

  it('keeps another tab’s long-lived skips when this tab persists', async () => {
    // Another tab already recorded a day-long "not a game" skip (hardware, Steam's own apps)
    const day = Date.now() + 20 * 60 * 60_000
    storageStore[NEG_KEY] = { '1675200': day }
    const { seed } = await import('../../src/steam')
    seed(620, 'global', { label: 'Overwhelmingly Positive', score: 9, pct: 98, count: 1000 })
    await vi.advanceTimersByTimeAsync(2500) // the persist is debounced
    expect(Object.keys((storageStore[CACHE_KEY] as Record<string, unknown>) ?? {})).toContain('620')
    expect(storageStore[NEG_KEY]).toEqual({ '1675200': day }) // not clobbered
  })

  it('drops skips that have expired', async () => {
    storageStore[NEG_KEY] = { '1675200': Date.now() - 1000 }
    const { seed } = await import('../../src/steam')
    seed(620, 'global', { label: 'Very Positive', score: 8, pct: 90, count: 500 })
    await vi.advanceTimersByTimeAsync(2500)
    expect(storageStore[NEG_KEY]).toEqual({})
  })
})

describe('cache load merges with page-seeded entries', () => {
  beforeEach(() => {
    for (const k of Object.keys(storageStore)) delete storageStore[k]
    vi.resetModules() // a fresh steam.ts, so `mem` starts empty like a new page load
  })

  it('fills the side the page could not seed from the stored cache', async () => {
    // The page shows only one side (a search row's own-language summary); the other side is known
    // from a previous visit. Loading must not drop it just because the appid is already in memory.
    const now = Date.now()
    storageStore[CACHE_KEY] = {
      '620': {
        appid: 620,
        global: { label: 'Overwhelmingly Positive', score: 9, pct: 98, count: 100000 },
        local: { label: 'Very Positive', score: 8, pct: 92, count: 900 },
        ts: now,
        expires: now + 60_000,
      },
    }
    const { seed, subscribe, peekCached } = await import('../../src/steam')
    seed(620, 'local', { label: 'Very Positive', score: 8, pct: 92, count: 900 })
    expect(peekCached(620)?.global).toBeNull() // only the page's side so far
    const seen: unknown[] = []
    subscribe(620, (s) => seen.push(s)) // subscribing is what triggers the persisted load
    await vi.waitFor(() => expect(peekCached(620)?.global?.label).toBe('Overwhelmingly Positive'))
    expect(peekCached(620)?.local?.label).toBe('Very Positive') // the page's side is untouched
    expect(seen.length).toBeGreaterThan(0) // subscribers are told about the restored side
  })
})
