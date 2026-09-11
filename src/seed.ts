/** Harvest review summaries Steam already rendered into the page. */

import { seed, LABEL_TO_SCORE, type Score } from './steam'

const ext: typeof chrome | undefined = (globalThis as any).browser ?? (globalThis as any).chrome

/** First line of the tooltip is Steam's localized label; then "NN% of the 1,234 user reviews ..." in any language. */
const TOOLTIP_RE = /^(.*?)<br>[^<]*?(\d+)\s*%[^<\d]*?([\d][\d.,\s\u00a0]*)/i
const LANG_NOTE_RE = /written in your language|in your language/i

/** Map a Steam label to its 0-9 score: English wording, or the UI locale's tier names from the catalog. */
let localTierNames: Map<string, number> | null = null
function scoreForLabel(label: string): number | null {
  const en = LABEL_TO_SCORE[label.toLowerCase()]
  if (en) return en
  if (!localTierNames) {
    localTierNames = new Map()
    for (let i = 1; i <= 9; i++) {
      const name = ext?.i18n?.getMessage?.(`tier${i}`)
      if (name) localTierNames.set(name.toLowerCase(), i)
    }
  }
  return localTierNames.get(label.toLowerCase()) ?? null
}

/** Search rows: <span class="search_review_summary" data-tooltip-html="Very Positive<br>86% of the 2,655 user reviews ...[<br>...written in your language...]"> */
export function seedFromSearchRows(root: ParentNode = document): number {
  let n = 0
  for (const span of root.querySelectorAll<HTMLElement>('.search_review_summary[data-tooltip-html]')) {
    const row = span.closest<HTMLElement>('[data-ds-appid]')
    const idAttr = row?.getAttribute('data-ds-appid') ?? ''
    if (!/^\d+$/.test(idAttr)) continue
    const html = span.getAttribute('data-tooltip-html') ?? ''
    const m = html.match(TOOLTIP_RE)
    if (!m) continue
    const label = m[1].trim()
    const score = scoreForLabel(label)
    if (!score) continue // can't map this language's wording to a tier: leave it to the batch fetch
    const count = Number(m[3].replace(/[^\d]/g, ''))
    if (!count) continue
    seed(Number(idAttr), LANG_NOTE_RE.test(html) ? 'local' : 'global', { label, score, pct: Number(m[2]), count })
    n++
  }
  return n
}

/** Homepage inline JSON: "appid":N ... "review_summary_filtered":{"cReviews":..,"reviewScore":8,"reviewSummaryDesc":"Very Positive","sReviewScoreTooltip":"81% of the ..."} */
const BLOB_RE = /"appid":(\d+)[^{}]{0,600}?"review_summary_filtered":\{([^{}]*)\}/g

export function seedFromInlineJson(): number {
  let n = 0
  for (const script of document.querySelectorAll<HTMLScriptElement>('script:not([src])')) {
    const text = script.textContent
    if (!text || !text.includes('review_summary_filtered')) continue
    for (const m of text.matchAll(BLOB_RE)) {
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(`{${m[2]}}`)
      } catch {
        continue
      }
      const score = Number(obj.reviewScore ?? 0)
      const count = Number(obj.cReviews ?? 0)
      const pm = String(obj.sReviewScoreTooltip ?? '').match(/^(\d+)%/)
      seed(Number(m[1]), 'global', {
        label: String(obj.reviewSummaryDesc ?? '') || (count ? `${count} user reviews` : 'No user reviews'),
        score,
        pct: score > 0 && pm ? Number(pm[1]) : null,
        count,
      })
      n++
    }
  }
  return n
}
