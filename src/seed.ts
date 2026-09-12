/** Harvest review summaries Steam already rendered into the page. */

import { seed, LABEL_TO_SCORE, type Score } from './steam'

const ext: typeof chrome | undefined = (globalThis as any).browser ?? (globalThis as any).chrome

/** First line of the tooltip is Steam's localized label; then "NN% of the 1,234 user reviews ..." in any language. */
const TOOLTIP_RE = /^(.*?)<br>[^<]*?(\d+)\s*%[^<\d]*?([\d][\d.,\s\u00a0]*)/i
/** Steam appends its "calculated from reviews written in your language" note as a second paragraph
 *  (`<br><br>...`), in every language; the wording itself is localized, the structure is not. */
const LANG_NOTE_RE = /<br\s*\/?>\s*<br\s*\/?>\s*\S/i

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

/** Homepage inline JSON: "appid":N ... "review_summary":{...all languages...},"review_summary_filtered":{"cReviews":..,"reviewScore":8,"reviewSummaryDesc":"Very Positive","sReviewScoreTooltip":"81% of the ..."}
 *  Despite its name, `review_summary_filtered` is the *language-specific* summary (what GetItems
 *  calls summary_language_specific), and the plain `review_summary` is the all-languages one.
 *  Verified live: appid 275850's plain blob reads 313,738 in both English and German, while its
 *  filtered blob reads 184,373 in English and 10,204 in German. Seeding the filtered blob as
 *  'global' put a one-language count behind the all-languages label until the batch fetch landed.
 *  Each blob is paired with the nearest preceding "appid": a sibling object with its own braces sits
 *  between them, so the gap is not brace-free. */
const BLOB_RE = /"appid":(\d+)|"review_summary":\{([^{}]*)\}|"review_summary_filtered":\{([^{}]*)\}/g
const MAX_GAP = 4000 // characters between an appid and its summary; beyond that they are unrelated

export function seedFromInlineJson(): number {
  let n = 0
  for (const script of document.querySelectorAll<HTMLScriptElement>('script:not([src])')) {
    const text = script.textContent
    if (!text || !text.includes('review_summary')) continue
    let appid = 0
    let at = -1
    for (const m of text.matchAll(BLOB_RE)) {
      if (m[1]) {
        appid = Number(m[1])
        at = m.index
        continue
      }
      if (!appid || m.index - at > MAX_GAP) continue
      const local = m[3] !== undefined
      const id = appid
      if (local) appid = 0 // the filtered blob is the last of the pair, so it closes out this appid
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(`{${local ? m[3] : m[2]}}`)
      } catch {
        continue
      }
      const score = Number(obj.reviewScore ?? 0)
      const count = Number(obj.cReviews ?? 0)
      const pm = String(obj.sReviewScoreTooltip ?? '').match(/^(\d+)\s*%/) // "19 % der ..." in German
      seed(id, local ? 'local' : 'global', {
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
