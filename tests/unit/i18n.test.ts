import { describe, it, expect } from 'vitest'
import './setup'
import { t, tierName } from '../../src/i18n'
import { formatTooltip } from '../../src/steam'

describe('i18n fallback catalog', () => {
  it('substitutes placeholders in order', () => {
    expect(t('tooltip', 'All languages', 'Very Positive', 87, '1,234')).toBe(
      'All languages: Very Positive — 87% of the 1,234 user reviews are positive',
    )
  })
  it('names Steam tiers', () => {
    expect(tierName(5)).toBe('Mixed')
  })
  it('formats tooltips without a percent for unscored games', () => {
    expect(formatTooltip({ label: '3 user reviews', score: 0, pct: null, count: 3 }, 'All languages')).toBe('All languages: 3 user reviews')
  })
})
