import css from './content.css?inline'
import { subscribe, formatTooltip, peekCached, setLanguage, toneFor, ingestSteamRequest, type ReviewSummary, type Score } from './steam'
import { seedFromSearchRows, seedFromInlineJson } from './seed'
import { detectLang, LANG_KEY, type LangInfo } from './lang'
import { toneColorAt } from './tonecolor'
import { t } from './i18n'

const ext: typeof chrome = (globalThis as any).browser ?? chrome
const lang: LangInfo = detectLang()
import { loadSettings, onSettingsChange, isFiltered, isHighlighted, tierFor, DEFAULT_SETTINGS, type Settings } from './settings'

let settings: Settings = DEFAULT_SETTINGS

const APP_RE = /\/app\/(\d+)/
const CARD_ATTR = 'data-sro-card'
const BADGE_CLASS = 'sro-badge'

/** Containers that already show reviews or that we must never touch. */
const EXCLUDE_SELECTOR = [
  '#global_hover',
  '.hover_body',
  '#global_header',
  '#footer',
  '#search_suggestion_contents',
  '.search_results_filtered_warning',
  '.game_review_summary',
  '.sro-badge',
].join(',')

/** Price-ish elements, roughly ordered from most to least specific. */
const PRICE_SELECTORS = [
  '.discount_final_price',
  '.discount_block',
  '.search_price_discount_combined',
  '.search_price',
  '.tab_item_discount',
  '.game_purchase_price',
  '.discount_prices',
  '.price',
  '[class*="_StoreSalePriceBox_"]',
  '[class*="_StoreSalePriceWidgetContainer_"]',
  '[class*="PriceBox"]',
  '[class*="_Price_"]',
  '[class*="price"]',
  '[class*="Price"]',
]

const MAX_CARD_W = 1400
const MAX_CARD_H = 700

function injectStyles() {
  if (document.getElementById('sro-styles')) return
  const style = document.createElement('style')
  style.id = 'sro-styles'
  style.textContent = css
  document.documentElement.appendChild(style)
}

/** Cards whose own link goes to a sale/publisher/franchise page aren't a game, even if they carry an appid. */
const NON_GAME_LINK = /\/(sale|publisher|developer|franchise|curator|bundle|sub|dlc|news|category|genre|tags?)\//

function linksToNonGame(card: HTMLElement): boolean {
  const link = card.matches('a[href]') ? (card as HTMLAnchorElement) : card.querySelector<HTMLAnchorElement>('a[href]')
  const href = link?.getAttribute('href') ?? ''
  return !!href && !APP_RE.test(href) && NON_GAME_LINK.test(href)
}

/** The appid of the page itself (on /app/123/ pages) — already shows reviews; skip it. */
const pageAppId = (() => {
  const m = location.pathname.match(APP_RE)
  return m ? Number(m[1]) : null
})()

function appIdOf(el: Element): number | null {
  const ds = el.getAttribute('data-ds-appid')
  if (ds && /^\d+$/.test(ds)) return Number(ds)
  const href = (el as HTMLAnchorElement).getAttribute?.('href')
  if (href) {
    const m = href.match(APP_RE)
    if (m) return Number(m[1])
  }
  return null
}

/** Set of distinct appids referenced anywhere inside an element. */
function appIdsWithin(root: Element, limit = 3): Set<number> {
  const ids = new Set<number>()
  const self = appIdOf(root)
  if (self) ids.add(self)
  const nodes = root.querySelectorAll<HTMLElement>('a[href*="/app/"], [data-ds-appid]')
  for (const n of nodes) {
    const id = appIdOf(n)
    if (id) ids.add(id)
    if (ids.size >= limit) break
  }
  return ids
}

/**
 * Walk up from a game link to the largest ancestor that still references only this
 * one game and isn't absurdly large. That ancestor is the "card".
 */
function findCard(start: HTMLElement, appid: number): HTMLElement | null {
  let card: HTMLElement | null = null
  let el: HTMLElement | null = start
  let hops = 0
  while (el && el !== document.body && hops < 12) {
    if (el.matches(EXCLUDE_SELECTOR) || el.closest(EXCLUDE_SELECTOR)) return null
    const ids = appIdsWithin(el, 2)
    if (ids.size !== 1 || !ids.has(appid)) break
    const rect = el.getBoundingClientRect()
    if (rect.width > MAX_CARD_W || rect.height > MAX_CARD_H) break
    card = el
    el = el.parentElement
    hops++
  }
  return card
}

const SUMMARY_RE = /^\s*(Overwhelmingly |Very |Mostly )?(Positive|Negative|Mixed)\b/i

/** Does the card already show Steam's own textual review summary (e.g. expanded sale cards)? */
function hasNativeSummary(card: HTMLElement): boolean {
  for (const el of card.querySelectorAll<HTMLElement>('[class*="review" i]:not(.sro-badge)')) {
    if (SUMMARY_RE.test(el.textContent ?? '') && el.getClientRects().length) return true
  }
  return false
}

function findPriceEl(card: HTMLElement): HTMLElement | null {
  for (const sel of PRICE_SELECTORS) {
    const candidates = card.querySelectorAll<HTMLElement>(sel)
    for (const c of candidates) {
      if (c.closest(`.${BADGE_CLASS}`)) continue
      if (!c.textContent?.trim()) continue
      const rect = c.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      // Prefer the innermost priced element so we sit right next to the number
      let leaf: HTMLElement = c
      for (const s of PRICE_SELECTORS.slice(0, 6)) {
        const inner = c.querySelector<HTMLElement>(s)
        if (inner && inner !== c && inner.textContent?.trim()) {
          leaf = inner
          break
        }
      }
      return leaf
    }
  }
  return null
}

/** The score the filter (and the card's tone) should look at, per the user's setting. */
function chosen(summary: ReviewSummary): Score | null {
  return settings.source === 'local' ? (summary.local ?? summary.global) : (summary.global ?? summary.local)
}

function line(sc: Score, icon: string, scope: string, cls: string): HTMLSpanElement {
  const l = document.createElement('span')
  l.className = `sro-line ${cls} sro-${toneFor(sc.score)}`
  l.title = formatTooltip(sc, scope)
  if (icon) {
    const i = document.createElement('span')
    i.className = 'sro-ico'
    i.textContent = icon
    l.appendChild(i)
  }
  l.appendChild(document.createTextNode(sc.label || t('notEnoughReviews')))
  return l
}

function makeBadge(summary: ReviewSummary): HTMLSpanElement {
  const b = document.createElement('span')
  const pick = chosen(summary)
  b.className = `${BADGE_CLASS} sro-${toneFor(pick?.score ?? 0)}`
  b.dataset.sroAppid = String(summary.appid)
  if (pick) {
    b.dataset.sroScore = String(pick.score)
    if (pick.pct !== null) b.dataset.sroPct = String(pick.pct)
  }
  const { local, global } = summary
  if (local && global && local.label === global.label) {
    // Same label either way: one plain line, no icon. Tooltip still spells out both.
    const l = line(global, '', t('allLanguages'), 'sro-both')
    l.title = `${formatTooltip(local, lang.name)}\n${formatTooltip(global, t('allLanguages'))}`
    b.appendChild(l)
  } else if (local && global) {
    b.appendChild(line(local, lang.flag, lang.name, 'sro-local'))
    b.appendChild(line(global, '🌐', t('allLanguages'), 'sro-global'))
  } else if (global) {
    b.appendChild(line(global, '', t('allLanguages'), 'sro-global'))
  } else if (local) {
    b.appendChild(line(local, '', lang.name, 'sro-local'))
  }
  return b
}

/** Capsule (mostly artwork, overhanging tags, hover zoom) vs. row listing (small thumbnail beside text). */
function cardShape(card: HTMLElement): 'card' | 'row' {
  const r = card.getBoundingClientRect()
  if (!r.width || !r.height) return 'row'
  let imgArea = 0
  for (const img of card.querySelectorAll<HTMLElement>('img, video')) {
    const ir = img.getBoundingClientRect()
    imgArea = Math.max(imgArea, ir.width * ir.height)
  }
  return imgArea / (r.width * r.height) > 0.5 ? 'card' : 'row'
}

/** Where Steam already reserves a spot for reviews (search rows: the thumbs icon column), sit there. */
function findReviewSlot(card: HTMLElement): HTMLElement | null {
  const slot = card.querySelector<HTMLElement>('.search_reviewscore')
  if (slot && slot.getClientRects().length) return slot
  return null
}

function placeBadge(card: HTMLElement, summary: ReviewSummary) {
  if (!card.isConnected) return
  card.querySelectorAll(`.${BADGE_CLASS}`).forEach((n) => n.remove())
  const pick = chosen(summary)
  card.dataset.sroTone = toneFor(pick?.score ?? 0)
  card.dataset.sroScore = String(pick?.score ?? 0)
  applyFilter(card, summary)
  // Cards that already show Steam's own review text (featured capsules, expanded sale cards)
  // still get filtered/highlighted, just no second label.
  if (hasNativeSummary(card)) return
  const badge = makeBadge(summary)

  const slot = findReviewSlot(card)
  if (slot) {
    badge.classList.add('sro-slot')
    slot.appendChild(badge)
    return
  }

  const price = findPriceEl(card)
  if (price) {
    badge.classList.add('sro-inline')
    // If the price is the sole content of a flex/inline row, append inside it; else after it.
    const parent = price.parentElement
    if (parent && parent !== card && getComputedStyle(parent).display.includes('flex')) {
      parent.appendChild(badge)
    } else {
      price.insertAdjacentElement('afterend', badge)
    }
    // Fallback to corner if the inline badge got clipped/hidden
    const r = badge.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    if (r.width === 0 || r.right > cr.right + 2 || r.bottom > cr.bottom + 2 || r.top < cr.top - 2) {
      badge.remove()
      badge.classList.remove('sro-inline')
      placeInCorner(card, badge)
    }
  } else {
    placeInCorner(card, badge)
  }
}

function placeInCorner(card: HTMLElement, badge: HTMLSpanElement) {
  badge.classList.add('sro-corner')
  const cs = getComputedStyle(card)
  if (cs.position === 'static') card.style.position = 'relative'
  card.appendChild(badge)
}

/* ---------- filtering (dim / hide) ---------- */

const hideTimers = new WeakMap<HTMLElement, number>()

function applyFilter(card: HTMLElement, summary: ReviewSummary) {
  const pick = chosen(summary)
  const filtered = isFiltered(pick, settings)
  // Highlight in the game's OWN review color (Steam's tone for its tier), not the lever's.
  // Overwhelmingly Positive gets an extra, slow orbiting light.
  if (!filtered && pick && isHighlighted(pick, settings)) {
    card.dataset.sroHighlight = toneFor(pick.score)
    card.dataset.sroShape = cardShape(card)
    card.style.setProperty('--sro-hl', toneColorAt(pick.score))
    if (pick.score === 9) card.dataset.sroOp = '1'
    else delete card.dataset.sroOp
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative'
  } else {
    delete card.dataset.sroHighlight
    delete card.dataset.sroOp
    delete card.dataset.sroShape
    card.style.removeProperty('--sro-hl')
  }
  const want = filtered ? settings.mode : null
  const cur = card.dataset.sroFiltered
  const t = hideTimers.get(card)
  if (t) {
    clearTimeout(t)
    hideTimers.delete(card)
  }
  if (!want) {
    delete card.dataset.sroFiltered
    return
  }
  if (want === 'dim') {
    card.dataset.sroFiltered = 'dim'
    return
  }
  // hide: fade out first, then display:none so the layout reflows
  if (cur === 'hide' || cur === 'hiding') return
  card.dataset.sroFiltered = 'hiding'
  hideTimers.set(
    card,
    window.setTimeout(() => {
      hideTimers.delete(card)
      if (card.dataset.sroFiltered === 'hiding') card.dataset.sroFiltered = 'hide'
    }, 320),
  )
}

function reapplyFilters(rerender = false) {
  for (const [card, appid] of cardsByAppId) {
    const s = peekCached(appid)
    if (!s || !card.isConnected) continue
    if (rerender) placeBadge(card, s)
    else applyFilter(card, s)
  }
}

/* ---------- scanning & scheduling ---------- */

const cardsByAppId = new Map<HTMLElement, number>()
const unsubs = new WeakMap<HTMLElement, () => void>()

function release(card: HTMLElement) {
  unsubs.get(card)?.()
  unsubs.delete(card)
  cardsByAppId.delete(card)
}

function sameScore(a: Score | null, b: Score | null): boolean {
  if (!a || !b) return a === b
  return a.label === b.label && a.pct === b.pct && a.count === b.count
}

function attach(card: HTMLElement, appid: number) {
  let last: ReviewSummary | undefined
  const unsub = subscribe(appid, (s) => {
    if (!card.isConnected) return
    // Re-render only if something visible changed
    if (last && sameScore(last.global, s.global) && sameScore(last.local, s.local)) return
    last = s
    placeBadge(card, s)
  })
  unsubs.set(card, unsub)
}

function revalidateCards() {
  for (const [card, appid] of cardsByAppId) {
    if (!card.isConnected) {
      release(card)
      continue
    }
    const ids = appIdsWithin(card, 2)
    if (ids.size === 1 && ids.has(appid)) {
      // Steam re-renders capsule contents (hover microtrailers, rotating carousels), which can
      // drop our badge while the card itself survives. Put it back from cache.
      if (!card.querySelector(`.${BADGE_CLASS}`) && !hasNativeSummary(card)) {
        const cached = peekCached(appid)
        if (cached) placeBadge(card, cached)
      }
      continue
    }
    release(card)
    card.removeAttribute(CARD_ATTR)
    delete card.dataset.sroTone
    delete card.dataset.sroScore
    delete card.dataset.sroFiltered
    delete card.dataset.sroHighlight
    delete card.dataset.sroOp
    card.style.removeProperty('--sro-hl')
    card.querySelectorAll(`:scope > .${BADGE_CLASS}, .${BADGE_CLASS}[data-sro-appid="${appid}"]`).forEach((n) => n.remove())
  }
}

function scan(root: ParentNode = document) {
  revalidateCards()
  seedFromSearchRows(root)
  const candidates = root.querySelectorAll<HTMLElement>('a[href*="/app/"], [data-ds-appid]')
  for (const el of candidates) {
    const appid = appIdOf(el)
    if (!appid || appid === pageAppId) continue
    if (el.closest(`[${CARD_ATTR}]`)) continue
    if (el.closest(EXCLUDE_SELECTOR)) continue
    const card = findCard(el, appid)
    if (!card || card.hasAttribute(CARD_ATTR)) continue
    // Ignore invisible / zero-size things (hidden templates etc.) and plain prose links
    const r = card.getBoundingClientRect()
    if (r.width < 40 || r.height < 16) continue
    if (r.height < 60 && !card.querySelector('img, picture, video')) continue
    if (linksToNonGame(card)) continue
    card.setAttribute(CARD_ATTR, String(appid))
    cardsByAppId.set(card, appid)
    attach(card, appid)
  }
}

let scanTimer: number | undefined
function scheduleScan() {
  if (scanTimer) return
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined
    try {
      scan()
    } catch (e) {
      console.warn('[SRO] scan failed', e)
    }
  }, 250)
}

/** Remove badges and markers left by a previous instance of this script (extension reload/update). */
function clearPreviousInstance() {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((n) => n.remove())
  for (const el of document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`)) {
    el.removeAttribute(CARD_ATTR)
    delete el.dataset.sroTone
    delete el.dataset.sroScore
    delete el.dataset.sroFiltered
    delete el.dataset.sroHighlight
    delete el.dataset.sroOp
    delete el.dataset.sroShape
    el.style.removeProperty('--sro-hl')
  }
  document.getElementById('sro-styles')?.remove()
}

async function main() {
  clearPreviousInstance()
  injectStyles()
  settings = await loadSettings()
  onSettingsChange((s) => {
    const sourceChanged = s.source !== settings.source
    settings = s
    reapplyFilters(sourceChanged)
  })
  setLanguage(lang.steam)
  ext.runtime.onMessage.addListener((msg: { type?: string; url?: string }) => {
    if (msg?.type === 'sro:steam-getitems' && msg.url) void ingestSteamRequest(msg.url)
  })
  void ext.storage.local.set({ [LANG_KEY]: lang }).catch(() => {})
  seedFromInlineJson()
  scan()
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList' && m.addedNodes.length) {
        // Ignore our own badge insertions
        let relevant = false
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && !(n as Element).classList.contains(BADGE_CLASS)) {
            relevant = true
            break
          }
        }
        if (relevant) {
          scheduleScan()
          return
        }
      }
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })
}

function start() {
  // Never let the overlay break the store page: any unexpected failure just means no badges.
  main().catch((e) => console.warn('[SRO] overlay failed to start', e))
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
