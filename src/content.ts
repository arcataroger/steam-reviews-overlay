import css from './content.css?inline'
import { subscribe, formatTooltip, peekCached, setLanguage, toneFor, ingestSteamRequest, type ReviewSummary, type Score, stopSteam } from './steam'
import { seedFromSearchRows, seedFromInlineJson } from './seed'
import { detectLang, LANG_KEY, type LangInfo } from './lang'
import { toneColorAt } from './tonecolor'
import { t } from './i18n'

const ext: typeof chrome = (globalThis as any).browser ?? chrome
const lang: LangInfo = detectLang()

/**
 * After an extension reload/update Chrome keeps the old content-script instance alive (orphaned
 * from extension APIs but with live observers and timers). The new instance announces itself on
 * the page; the old one shuts down. `dead` short-circuits every callback of a retired instance.
 */
const TAKEOVER_EVENT = 'sro:takeover'
let dead = false
const alive = () => !dead && !!ext.runtime?.id
import { loadSettings, onSettingsChange, isFiltered, isHighlighted, DEFAULT_SETTINGS, type Settings } from './settings'

let settings: Settings = DEFAULT_SETTINGS

/** /app/N at the store root, or an event/news link /news/app/N (event tiles are game cards too).
 *  NOT /points/shop/app/N, community links and the like. Oversized containers that merely contain
 *  a news link are rejected by the height cap in findCard / revalidateCards. */
const APP_RE = /(?:^|store\.steampowered\.com)\/(?:news\/)?app\/(\d+)/
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
  '.game_area_purchase_game', // an app page's own purchase boxes (and their bundle-contents strips)
  '.sro-badge',
].join(',')

/** Capsules narrower than this have no room for a text label; they still get filtered/highlighted. */
const MIN_LABEL_WIDTH = 120

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

/** A card is never wider than Steam's content column; page-wide wrappers (hero carousel
 *  containers) must not be claimed as cards. */
const MAX_CARD_W = 1240 // page columns are 1300 wide: a container that wide is never a card
const MAX_CARD_H = 700
/** Page-level containers are never a card, however small they measure while still loading. */
const NEVER_CARD_SELECTOR =
  '.page_content, .page_content_ctn, #responsive_page_template_content, .responsive_page_content, main, [role="main"], ' +
  '.app_reviews_area, .game_page_autocollapse_ctn, .leftcol, .rightcol, .block, #game_area_reviews, ' + // app-page sections
  '.game_area_dlc_section, .game_area_dlc_list' // a DLC list with one row is still a list
const maxCardWidth = () => Math.min(MAX_CARD_W, window.innerWidth - 80)

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
  const link = card.matches('a[href]')
    ? (card as HTMLAnchorElement)
    : (card.querySelector<HTMLAnchorElement>('a[href]:has(img, video)') ?? card.querySelector<HTMLAnchorElement>('a[href*="/app/"]'))
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

const ART_SEL = 'img, picture, video, [style*="background-image"]'
/** Artwork on the element itself or inside it (event tiles paint their art as a background image). */
const hasArt = (el: HTMLElement) => el.matches(ART_SEL) || !!el.querySelector(ART_SEL)

/** Does `parent` hold, outside `tile`, another artwork-sized link to the same game? */
function hasSiblingTile(parent: HTMLElement, tile: HTMLElement, appid: number): boolean {
  const tr = tile.getBoundingClientRect()
  if (tr.width < 60 || tr.height < 40) return false
  for (const n of parent.querySelectorAll<HTMLElement>('a[href*="/app/"], [data-ds-appid]')) {
    if (tile.contains(n) || appIdOf(n) !== appid) continue
    const r = n.getBoundingClientRect()
    if (r.height < 40 || r.width < 60 || !hasArt(n)) continue
    // Repeated tiles look alike; a box-art capsule next to its own wide info panel does not
    if (Math.abs(r.width - tr.width) <= 0.25 * Math.max(r.width, tr.width) && Math.abs(r.height - tr.height) <= 0.25 * Math.max(r.height, tr.height)) return true
  }
  return false
}

/**
 * Walk up from a game link to the largest ancestor that still references only this
 * one game and isn't absurdly large. That ancestor is the "card".
 */
function findCard(start: HTMLElement, appid: number): HTMLElement | null {
  if (start.closest(EXCLUDE_SELECTOR)) return null
  let card: HTMLElement | null = null
  let el: HTMLElement | null = start
  let hops = 0
  while (el && el !== document.body && hops < 12) {
    const ids = appIdsWithin(el, 2)
    if (ids.size !== 1 || !ids.has(appid)) break
    const rect = el.getBoundingClientRect()
    // Height is capped for every candidate (a 4000px reviews container is never a card); the width
    // cap only applies when climbing, since a search row can be wider than a phone viewport.
    if (rect.height > MAX_CARD_H || el.matches(NEVER_CARD_SELECTOR)) break
    if (card && rect.width > maxCardWidth()) break
    // A row of tiles that all belong to the same game (three news posts about one title) is a group,
    // not a card: stop at the tile when the parent holds another artwork-bearing link to it.
    if (card && hasSiblingTile(el, card, appid)) break
    card = el
    el = el.parentElement
    hops++
  }
  return card
}

/** Text content of `el` ignoring anything inside our badges. */
function textOutsideBadges(el: HTMLElement): string {
  if (!el.querySelector(`.${BADGE_CLASS}`)) return (el.textContent ?? '').trim()
  let out = ''
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(`.${BADGE_CLASS}`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out += n.textContent
  return out.trim()
}

const SUMMARY_RE = /^\s*(Overwhelmingly |Very |Mostly )?(Positive|Negative|Mixed)\b/i

/** Steam's own textual review summary on the card (expanded sale cards, featured capsules), if any. */
function nativeSummaryEl(card: HTMLElement): HTMLElement | null {
  // Presence in the DOM is what matters: a hidden carousel slide's summary shows once the slide does.
  // Match structurally (Steam tags its summary with a tone class in every language) with the English
  // wording as a fallback.
  for (const el of card.querySelectorAll<HTMLElement>('[class*="review" i]:not(.sro-badge)')) {
    if (el.closest(`.${BADGE_CLASS}`) || invisibleText(el)) continue
    // Our own badge may sit inside Steam's slot (search rows): its wording must not count as Steam's
    const text = textOutsideBadges(el)
    if (!text) continue // icon-only summaries (search rows' thumbs) show no text: not a native label
    if (el.matches('.positive, .mixed, .negative') || el.querySelector(':scope > .positive, :scope > .mixed, :scope > .negative')) return el
    if (SUMMARY_RE.test(text)) return el
  }
  return null
}
const hasNativeSummary = (card: HTMLElement) => !!nativeSummaryEl(card)

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

/**
 * How to draw a highlight:
 *  card  – capsule that is mostly artwork, or a hero-sized card: faint glow behind it
 *  row   – compact listing row (search results, tab rows): crisp inset rectangle
 *  panel – tall card either stacked vertically with others (wings on the sides) or packed
 *          edge-to-edge in a carousel (wings top and bottom): adjacent rectangles would fuse
 */
/**
 * Would an underglow drawn OUTSIDE this card's box be cut off? Steam's carousels are clipping
 * strips whose slides sit flush against them, so a `card` glow there survives only in the gaps
 * between slides and reads as stray slivers instead of a halo. Such cards take the inset ring.
 */
function glowWouldClip(card: HTMLElement, r: DOMRect): boolean {
  let el = card.parentElement
  for (let i = 0; i < 6 && el && el !== document.body; i++, el = el.parentElement) {
    const cs = getComputedStyle(el)
    const clipsX = cs.overflowX !== 'visible'
    const clipsY = cs.overflowY !== 'visible'
    if (!clipsX && !clipsY) continue
    const q = el.getBoundingClientRect()
    if (!q.width || !q.height) continue
    if (clipsY && (r.top - q.top <= 4 || q.bottom - r.bottom <= 4)) return true
    if (clipsX && (r.left - q.left <= 4 || q.right - r.right <= 4)) return true
  }
  return false
}

function highlightShape(card: HTMLElement): { shape: 'card' | 'row' | 'panel'; axis?: 'x' | 'y' } {
  const r = card.getBoundingClientRect()
  if (!r.width || !r.height) return { shape: 'row' }
  const tall = r.height >= 160
  // Neighbours beside this card: edge-to-edge tiles (events carousels) get wings top/bottom whatever
  // the art; overlapping slides (hero carousels, peeking neighbours) are hero cards → underglow.
  if (tall) {
    for (const sib of [card.nextElementSibling, card.previousElementSibling]) {
      if (!(sib instanceof HTMLElement)) continue
      const q = sib.getBoundingClientRect()
      if (!q.width || !q.height) continue
      const beside = Math.abs(q.left - r.left) > Math.abs(q.top - r.top)
      const gap = q.left > r.left ? q.left - r.right : r.left - q.right
      if (beside && gap < -20) return { shape: 'card' }
      if (beside && gap >= 0 && gap < 12) return { shape: 'panel', axis: 'x' }
      break
    }
  }
  if (r.width >= 1100) return { shape: 'card' } // hero carousels: underglow
  // An underglow that a clipping ancestor would shave off is worse than no underglow: use the ring.
  if (glowWouldClip(card, r)) return { shape: 'row' }
  // The artwork's share of the card: <img>/<video>, or a background-image box (event tiles, some capsules)
  let imgArea = 0
  const arts = [...card.querySelectorAll<HTMLElement>('img, video, [style*="background-image"]')]
  if (card.matches('[style*="background-image"]')) arts.push(card)
  for (const img of arts) {
    const ir = img.getBoundingClientRect()
    imgArea = Math.max(imgArea, ir.width * ir.height)
  }
  if (imgArea / (r.width * r.height) > 0.5) return { shape: 'card' }
  if (!tall) return { shape: 'row' }
  // Tall text-heavy card: wings on the sides when stacked vertically; rectangle when spaced out beside others
  for (const sib of [card.nextElementSibling, card.previousElementSibling]) {
    if (!(sib instanceof HTMLElement)) continue
    const q = sib.getBoundingClientRect()
    if (!q.width || !q.height) continue
    const beside = Math.abs(q.left - r.left) > Math.abs(q.top - r.top)
    return beside ? { shape: 'row' } : { shape: 'panel', axis: 'y' }
  }
  return { shape: 'panel', axis: 'y' }
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
  // still get filtered/highlighted. They only get our label when the local and global labels
  // disagree: Steam shows one of them, and the other is what makes the filter make sense.
  const native = nativeSummaryEl(card)
  if (native) {
    const mismatch = summary.local && summary.global && summary.local.label !== summary.global.label
    if (!mismatch) return
    const badge = makeBadge(summary)
    badge.classList.add('sro-inline', 'sro-beside-native')
    const before = card.getBoundingClientRect()
    native.insertAdjacentElement('afterend', badge)
    const after = card.getBoundingClientRect()
    const br = badge.getBoundingClientRect()
    const clipped = !br.width || !within(br, after)
    if (clipped || Math.abs(after.width - before.width) > 1 || Math.abs(after.height - before.height) > 1 || obstaclesFor(card, badge).length) {
      badge.remove()
      badge.classList.remove('sro-inline', 'sro-beside-native')
      placeInCorner(card, badge, before)
    }
    return
  }
  const badge = makeBadge(summary)

  const slot = findReviewSlot(card)
  if (slot) {
    badge.classList.add('sro-slot')
    slot.appendChild(badge)
    return
  }

  // Hidden cards (display:none after a hide) can't be measured; revalidate/reapply will place the
  // badge once the card is visible again.
  if (!card.getClientRects().length) return
  // Tiny capsules (bundle-contents strips) have no room for text
  if (card.getBoundingClientRect().width < MIN_LABEL_WIDTH) return

  const price = findPriceEl(card)
  if (price) {
    // Measure the whole price block, not just the final-price line, so a lifted chip clears the
    // strikethrough/discount lines too.
    const priceBlock = price.closest<HTMLElement>('.discount_block, .discount_prices, .search_price_discount_combined') ?? price
    const before = card.getBoundingClientRect()
    const priceBefore = priceBlock.getBoundingClientRect()
    badge.classList.add('sro-inline')
    // If the price is the sole content of a flex/inline row, append inside it; else after it.
    const parent = price.parentElement
    if (parent && parent !== card && getComputedStyle(parent).display.includes('flex')) {
      parent.appendChild(badge)
    } else {
      price.insertAdjacentElement('afterend', badge)
    }
    const r = badge.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    const clipped = !r.width || !r.height || !within(r, cr) // any edge, incl. the left in a row-reverse price row
    // A badge must never change the card's size (capsules in carousels size themselves from the
    // price block, and an inline label there reflows the whole row). If it did, or got clipped,
    // take it out of the flow: an absolute chip just above the price bar instead.
    const pr = priceBlock.getBoundingClientRect()
    const resized =
      Math.abs(cr.width - before.width) > 1 ||
      Math.abs(cr.height - before.height) > 1 ||
      Math.abs(pr.width - priceBefore.width) > 1 ||
      Math.abs(pr.height - priceBefore.height) > 1
    // "Price-like" containers on the React store also hold release dates: never sit on text
    const collides = !clipped && !resized && obstaclesFor(card, badge).length > 0
    if (clipped || resized || collides) {
      badge.remove()
      badge.classList.remove('sro-inline')
      // The card and price rects are back to their pre-insertion values: no need to re-measure.
      placeInCorner(card, badge, before, priceBefore)
    }
  } else {
    placeInCorner(card, badge)
  }
}

/**
 * Rects of things inside the card that the badge must not cover: text leaves, small icons and
 * buttons. The card's own artwork and its clickable wrapper are NOT obstacles (a capsule label is
 * meant to sit over the art), so images/buttons larger than a third of the card are ignored.
 */
/** Steam leaves some captions in the layout with a fully transparent color (tooltip sources). */
function invisibleText(el: HTMLElement): boolean {
  const cs = getComputedStyle(el)
  return cs.visibility === 'hidden' || cs.opacity === '0' || /rgba\(\d+, \d+, \d+, 0\)$/.test(cs.color)
}

function obstaclesFor(card: HTMLElement, badge: HTMLElement): DOMRect[] {
  const br = badge.getBoundingClientRect()
  const cr = card.getBoundingClientRect()
  const cardArea = Math.max(1, cr.width * cr.height)
  const out: DOMRect[] = []
  // Touching counts as a collision too: keep a few pixels of air around text and icons
  const GAP = 4
  const hits = (er: DOMRect) => br.left < er.right + GAP && br.right > er.left - GAP && br.top < er.bottom + 1 && br.bottom > er.top - 1
  // Icons, buttons and small artwork: whole-tile art and wrappers are what a chip sits on, not obstacles
  for (const el of card.querySelectorAll<HTMLElement>('img, svg, video, button, [role="button"]')) {
    if (badge.contains(el) || el.classList.contains(ORBIT_CLASS)) continue
    const er = el.getBoundingClientRect()
    if (!er.width || !er.height) continue
    if ((er.width * er.height) / cardArea > 0.33) continue
    if (hits(er)) out.push(er)
  }
  // Text is measured node by node (a date line mixing bare text with spans is still text)
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || badge.contains(node)) continue
    if (node.parentElement && invisibleText(node.parentElement)) continue // laid out but not drawn
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const er of range.getClientRects()) {
      if (er.width && er.height && hits(er)) {
        out.push(er)
        break
      }
    }
  }
  return out
}

const within = (br: DOMRect, cr: DOMRect) => br.left >= cr.left - 2 && br.right <= cr.right + 2 && br.top >= cr.top - 2 && br.bottom <= cr.bottom + 2

/**
 * Our ring, wings and dim overlay are absolutely positioned pseudo-elements, and a corner chip is an
 * absolutely positioned child, so the card has to be a containing block. Only a statically
 * positioned card needs help: forcing `relative` on a card Steam made sticky/absolute/fixed would
 * move it. The flag is remembered so stripCard can undo exactly what we did.
 */
function ensureContainingBlock(card: HTMLElement) {
  if (card.dataset.sroPos) return
  if (getComputedStyle(card).position !== 'static') return
  card.style.position = 'relative'
  card.dataset.sroPos = '1'
}

/** Absolute chip in the card's lower-right corner, lifted above the price block when there is one. */
function placeInCorner(card: HTMLElement, badge: HTMLSpanElement, cardRect?: DOMRect, priceRect?: DOMRect) {
  badge.classList.add('sro-corner')
  ensureContainingBlock(card)
  card.appendChild(badge)
  const cr = cardRect ?? card.getBoundingClientRect()
  const bh = badge.offsetHeight
  const bw = badge.offsetWidth
  const apply = (pos: { bottom?: number; top?: number; right?: number; left?: number }) => {
    badge.style.bottom = pos.bottom !== undefined ? `${pos.bottom}px` : 'auto'
    badge.style.top = pos.top !== undefined ? `${pos.top}px` : 'auto'
    badge.style.right = pos.right !== undefined ? `${pos.right}px` : 'auto'
    badge.style.left = pos.left !== undefined ? `${pos.left}px` : 'auto'
  }
  const clear = () => {
    const br = badge.getBoundingClientRect()
    return within(br, cr) && obstaclesFor(card, badge).length === 0
  }
  // Candidate positions, best first: bottom-right lifted above the price block, bottom-right
  // lifted above whatever it hits, shifted left of it, then the other corners.
  const candidates: Array<() => void> = []
  if (priceRect) {
    const lift = Math.max(0, Math.round(cr.bottom - priceRect.top))
    if (lift > 0 && lift < cr.height - bh - 4) candidates.push(() => apply({ bottom: lift + 4, right: 4 }))
  }
  candidates.push(() => apply({ bottom: 4, right: 4 }))
  candidates.push(() => {
    apply({ bottom: 4, right: 4 })
    const obs = obstaclesFor(card, badge)
    if (!obs.length) return
    const minTop = Math.min(...obs.map((o) => o.top))
    const lift = Math.round(cr.bottom - minTop) + 4
    if (lift < cr.height - bh - 4) apply({ bottom: lift, right: 4 })
  })
  candidates.push(() => {
    apply({ bottom: 4, right: 4 })
    const obs = obstaclesFor(card, badge)
    if (!obs.length) return
    const minLeft = Math.min(...obs.map((o) => o.left))
    const shift = Math.round(cr.right - minLeft) + 6
    if (shift + bw < cr.width - 4) apply({ bottom: 4, right: shift })
  })
  candidates.push(() => apply({ top: 4, right: 4 }))
  for (const place of candidates) {
    place()
    if (clear()) return
  }
  badge.remove()
  badge.classList.remove('sro-corner')
  badge.style.cssText = ''
  // Last resort for dense rows (charts tables): inline right after the title text
  if (placeBesideTitle(card, badge, cr)) return
  // Nothing fits without covering something: no label beats an overlapping one
  badge.remove()
}

/** Inline after the card's title, when that leaves the card's size alone and covers nothing. */
function placeBesideTitle(card: HTMLElement, badge: HTMLSpanElement, cardRect: DOMRect): boolean {
  const leaves = [...card.querySelectorAll<HTMLElement>('*')].filter(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim().length >= 3 && el.getBoundingClientRect().width && !badge.contains(el),
  )
  // A named title wins; otherwise the largest-type text in the card (hashed React classes carry no hint)
  const title =
    leaves.find((el) => el.matches('.title, .tab_item_name, [class*="title" i], [class*="name" i]')) ??
    leaves.sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0]
  if (!title) return false
  badge.classList.add('sro-inline', 'sro-beside-title')
  title.insertAdjacentElement('afterend', badge)
  const after = card.getBoundingClientRect()
  const br = badge.getBoundingClientRect()
  const ok =
    br.width > 0 &&
    within(br, after) &&
    Math.abs(after.width - cardRect.width) <= 1 &&
    Math.abs(after.height - cardRect.height) <= 1 &&
    obstaclesFor(card, badge).length === 0
  if (!ok) {
    badge.remove()
    badge.classList.remove('sro-inline', 'sro-beside-title')
  }
  return ok
}

/* ---------- filtering (dim / hide) ---------- */

const hideTimers = new Map<HTMLElement, number>()
/** The freshest summary for a card (review data may have arrived since a deferred handler was armed). */
function latest(card: HTMLElement, fallback: ReviewSummary): ReviewSummary {
  const appid = cardsByAppId.get(card)
  return (appid && peekCached(appid)) || fallback
}
/** Cards kept dim (not hidden) because the keyboard is inside them; one focusout listener each. */
const focusWatched = new WeakSet<HTMLElement>()

/**
 * Overwhelmingly Positive orbit: a masked ring element whose inner layer rotates (a transform,
 * so it composites instead of repainting a gradient every frame). Paused while off-screen.
 */
const ORBIT_CLASS = 'sro-orbit'
const orbitVisibility = new IntersectionObserver((entries) => {
  for (const e of entries) (e.target as HTMLElement).classList.toggle('sro-orbit-paused', !e.isIntersecting)
})
function setOrbit(card: HTMLElement, on: boolean) {
  const existing = card.querySelector<HTMLElement>(`:scope > .${ORBIT_CLASS}`)
  if (!on) {
    if (existing) {
      orbitVisibility.unobserve(existing)
      existing.remove()
    }
    return
  }
  if (existing) return
  const ring = document.createElement('i')
  ring.className = ORBIT_CLASS
  ring.setAttribute('aria-hidden', 'true')
  ring.appendChild(document.createElement('i'))
  card.appendChild(ring)
  orbitVisibility.observe(ring)
}

/** Cards change size when a carousel reveals them; re-derive the highlight shape when that happens. */
const shapeWatcher = new ResizeObserver((entries) => {
  if (!alive()) return
  for (const e of entries) {
    const card = e.target as HTMLElement
    const appid = cardsByAppId.get(card)
    if (!appid || !card.isConnected) continue
    const r = card.getBoundingClientRect()
    // A container that grew past card size (a section filled in after we claimed it) is not a card;
    // growth without a DOM mutation never reaches the scanner, so release it here.
    if (r.height > MAX_CARD_H) {
      release(card)
      stripCard(card)
      scheduleScan(card)
      continue
    }
    const s = peekCached(appid)
    if (!s) continue
    // A lifted corner chip was measured against the old layout: re-place it. Otherwise re-derive the
    // shape and make sure the badge still matches (a slide that just became visible may need one).
    // Only act on a real size change (the observer also fires on observe())
    const size = `${Math.round(r.width)}x${Math.round(r.height)}`
    if (card.dataset.sroSize === size) continue
    const first = !card.dataset.sroSize
    card.dataset.sroSize = size
    applyFilter(card, s)
    // A corner chip was placed against the old layout: re-run the full placement (with its
    // candidates and guards) rather than adjusting it blindly.
    if (!first && card.querySelector(`:scope > .${BADGE_CLASS}.sro-corner`)) placeBadge(card, s)
    else if (appid) reconcileBadge(card, appid)
  }
})

function applyFilter(card: HTMLElement, summary: ReviewSummary) {
  const pick = chosen(summary)
  const filtered = isFiltered(pick, settings)
  // The highlight and dim decorations are absolutely positioned against the card.
  if (filtered || (pick && isHighlighted(pick, settings))) ensureContainingBlock(card)
  // Highlight in the game's OWN review color (Steam's tone for its tier), not the lever's.
  // Overwhelmingly Positive gets an extra, slow orbiting light.
  if (!filtered && pick && isHighlighted(pick, settings)) {
    card.dataset.sroHighlight = toneFor(pick.score)
    const r = card.getBoundingClientRect()
    if (r.width && r.height) {
      const hs = highlightShape(card)
      card.dataset.sroShape = hs.shape
      if (hs.axis) card.dataset.sroAxis = hs.axis
      else delete card.dataset.sroAxis
    } else {
      // Not laid out yet (hidden carousel slide): draw nothing until it has a size
      delete card.dataset.sroShape
      delete card.dataset.sroAxis
    }
    shapeWatcher.observe(card)
    card.style.setProperty('--sro-hl', toneColorAt(pick.score))
    if (pick.score === 9) card.dataset.sroOp = '1'
    else delete card.dataset.sroOp
    setOrbit(card, pick.score === 9)
  } else {
    delete card.dataset.sroHighlight
    delete card.dataset.sroOp
    delete card.dataset.sroShape
    delete card.dataset.sroAxis
    card.style.removeProperty('--sro-hl')
    setOrbit(card, false)
  }
  const want = filtered ? settings.mode : null
  const cur = card.dataset.sroFiltered
  // A hide already in progress keeps its timer; anything else cancels a pending one.
  if (want === 'hide' && (cur === 'hide' || (cur === 'hiding' && hideTimers.has(card)))) return
  const t = hideTimers.get(card)
  if (t) {
    clearTimeout(t)
    hideTimers.delete(card)
  }
  if (!want) {
    delete card.dataset.sroFiltered
    return
  }
  // Never collapse the element the keyboard is inside (focus would silently drop to <body>):
  // dim it for now; it hides on the next pass once focus has moved on.
  if (want === 'dim') {
    card.dataset.sroFiltered = 'dim'
    return
  }
  if (card.matches(':focus-within')) {
    card.dataset.sroFiltered = 'dim'
    if (!focusWatched.has(card)) {
      focusWatched.add(card)
      card.addEventListener('focusout', () => {
        focusWatched.delete(card)
        if (alive() && cardsByAppId.has(card)) applyFilter(card, latest(card, summary))
      }, { once: true })
    }
    return
  }
  // hide: fade out first, then display:none so the layout reflows
  card.dataset.sroFiltered = 'hiding'
  hideTimers.set(
    card,
    window.setTimeout(() => {
      hideTimers.delete(card)
      if (card.dataset.sroFiltered !== 'hiding' || !cardsByAppId.has(card)) return // released meanwhile
      // Focus arrived during the fade: keep the card in the layout (dimmed) rather than pull it
      // out from under the keyboard; applyFilter re-arms the hide once focus leaves.
      if (card.matches(':focus-within')) applyFilter(card, latest(card, summary))
      else card.dataset.sroFiltered = 'hide'
    }, 320),
  )
}

function reapplyFilters(rerender = false) {
  for (const [card, appid] of cardsByAppId) {
    const s = peekCached(appid)
    if (!s || !card.isConnected) continue
    if (rerender) {
      placeBadge(card, s)
      continue
    }
    applyFilter(card, s)
    // A card that was hidden when its data arrived has no badge yet; place it now that it can be measured
    if (card.dataset.sroFiltered !== 'hide' && !card.querySelector(`.${BADGE_CLASS}`) && !hasNativeSummary(card) && card.getClientRects().length) {
      placeBadge(card, s)
    }
  }
}

/* ---------- scanning & scheduling ---------- */

const cardsByAppId = new Map<HTMLElement, number>()
const unsubs = new WeakMap<HTMLElement, () => void>()

function release(card: HTMLElement) {
  const t = hideTimers.get(card)
  if (t) {
    clearTimeout(t) // a recycled node must not be collapsed by its previous occupant's fade
    hideTimers.delete(card)
  }
  shapeWatcher.unobserve(card)
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
    if (!alive() || !card.isConnected) return
    // Re-render only if something visible changed
    if (last && sameScore(last.global, s.global) && sameScore(last.local, s.local)) return
    last = s
    placeBadge(card, s)
  })
  unsubs.set(card, unsub)
}

/** Remove everything we put on a card (attributes, inline styles, badge, orbit). */
function stripCard(card: HTMLElement) {
  card.removeAttribute(CARD_ATTR)
  for (const k of ['sroTone', 'sroScore', 'sroFiltered', 'sroHighlight', 'sroOp', 'sroShape', 'sroAxis', 'sroSize']) delete card.dataset[k]
  card.style.removeProperty('--sro-hl')
  if (card.dataset.sroPos) {
    card.style.removeProperty('position')
    delete card.dataset.sroPos
  }
  card.querySelectorAll(`:scope > .${ORBIT_CLASS}`).forEach((n) => orbitVisibility.unobserve(n))
  card.querySelectorAll(`:scope > .${BADGE_CLASS}, .${BADGE_CLASS}, :scope > .${ORBIT_CLASS}`).forEach((n) => n.remove())
}

/** Make the card's badge match its current state: missing badge, or a plain label beside Steam's own text. */
function reconcileBadge(card: HTMLElement, appid: number) {
  if (card.dataset.sroFiltered === 'hide' || !card.getClientRects().length) return
  const cached = peekCached(appid)
  if (!cached) return
  const badge = card.querySelector<HTMLElement>(`.${BADGE_CLASS}`)
  const native = hasNativeSummary(card)
  // Beside Steam's own text a label is only due when local and global disagree: a re-render that
  // dropped that pair must bring it back too.
  const pairDue = !!(cached.local && cached.global && cached.local.label !== cached.global.label)
  const stale = (!badge && (!native || pairDue)) || (badge && native && !badge.classList.contains('sro-beside-native'))
  if (stale) placeBadge(card, cached)
  // The orbit ring is a real child, not a pseudo-element, so Steam's re-render can drop it while
  // the badge still looks right (or is deliberately absent beside Steam's own text). Put it back.
  if (card.dataset.sroOp && !card.querySelector(`:scope > .${ORBIT_CLASS}`)) setOrbit(card, true)
}

function revalidateCards() {
  for (const [card, appid] of cardsByAppId) {
    if (!card.isConnected) {
      release(card)
      stripCard(card) // a re-attached node must be claimable again
      continue
    }
    const ids = appIdsWithin(card, 2)
    // A container that grew past card size after we claimed it (lazy-loaded sections) is not a card
    const grown = card.getBoundingClientRect().height > MAX_CARD_H
    if (!grown && ids.size === 1 && ids.has(appid)) {
      // Steam re-renders capsule contents (hover microtrailers, rotating carousels), which can
      // drop our badge while the card itself survives. Put it back from cache.
      reconcileBadge(card, appid)
      continue
    }
    // The slot now shows a different game (recycled carousel node): drop everything we put on it
    release(card)
    stripCard(card)
  }
}

const replaceQueue = new Set<HTMLElement>()
let replaceTimer: number | undefined
function onAssetLoad(e: Event) {
  if (!alive() || !(e.target instanceof HTMLImageElement)) return
  const card = e.target.closest<HTMLElement>(`[${CARD_ATTR}]`)
  if (!card || !(card.querySelector(`:scope > .${BADGE_CLASS}.sro-corner`) || card.dataset.sroHighlight)) return
  replaceQueue.add(card)
  if (replaceTimer) return
  replaceTimer = window.setTimeout(() => {
    replaceTimer = undefined
    for (const c of replaceQueue) {
      const appid = cardsByAppId.get(c)
      const s = appid && c.isConnected ? peekCached(appid) : undefined
      if (!s) continue
      if (c.querySelector(`:scope > .${BADGE_CLASS}.sro-corner`)) placeBadge(c, s)
      // The highlight shape weighs the artwork's share of the card; an image that was still empty
      // when the shape was chosen (lazy carousel slide) can flip a capsule from ring to underglow.
      if (c.dataset.sroHighlight) applyFilter(c, s)
    }
    replaceQueue.clear()
  }, 150)
}

/** Re-run placement for every corner chip (text metrics changed under them). */
function replaceCornerChips() {
  if (!alive()) return
  for (const [card, appid] of cardsByAppId) {
    if (!card.isConnected || !card.querySelector(`:scope > .${BADGE_CLASS}.sro-corner`)) continue
    const s = peekCached(appid)
    if (s) placeBadge(card, s)
  }
}

let lastRevalidate = 0
function scan(root: ParentNode = document) {
  // Revalidation walks every tracked card; do it for full scans, and at most once a second otherwise
  if (root === document || Date.now() - lastRevalidate > 1000) {
    revalidateCards()
    lastRevalidate = Date.now()
  }
  // Something changed inside a card we already labelled: a corner chip measured against the old
  // content may now sit on text that arrived late, so place it again.
  const owner = root instanceof Element ? root.closest<HTMLElement>(`[${CARD_ATTR}]`) : null
  if (owner) {
    const appid = cardsByAppId.get(owner)
    // The mutated card may have been recycled to another game: check it now, not on the next sweep,
    // so a hide fade armed for the old occupant cannot collapse the new one.
    const ids = appid ? appIdsWithin(owner, 2) : new Set<number>()
    if (appid && (ids.size !== 1 || !ids.has(appid))) {
      release(owner)
      stripCard(owner)
    } else {
      const s = appid ? peekCached(appid) : undefined
      if (s && owner.querySelector(`:scope > .${BADGE_CLASS}.sro-corner`)) placeBadge(owner, s)
    }
  }
  seedFromSearchRows(root)
  // querySelectorAll never returns the root itself, and a mutation can hand us the card's own
  // anchor (search rows and capsules ARE the <a>): include it.
  const candidates = [...root.querySelectorAll<HTMLElement>('a[href*="/app/"], [data-ds-appid]')]
  if (root instanceof HTMLElement && root.matches('a[href*="/app/"], [data-ds-appid]')) candidates.unshift(root)
  for (const el of candidates) {
    const appid = appIdOf(el)
    if (!appid || appid === pageAppId) continue
    const owner = el.closest<HTMLElement>(`[${CARD_ATTR}]`)
    if (owner) {
      if (cardsByAppId.has(owner)) continue
      stripCard(owner) // left by a re-attached clone or a retired instance
    }
    if (el.closest(EXCLUDE_SELECTOR)) continue
    const card = findCard(el, appid)
    if (!card || card.hasAttribute(CARD_ATTR)) continue
    // Ignore invisible / zero-size things (hidden templates etc.) and plain prose links
    const r = card.getBoundingClientRect()
    if (r.width < 40 || r.height < 16) continue
    // Short and image-less is usually a prose link; a block-level row of a ranking list
    // (charts: "3  Halloween: The Game  1,251,033") is a card even so.
    if (r.height < 60 && !card.querySelector('img, picture, video') && !isTextRow(card, r)) continue
    if (linksToNonGame(card)) continue
    card.setAttribute(CARD_ATTR, String(appid))
    cardsByAppId.set(card, appid)
    shapeWatcher.observe(card) // catches a container that grows past card size after being claimed
    attach(card, appid)
  }
}

/** A wide block-level line with a short text (a list row), as opposed to an inline link in prose. */
function isTextRow(el: HTMLElement, r: DOMRect): boolean {
  if (r.width < 300) return false
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text || text.length > 80) return false
  const display = getComputedStyle(el).display
  return display !== 'inline' && display !== 'inline-block'
}

let scanTimer: number | undefined
const pendingRoots = new Set<ParentNode>()
let fullScanPending = false
function scheduleScan(root?: Element) {
  if (!alive()) return
  if (root) pendingRoots.add(root)
  else fullScanPending = true
  if (scanTimer) return
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined
    const roots = fullScanPending || pendingRoots.size > 24 ? [document] : [...pendingRoots]
    pendingRoots.clear()
    fullScanPending = false
    try {
      for (const r of roots) scan(r)
    } catch (e) {
      console.warn('[SRO] scan failed', e)
    }
  }, 250)
}

/** Remove badges and markers left by a previous instance of this script (extension reload/update). */
function clearPreviousInstance() {
  // Ask any older instance to stop first, then sweep what it left behind.
  document.dispatchEvent(new Event(TAKEOVER_EVENT))
  document.querySelectorAll(`.${BADGE_CLASS}, .${ORBIT_CLASS}`).forEach((n) => n.remove())
  for (const el of document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`)) stripCard(el)
  document.getElementById('sro-styles')?.remove()
}

function onRuntimeMessage(msg: { type?: string; url?: string }, sender: { id?: string; tab?: unknown }) {
  if (!alive()) return
  if (sender.id !== ext.runtime.id || sender.tab) return // only our background script
  if (msg?.type === 'sro:steam-getitems' && typeof msg.url === 'string') void ingestSteamRequest(msg.url)
}

function shutdown() {
  dead = true
  replaceQueue.clear()
  pendingRoots.clear()
  fullScanPending = false
  try {
    ext.runtime.onMessage.removeListener(onRuntimeMessage)
  } catch {
    /* runtime already gone after an extension reload */
  }
  stopSteam()
  mo?.disconnect()
  document.fonts?.removeEventListener('loadingdone', replaceCornerChips)
  document.removeEventListener('load', onAssetLoad, true)
  if (replaceTimer) clearTimeout(replaceTimer)
  shapeWatcher.disconnect()
  orbitVisibility.disconnect()
  if (scanTimer) clearTimeout(scanTimer)
  for (const t of hideTimers.values()) clearTimeout(t)
  hideTimers.clear()
  for (const card of [...cardsByAppId.keys()]) release(card)
}

let mo: MutationObserver | undefined

async function main() {
  clearPreviousInstance()
  document.addEventListener(TAKEOVER_EVENT, shutdown, { once: true })
  // Register early: Steam's own GetItems calls can complete before settings finish loading
  ext.runtime.onMessage.addListener(onRuntimeMessage)
  injectStyles()
  settings = await loadSettings()
  if (!alive()) return // a newer instance took over while settings were loading
  onSettingsChange((s) => {
    if (!alive()) return
    const sourceChanged = s.source !== settings.source
    settings = s
    reapplyFilters(sourceChanged)
  })
  setLanguage(lang.steam)
  void ext.storage.local.set({ [LANG_KEY]: lang }).catch(() => {})
  seedFromInlineJson()
  scan()
  mo = new MutationObserver((muts) => {
    if (!alive()) return
    for (const m of muts) {
      if (m.type === 'characterData') {
        // Text filled in after placement (a release date rendering late) can end up under a chip
        const owner = m.target.parentElement?.closest<HTMLElement>(`[${CARD_ATTR}]`)
        if (owner) scheduleScan(owner)
        continue
      }
      if (m.type !== 'childList' || !m.addedNodes.length) continue
      for (const n of m.addedNodes) {
        if (n.nodeType === 3) {
          // element.textContent = "..." adds a fresh text node rather than mutating one
          const owner = n.parentElement?.closest<HTMLElement>(`[${CARD_ATTR}]`)
          if (owner) scheduleScan(owner)
          continue
        }
        if (n.nodeType !== 1) continue
        const el = n as Element
        if (el.classList.contains(BADGE_CLASS) || el.classList.contains(ORBIT_CLASS)) continue // our own insertions
        scheduleScan(el)
      }
    }
  })
  mo.observe(document.body, { childList: true, characterData: true, subtree: true })
  // A web font arriving after placement reflows Steam's text without any DOM change or card
  // resize: a chip measured against fallback-font metrics can end up on a date that grew wider.
  document.fonts?.addEventListener('loadingdone', replaceCornerChips)
  // Likewise an image finishing its load can push a capsule's bottom bar down under a chip that
  // was placed while the image box was still empty (the card itself keeps its size).
  document.addEventListener('load', onAssetLoad, true)
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
