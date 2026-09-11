/** Harvest review summaries Steam already rendered into the page, so those ids are never fetched. */

import { seed, LABEL_TO_SCORE } from './steam'

const TOOLTIP_RE = /^(.*?)<br>(\d+)% of the ([\d,]+) user reviews/i

/** Search result rows: <a class="search_result_row" data-ds-appid="N"> ... <span class="search_review_summary" data-tooltip-html="Very Positive<br>86% of the 2,655 user reviews ..."> */
export function seedFromSearchRows(root: ParentNode = document): number {
  let n = 0
  for (const span of root.querySelectorAll<HTMLElement>('.search_review_summary[data-tooltip-html]')) {
    const row = span.closest<HTMLElement>('[data-ds-appid]')
    const id = Number(row?.getAttribute('data-ds-appid'))
    if (!id || !/^\d+$/.test(String(id))) continue
    const html = span.getAttribute('data-tooltip-html') ?? ''
    const m = html.match(TOOLTIP_RE)
    if (!m) continue
    const label = m[1].trim()
    const score = LABEL_TO_SCORE[label.toLowerCase()] ?? 0
    seed({ appid: id, label, score, pct: Number(m[2]), count: Number(m[3].replace(/,/g, '')) })
    n++
  }
  return n
}

/**
 * Homepage / server-rendered React data: inline JSON containing
 * "appid":N ... "review_summary_filtered":{"cReviews":..,"reviewScore":8,"reviewSummaryDesc":"Very Positive","sReviewScoreTooltip":"81% of the 184,045 user reviews ..."}
 */
const BLOB_RE = /"appid":(\d+)[^{}]{0,600}?"review_summary_filtered":\{([^{}]*)\}/g

export function seedFromInlineJson(): number {
  let n = 0
  for (const script of document.querySelectorAll<HTMLScriptElement>('script:not([src])')) {
    const text = script.textContent
    if (!text || !text.includes('review_summary_filtered')) continue
    for (const m of text.matchAll(BLOB_RE)) {
      const appid = Number(m[1])
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(`{${m[2]}}`)
      } catch {
        continue
      }
      const score = Number(obj.reviewScore ?? 0)
      const count = Number(obj.cReviews ?? 0)
      const label = String(obj.reviewSummaryDesc ?? '') || (count ? `${count} user reviews` : 'No user reviews')
      const tip = String(obj.sReviewScoreTooltip ?? '')
      const pm = tip.match(/^(\d+)%/)
      const pct = score > 0 ? (pm ? Number(pm[1]) : null) : null
      seed({ appid, label, score, pct, count })
      n++
    }
  }
  return n
}
