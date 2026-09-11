import { describe, it, expect } from 'vitest'
import './setup'
import { bandEndPct, tierAt, posToPct, isFiltered, isHighlighted, DEFAULT_SETTINGS, OFF_FILTER, OFF_HIGHLIGHT, type Settings } from '../../src/settings'
import { toneColorAt, NEGATIVE, MIXED, POSITIVE } from '../../src/tonecolor'
import { langForLocale, flagFor, detectLang } from '../../src/lang'

const s = (over: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...over })

describe('popup readouts', () => {
  it('filter shows the top of the selected tier band (inclusive)', () => {
    expect(bandEndPct(5)).toBe(69) // Mixed 40–69
    expect(bandEndPct(6)).toBe(79) // Mostly Positive 70–79
    expect(bandEndPct(8)).toBe(94) // Very Positive: Overwhelmingly starts at 95
    expect(bandEndPct(7)).toBe(94) // Positive shares the 80%+ band
    expect(bandEndPct(9)).toBe(100)
    expect(bandEndPct(1)).toBe(19) // all three negatives share 0–19
  })
  it('highlight shows the band start', () => {
    expect(posToPct(7)).toBe(80)
    expect(posToPct(9)).toBe(95)
    expect(posToPct(5)).toBe(40)
  })
})

describe('highlight color is the game’s own tone', () => {
  it('maps Steam scores to Steam’s three colors exactly', () => {
    for (const sc of [1, 2, 3, 4]) expect(toneColorAt(sc)).toBe(NEGATIVE)
    expect(toneColorAt(5)).toBe(MIXED)
    for (const sc of [6, 7, 8, 9]) expect(toneColorAt(sc)).toBe(POSITIVE)
  })
  it('tier metadata is consistent with the ladder', () => {
    expect(tierAt(9).name).toBe('Overwhelmingly Positive')
    expect(tierAt(0).score).toBe(1) // clamped
    expect(tierAt(12).score).toBe(9)
  })
})

describe('filter/highlight interplay', () => {
  it('a filtered game is never highlighted (highlight is a separate check the UI gates on filter)', () => {
    const st = s({ threshold: 8, highlightThreshold: 9 })
    const g = { score: 8, pct: 90 }
    expect(isFiltered(g, st)).toBe(true)
    expect(isHighlighted(g, st)).toBe(false)
  })
  it('parked levers do nothing even at the extremes', () => {
    expect(isFiltered({ score: 1, pct: 5 }, s({ threshold: OFF_FILTER }))).toBe(false)
    expect(isHighlighted({ score: 9, pct: 99 }, s({ highlightThreshold: OFF_HIGHLIGHT }))).toBe(false)
  })
})

describe('locale → language/flag (popup QA override and My-language button)', () => {
  it('derives the Steam language and a flag from an extension locale code', () => {
    expect(langForLocale('de')).toMatchObject({ steam: 'german', flag: flagFor('DE') })
    expect(langForLocale('pt_BR')).toMatchObject({ steam: 'brazilian', flag: flagFor('BR') })
    expect(langForLocale('zh_CN').steam).toBe('schinese')
    expect(langForLocale('es_419')).toMatchObject({ steam: 'latam', flag: flagFor('MX') }) // 419 is not a country
    expect(langForLocale('xx').steam).toBe('english')
  })
  it('does not invent a region for a bare browser locale', () => {
    const g = globalThis as Record<string, unknown>
    const hadDoc = 'document' in g
    const orig = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const setNav = (language: string) => Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true })
    g.document = { cookie: 'Steam_Language=tchinese' }
    try {
      // Intl maximize() would turn "zh" into zh-Hans-CN; the language's own country wins
      setNav('zh')
      expect(detectLang()).toMatchObject({ steam: 'tchinese', flag: flagFor('TW') })
      setNav('zh-HK')
      expect(detectLang().flag).toBe(flagFor('HK')) // an explicit region still wins
    } finally {
      if (!hadDoc) delete g.document
      if (orig) Object.defineProperty(globalThis, 'navigator', orig)
    }
  })
  it('renders regional-indicator flags', () => {
    expect(flagFor('US')).toBe('🇺🇸')
    expect(flagFor('zz-bad')).toBe('🏳️')
  })
})
