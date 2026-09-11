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
    expect(pctToPos(80, 'highlight')).toBe(8) // ties prefer the stronger tier
    expect(pctToPos(95, 'highlight')).toBe(9)
    expect(pctToPos(50, 'highlight')).toBe(6) // between bands: next tier up
    expect(pctToPos(101, 'highlight')).toBe(OFF_HIGHLIGHT)
  })
})
