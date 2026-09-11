import { describe, it, expect } from 'vitest'
import './setup'
import {
  meetsBar,
  isFiltered,
  isHighlighted,
  snapPosition,
  posToPct,
  hasPercentGap,
  TIERS,
  DEFAULT_SETTINGS,
  OFF_FILTER,
  OFF_HIGHLIGHT,
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

  it('only allows in-between positions where percent bands differ', () => {
    expect(hasPercentGap(1)).toBe(false) // Overwhelmingly Negative -> Very Negative (both 0-19%)
    expect(hasPercentGap(2)).toBe(false)
    expect(hasPercentGap(3)).toBe(true) // Negative 0% -> Mostly Negative 20%
    expect(hasPercentGap(4)).toBe(true) // 20 -> 40
    expect(hasPercentGap(5)).toBe(true) // 40 -> 70
    expect(hasPercentGap(6)).toBe(true) // 70 -> 80
    expect(hasPercentGap(7)).toBe(false) // Positive -> Very Positive (both 80%+)
    expect(hasPercentGap(8)).toBe(true) // 80 -> 95
  })

  it('interpolates percent between tiers', () => {
    expect(posToPct(5)).toBe(40)
    expect(posToPct(5.5)).toBe(55)
    expect(posToPct(8.5)).toBe(87.5)
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

  it('between tiers, compares Steam integer percent', () => {
    expect(meetsBar(game(5, 54), 5.5)).toBe(false) // 54 < 55
    expect(meetsBar(game(5, 55), 5.5)).toBe(true)
    expect(meetsBar(game(6, 70), 5.5)).toBe(true)
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
  it('filters below and highlights at/above', () => {
    expect(isFiltered(game(4, 30), s({ threshold: 5 }))).toBe(true)
    expect(isFiltered(game(5, 50), s({ threshold: 5 }))).toBe(false)
    expect(isHighlighted(game(8, 90), s({ highlightThreshold: 8 }))).toBe(true)
    expect(isHighlighted(game(7, 90), s({ highlightThreshold: 8 }))).toBe(false)
  })
})
