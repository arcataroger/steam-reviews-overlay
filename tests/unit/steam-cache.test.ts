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
