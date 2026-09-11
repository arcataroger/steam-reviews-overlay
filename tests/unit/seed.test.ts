// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import './setup'
import { seedFromSearchRows, seedFromInlineJson } from '../../src/seed'
import { peekCached } from '../../src/steam'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('seeding from page data', () => {
  it('reads label, percent and count from search row tooltips, and tells local from global', () => {
    document.body.innerHTML = `
      <a class="search_result_row" data-ds-appid="111">
        <span class="search_review_summary positive" data-tooltip-html="Overwhelmingly Positive&lt;br&gt;97% of the 1,132 user reviews for this game are positive."></span>
      </a>
      <a class="search_result_row" data-ds-appid="222">
        <span class="search_review_summary positive" data-tooltip-html="Very Positive&lt;br&gt;84% of the 2,655 user reviews for this game are positive.&lt;br&gt;&lt;br&gt;The review score for this product is calculated from reviews written in your language based on your preferences."></span>
      </a>
      <a class="search_result_row" data-ds-appid="333,444"><span class="search_review_summary" data-tooltip-html="Mixed&lt;br&gt;50% of the 10 user reviews"></span></a>`
    expect(seedFromSearchRows()).toBe(2)
    expect(peekCached(111)?.global).toEqual({ label: 'Overwhelmingly Positive', score: 9, pct: 97, count: 1132 })
    expect(peekCached(111)?.local).toBeNull()
    expect(peekCached(222)?.local).toEqual({ label: 'Very Positive', score: 8, pct: 84, count: 2655 })
    expect(peekCached(222)?.global).toBeNull()
    expect(peekCached(333)).toBeUndefined() // bundle rows are skipped
  })

  it('reads the homepage review_summary_filtered blobs', () => {
    const script = document.createElement('script')
    script.textContent = `var x = {"appid":275850,"name":"NMS","review_summary_filtered":{"cReviews":184045,"cRecommendationsPositive":150893,"cRecommendationsNegative":33152,"reviewScore":8,"reviewSummaryDesc":"Very Positive","sReviewScoreTooltip":"81% of the 184,045 user reviews for this game are positive."}};`
    document.body.appendChild(script)
    expect(seedFromInlineJson()).toBe(1)
    expect(peekCached(275850)?.global).toEqual({ label: 'Very Positive', score: 8, pct: 81, count: 184045 })
  })
})
