import css from './content.css?inline'
import { subscribe, formatTooltip, peekCached, setLanguage, toneFor, ingestSteamRequest, type ReviewSummary, type Score, stopSteam } from './steam'
import { seedFromSearchRows, seedFromInlineJson } from './seed'
import { detectLang, LANG_KEY, type LangInfo } from './lang'
import { toneColorAt } from './tonecolor'
import { thumbIcons } from './thumb'
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
/**
 * "Since you wish for <a>Other Game</a>": the logged-in home page's recommendation blocks name the
 * game that prompted them. That link is prose about another game, never a card, and it must not count
 * as a second game in the block, or the block splits into a title strip labelled with the other game's
 * score, a button bar and an unlabelled capsule.
 */
const REASON_SELECTOR = '.home_content_reason'

const EXCLUDE_SELECTOR = [
  '#global_hover',
  '.hover_body',
  '#global_header',
  '#footer',
  '#search_suggestion_contents',
  '.search_results_filtered_warning',
  '.game_review_summary',
  '.game_area_purchase_game', // an app page's own purchase boxes (and their bundle-contents strips)
  REASON_SELECTOR,
  '.sro-badge',
].join(',')

/** Capsules narrower than this have no room for a text label; they still get filtered/highlighted. */
const MIN_LABEL_WIDTH = 120
/** Below these, words have no chance whatever the language. Thumbs are the last resort. */
const MIN_WORDS_WIDTH = 130
const MIN_WORDS_HEIGHT = 30

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

/**
 * Steam's main content-hub carousel rotates a different game through one viewport every few
 * seconds, and only the current slide is in the DOM. The viewport therefore looks like a single
 * game's card, and took a 1200x541 ring around the whole widget: the video controls, the
 * auto-advance bar, and the pagination for twelve OTHER games. The slide is the card, so the climb
 * stops on the way into one of these rather than at the top of it.
 */
const ROTATING_CAROUSEL = '.contenthubmaincarousel'
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
    if (n.closest(REASON_SELECTOR)) continue
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
 * Does `parent` hold, outside `tile`, a tile for something else: an artwork-bearing link that goes
 * anywhere but this game? A package, a bundle, a sale page or a franchise hub has its own store page,
 * so a box holding one beside our game is a shelf, not that game's card. The rule names no link
 * types on purpose: each one Steam added (packages, then the home page's "Today's Deal" panel that
 * stacks a game tile on a sale tile) broke a list of them. Links to other games already stop the
 * climb through appIdsWithin, links to this game are sibling tiles (hasSiblingTile), and in-page
 * links (`#`, `javascript:`) open viewers rather than products.
 */
function hasOtherProductTile(parent: HTMLElement, tile: HTMLElement, appid: number): boolean {
  for (const n of parent.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (tile.contains(n) || n.closest(REASON_SELECTOR)) continue
    const href = n.getAttribute('href') ?? ''
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue
    if (appIdOf(n) === appid) continue
    const r = n.getBoundingClientRect()
    // Same bar as a sibling game tile: a small "add to cart" link is not another product's capsule
    if (r.height < 40 || r.width < 60 || !hasArt(n)) continue
    return true
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
    // The slide, not the viewport that rotates other games through it.
    if (card && el.closest(ROTATING_CAROUSEL)) break
    // Only `/app/` links count towards `appIdsWithin`, so a column pairing a game capsule with a
    // package capsule looked like one game and the whole column became the card: on the homepage
    // the Death Stranding capsule's ring wrapped an unrelated package's capsule below it.
    if (card && hasOtherProductTile(el, card, appid)) break
    // A calendar day holding one game is that game plus a date and empty space: the tile is the card
    if (card && isMostlyEmptyWrapper(el, card, rect)) break
    card = el
    el = el.parentElement
    hops++
  }
  return card
}

/** Does `outer` only add a short heading above `inner`, at about the same width? */
function isMostlyEmptyWrapper(outer: HTMLElement, inner: HTMLElement, r: DOMRect): boolean {
  const q = inner.getBoundingClientRect()
  if (r.height < q.height * 1.15 || r.width >= q.width * 1.3) return false
  if (textOutsideBadges(outer).length - textOutsideBadges(inner).length >= 25) return false
  // A price or title beside or below the tile belongs to the card; a date above it does not
  return ![...outer.children].some(
    (k) => !k.contains(inner) && !k.classList.contains(BADGE_CLASS) && k.textContent?.trim() && k.getBoundingClientRect().bottom > q.top,
  )
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
  // Steam's own English label doesn't drop the plural for a single review
  l.appendChild(document.createTextNode(sc.label?.replace(/^1 user reviews$/, '1 user review') || t('notEnoughReviews')))
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
 * Every highlight draws the same closed ring. The shape survives for custom styles and the harness:
 *  card – capsule that is mostly artwork, or a hero-sized card
 *  row  – everything else
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

/** The home page's stacked recommendation panels, each an empty band above its content box. */
const STACKED_PANEL = '.home_content_single_ctn'

/**
 * The box a card's frame and dim overlay should cover, when that is not the card itself.
 *  - Stacked panels butt against each other, so a frame round the whole card touches the next one.
 *    Framing the content box leaves the empty band above it as a gap.
 *  - A rotating hero's card is only the capsule link: the slide is the video and details beside it
 *    too. Steam recycles those nodes, so the claim stays on the link and the frame reaches out.
 */
function frameBox(card: HTMLElement): Element | null {
  if (isTableRow(card)) return null
  // An app page's "Similar to games you've played": one small capsule in a wide row
  if (card.matches('.similar_recent_apps_container')) return card.querySelector(':scope > .similarapp')
  // A curator's review card: the game is the capsule, and the review below runs to the card's edge
  if (card.querySelector(':scope > .review_direction')) return card.querySelector(':scope > a.store_capsule')
  if (card.matches(STACKED_PANEL)) return card.querySelector(':scope > .home_content')
  if (card.closest(ROTATING_CAROUSEL)) {
    for (let el = card.parentElement; el; el = el.parentElement) {
      if (el.querySelector(':scope > .AppVideoCtn')) return el
      if (el.matches(ROTATING_CAROUSEL)) break
    }
  }
  return innerTile(card)
}

/**
 * Many cards are padded slots, or a heading over the tile a reader sees. A frame on the slot floats
 * in the gutter, and a carousel can clip its bottom edge. Walk down to the box that still holds the
 * artwork and nearly all the words. A box of artwork alone is not the tile: its price strip is left out.
 */
function innerTile(card: HTMLElement): Element | null {
  const art = largestArt(card)
  if (!art) return null
  const cr = card.getBoundingClientRect()
  const words = (el: Element) => (el.textContent ?? '').length
  const area = (q: DOMRect) => q.width * q.height
  const ours = (el: Element) => el.classList.contains(BADGE_CLASS) || el.classList.contains(ORBIT_CLASS)
  const midX = art.left + art.width / 2
  const midY = art.top + art.height / 2
  let tile: Element = card
  for (let depth = 0; depth < 4; depth++) {
    const next = [...tile.children].find((k) => {
      if (ours(k)) return false
      const q = k.getBoundingClientRect()
      return midX > q.left && midX < q.right && midY > q.top && midY < q.bottom && area(q) >= 0.55 * area(cr) && words(k) >= 0.6 * words(card)
    })
    if (!next) break
    tile = next
  }
  if (tile === card) return null
  const q = tile.getBoundingClientRect()
  return q.left - cr.left >= 3 || cr.right - q.right >= 3 || q.top - cr.top >= 3 || cr.bottom - q.bottom >= 3 ? tile : null
}

const FRAME_SIDES = ['top', 'right', 'bottom', 'left'] as const

/** Point the frame and dim at frameBox, as offsets from the card's own edges (negative reaches outside it). */
function setFrame(card: HTMLElement) {
  const box = frameBox(card)?.getBoundingClientRect()
  const r = card.getBoundingClientRect()
  const offsets = box && { top: box.top - r.top, right: r.right - box.right, bottom: r.bottom - box.bottom, left: box.left - r.left }
  for (const side of FRAME_SIDES) {
    if (offsets) card.style.setProperty(`--sro-frame-${side}`, `${Math.round(offsets[side])}px`)
    else card.style.removeProperty(`--sro-frame-${side}`)
  }
}

function clearFrame(card: HTMLElement) {
  for (const side of FRAME_SIDES) card.style.removeProperty(`--sro-frame-${side}`)
}

/**
 * Steam floats small controls over a card's edge from outside it: the calendar's "+3 More" sits on a
 * day's last tile with no z-index, so our frame, label and dim overlay all paint over it. Lift any
 * such control above them. It is Steam's own control, so it keeps working and only its order changes.
 */
function raiseOverhangs(card: HTMLElement) {
  const r = card.getBoundingClientRect()
  let inside: Element = card
  for (let el = card.parentElement, i = 0; el && i < 4; inside = el, el = el.parentElement, i++) {
    for (const other of el.children) {
      if (other === inside || !(other instanceof HTMLElement) || other.dataset.sroRaised) continue
      if (getComputedStyle(other).position !== 'absolute') continue
      const q = other.getBoundingClientRect()
      const small = q.width * q.height < 0.25 * r.width * r.height
      if (small && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) {
        other.dataset.sroRaised = '1'
        other.style.zIndex = '32' // above the dim overlay (30) and a dimmed label (31)
      }
    }
  }
}

/**
 * "DLC For <game>": a short strip under a DLC tile, naming the base game. The reader already owns
 * that game and the tile above is the product, so the strip is context and gets no treatment. Matched
 * by shape, because its classes are hashed and its words are translated.
 */
function isBaseGameStrip(card: HTMLElement, r: DOMRect, appid: number): boolean {
  const tile = card.previousElementSibling
  if (!(tile instanceof HTMLElement) || r.height >= 70) return false
  const q = tile.getBoundingClientRect()
  const directlyBelow = r.top >= q.bottom - 4 && r.top - q.bottom < 24
  const ids = appIdsWithin(tile, 2)
  return directlyBelow && q.height >= r.height * 2 && ids.size > 0 && !ids.has(appid)
}

const isTableRow = (card: HTMLElement) => card.tagName === 'TR'

/**
 * Where a card's absolutely positioned decorations go. Never straight into a <tr>: Firefox gives
 * such a child an anonymous cell, which pushes that row's cells along a column, so the charts' rows
 * stopped lining up. Inside a static cell they still position against the row.
 */
function decorationHost(card: HTMLElement): HTMLElement {
  return (isTableRow(card) && card.querySelector<HTMLElement>(':scope > td')) || card
}

function highlightShape(card: HTMLElement): 'card' | 'row' {
  const r = card.getBoundingClientRect()
  if (!r.width || !r.height || isTableRow(card)) return 'row'
  // Its glow would hang off the card's top, a band away from a frame that starts lower down
  if (card.matches(STACKED_PANEL)) return 'row'
  // A slide inside the rotating content-hub carousel sits flush against the widget's own furniture:
  // the video on one side, the info panel on the other, the clipping viewport around all of it.
  if (card.closest(ROTATING_CAROUSEL)) return 'row'
  // Neighbours beside a tall card: overlapping slides (hero carousels, peeking neighbours) are hero
  // cards; tiles packed side by side leave no room for a glow. Steam's 12px grid gap measures
  // anywhere around 12 at fractional zoom, so the bound sits clear of it: one row must not mix looks.
  if (r.height >= 160) {
    for (const sib of [card.nextElementSibling, card.previousElementSibling]) {
      if (!(sib instanceof HTMLElement)) continue
      const q = sib.getBoundingClientRect()
      if (!q.width || !q.height) continue
      const beside = Math.abs(q.left - r.left) > Math.abs(q.top - r.top)
      const gap = q.left > r.left ? q.left - r.right : r.left - q.right
      if (beside && gap < -20) return 'card'
      if (beside && gap >= 0 && gap < 12.5) return 'row'
      break
    }
  }
  if (r.width >= 1100) return 'card' // hero carousels
  // A glow that a clipping ancestor would shave off reads as stray slivers: the ring alone is cleaner.
  if (glowWouldClip(card, r)) return 'row'
  const art = largestArt(card)
  return art && (art.width * art.height) / (r.width * r.height) > 0.5 ? 'card' : 'row'
}

/** Where Steam already reserves a spot for reviews (search rows: the thumbs icon column), sit there. */
function findReviewSlot(card: HTMLElement): HTMLElement | null {
  const slot = card.querySelector<HTMLElement>('.search_reviewscore')
  if (slot && slot.getClientRects().length) return slot
  return null
}

function placeBadge(card: HTMLElement, summary: ReviewSummary) {
  placeBadgeOnCard(card, summary)
  const inline = card.querySelector<HTMLElement>(`.${BADGE_CLASS}.sro-inline`)
  if (inline && card.dataset.sroFiltered === 'dim') liftAboveDim(card, inline)
}

/**
 * Steam's price strips are often stacking contexts of their own, which trap an inline label under
 * the dim overlay however high its z-index goes. The label is why the card is dimmed, so move it up
 * to the card, on the spot it already holds.
 */
function liftAboveDim(card: HTMLElement, badge: HTMLElement) {
  const b = badge.getBoundingClientRect()
  const r = card.getBoundingClientRect()
  // Hold its place, or the price beside it slides under the lifted label
  const spacer = document.createElement('span')
  spacer.className = 'sro-spacer'
  spacer.style.width = `${b.width}px`
  spacer.style.height = `${b.height}px`
  badge.replaceWith(spacer)
  badge.classList.remove('sro-inline', 'sro-beside-native', 'sro-beside-title')
  badge.classList.add('sro-lifted')
  badge.style.left = `${Math.round(b.left - r.left)}px`
  badge.style.top = `${Math.round(b.top - r.top)}px`
  ensureContainingBlock(card)
  decorationHost(card).appendChild(badge)
}

/** Does a rotating hero's slide already print this rating, as "Very Positive (126 User Reviews)"? */
function heroPrintsSummary(card: HTMLElement, summary: ReviewSummary): boolean {
  const slide = card.closest(ROTATING_CAROUSEL) ? frameBox(card) : null
  const labels = new Set([summary.local?.label, summary.global?.label].filter(Boolean))
  if (!(slide instanceof HTMLElement) || labels.size !== 1) return false
  return textOutsideBadges(slide).includes(`${[...labels][0]} (`)
}

function placeBadgeOnCard(card: HTMLElement, summary: ReviewSummary) {
  if (!card.isConnected) return
  card.querySelectorAll(`.${BADGE_CLASS}, .sro-spacer`).forEach((n) => n.remove())
  lowerPrices(card)
  const pick = chosen(summary)
  card.dataset.sroTone = toneFor(pick?.score ?? 0)
  card.dataset.sroScore = String(pick?.score ?? 0)
  applyFilter(card, summary)
  // Cards that already show Steam's own review text (featured capsules, expanded sale cards)
  // still get filtered/highlighted. They only get our label when the local and global labels
  // disagree: Steam shows one of them, and the other is what makes the filter make sense.
  // Hidden cards (display:none after a hide) cannot be measured, and every placement below decides
  // from measurements: against an all-zero rect the bounds and collision checks pass trivially and
  // a badge is left wherever it lands. Revalidate/reapply places it once the card is visible again.
  if (!card.getClientRects().length) return
  if (card.dataset.sroFiltered !== 'dim' && heroPrintsSummary(card, summary)) return
  if (isTableRow(card)) {
    placeInRow(card, makeBadge(summary))
    return
  }
  const native = nativeSummaryEl(card)
  if (native) {
    const mismatch = summary.local && summary.global && summary.local.label !== summary.global.label
    // Steam's printed summary dims with the card, which would hide the reason it is dimmed
    if (!mismatch && card.dataset.sroFiltered !== 'dim') return
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
  // The Discovery Queue names one game in a multi-game widget, and has nowhere to put a label
  if (card.matches('.discovery_queue_static')) return
  const badge = makeBadge(summary)

  const slot = findReviewSlot(card)
  if (slot) {
    badge.classList.add('sro-slot')
    slot.appendChild(badge)
    // A two-line pair sits on the bottom line of a row that clips its overflow: lift it inside
    const spill = badge.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom + 4
    if (spill > 0) badge.style.translate = `0 ${-Math.ceil(spill)}px`
    return
  }

  // Tiny capsules (bundle-contents strips) have no room for text
  if (card.getBoundingClientRect().width < MIN_LABEL_WIDTH) return

  const price = usesThumbs(card) ? null : findPriceEl(card)
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
      placeInCorner(card, badge, before, priceBefore, priceBlock)
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

/**
 * A text range reports where its glyphs are laid out, not what is drawn. Ellipsized titles run on
 * past their "…", and Steam's screen-reader discount labels (a 1x1 box, clip-path: inset(50%))
 * report their full sentence: a 250px phantom that pushed every discounted home row's label off its
 * price and onto the art. Cut the rect to each clipping ancestor up to the card.
 */
function clipToAncestors(r: DOMRect, from: HTMLElement | null, card: HTMLElement): DOMRect {
  let { left, top, right, bottom } = r
  for (let el = from; el && el !== card.parentElement; el = el.parentElement) {
    const cs = getComputedStyle(el)
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible' && cs.clipPath === 'none') continue
    const cr = el.getBoundingClientRect()
    if (cs.clipPath === 'inset(50%)') return new DOMRect(cr.left, cr.top, 0, 0) // visually hidden
    if (cs.overflowX !== 'visible') { left = Math.max(left, cr.left); right = Math.min(right, cr.right) }
    if (cs.overflowY !== 'visible') { top = Math.max(top, cr.top); bottom = Math.min(bottom, cr.bottom) }
    if (right <= left || bottom <= top) return new DOMRect(left, top, 0, 0)
  }
  return new DOMRect(left, top, right - left, bottom - top)
}

function obstaclesFor(card: HTMLElement, badge: HTMLElement): DOMRect[] {
  const br = badge.getBoundingClientRect()
  const cr = card.getBoundingClientRect()
  // Artwork is judged against the smaller of card and tile: a capsule is a small share of a wide row
  // that holds it, and of a hero slide framed around it, yet it is still what a label sits on
  const seen = frameBox(card)?.getBoundingClientRect() ?? cr
  const cardArea = Math.max(1, Math.min(seen.width * seen.height, cr.width * cr.height))
  const out: DOMRect[] = []
  // Touching counts as a collision too: keep a few pixels of air around text and icons
  const GAP = 4
  const hits = (er: DOMRect) => br.left < er.right + GAP && br.right > er.left - GAP && br.top < er.bottom + 1 && br.bottom > er.top - 1
  // Icons, buttons and small artwork: whole-tile art and wrappers are what a chip sits on, not obstacles
  for (const el of card.querySelectorAll<HTMLElement>('img, svg, video, button, [role="button"]')) {
    if (badge.contains(el) || el.classList.contains(ORBIT_CLASS)) continue
    if (el.matches(`${STACKED_PANEL} .screenshots img`)) continue // the art a stacked panel's chip sits on
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
    for (const raw of range.getClientRects()) {
      const er = clipToAncestors(raw, node.parentElement, card)
      if (er.width > 1 && er.height > 1 && hits(er)) {
        out.push(er)
        break
      }
    }
  }
  return out
}

/** The card's main artwork: <img>/<video>, or a background-image box (event tiles, some capsules). */
function largestArt(card: HTMLElement): DOMRect | null {
  const arts = [...card.querySelectorAll<HTMLElement>('img, video, [style*="background-image"]')]
  if (card.matches('[style*="background-image"]')) arts.push(card)
  let best: DOMRect | null = null
  for (const el of arts) {
    const ir = el.getBoundingClientRect()
    if (!best || ir.width * ir.height > best.width * best.height) best = ir
  }
  return best
}

const within = (br: DOMRect, cr: DOMRect) => br.left >= cr.left - 2 && br.right <= cr.right + 2 && br.top >= cr.top - 2 && br.bottom <= cr.bottom + 2

/**
 * Our ring and dim overlay are absolutely positioned pseudo-elements, and a corner chip is an
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
/** Undo every price block that placeInCorner raised to make room for a label under it. */
function lowerPrices(card: HTMLElement) {
  for (const el of card.querySelectorAll<HTMLElement>('[data-sro-lift]')) {
    el.style.removeProperty('translate')
    delete el.dataset.sroLift
  }
}

/** A card this small, or a label this long for it, has no room for words in any language. */
function tooTightForWords(badge: HTMLElement, cr: DOMRect): boolean {
  if (cr.width < MIN_WORDS_WIDTH || cr.height < MIN_WORDS_HEIGHT) return true
  return [...badge.querySelectorAll<HTMLElement>('.sro-line')].some((l) => l.scrollWidth > l.clientWidth)
}

/**
 * The list a card belongs to: the nearest ancestor holding another card of the same kind. Words and
 * thumbs never mix inside one, so a reader can compare a row at a glance.
 */
function sectionOf(card: HTMLElement): HTMLElement | null {
  const kind = (el: Element) => `${el.tagName}.${el.classList[0] ?? ''}`
  for (let el = card.parentElement, i = 0; el && i < 5; el = el.parentElement, i++) {
    for (const other of el.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`)) {
      if (other !== card && kind(other) === kind(card)) return el
    }
  }
  return card.parentElement
}

/** Sections that have fallen back to thumbs. Once one card cannot take words, none of them do. */
const thumbSections = new WeakSet<HTMLElement>()
const usesThumbs = (card: HTMLElement) => {
  const section = sectionOf(card)
  return !!section && thumbSections.has(section)
}

/** Swap the words for thumbs. The words stay in the DOM, and in the hover label. */
function abbreviate(badge: HTMLElement) {
  const score = Number(badge.dataset.sroScore)
  if (!score) return // no Steam score, nothing to draw
  const lines = [...badge.querySelectorAll<HTMLElement>('.sro-line')]
  const words = lines.map((l) => l.textContent).join(' · ')
  const thumbs = document.createElement('span')
  thumbs.className = `sro-thumbs sro-${toneFor(score)}`
  // One paragraph per score, each led by the mark its label line uses
  const scores = lines.flatMap((l) => l.title.split('\n'))
  thumbs.dataset.sroTip = scores.map((text) => `${text.startsWith(t('allLanguages')) ? '🌐' : lang.flag} ${text}`).join('\n')
  thumbs.setAttribute('role', 'img')
  thumbs.setAttribute('aria-label', words)
  thumbs.append(...thumbIcons(score))
  badge.classList.add('sro-compact')
  badge.prepend(thumbs)
}

/**
 * The hover label for thumbs. One element on the page root, placed from the thumbs' position on
 * screen: inside a card it would be cut off by whatever clips that card, and Steam clips a lot.
 */
let thumbTip: HTMLElement | null = null

function showThumbTip(thumbs: HTMLElement) {
  if (!thumbTip) {
    thumbTip = document.createElement('div')
    thumbTip.className = 'sro-tip'
    thumbTip.setAttribute('role', 'tooltip')
    document.documentElement.appendChild(thumbTip)
  }
  thumbTip.replaceChildren(
    ...(thumbs.dataset.sroTip ?? '').split('\n').map((text) => {
      const score = document.createElement('p')
      score.textContent = text
      return score
    }),
  )
  thumbTip.style.color = getComputedStyle(thumbs).getPropertyValue('--sro-thumb')
  thumbTip.hidden = false
  const at = thumbs.getBoundingClientRect()
  const tip = thumbTip.getBoundingClientRect()
  const EDGE = 8
  const above = at.top - tip.height - 6
  thumbTip.style.left = `${Math.max(EDGE, Math.min(at.right - tip.width, innerWidth - tip.width - EDGE))}px`
  thumbTip.style.top = `${above >= EDGE ? above : at.bottom + 6}px`
}

function hideThumbTip() {
  if (thumbTip) thumbTip.hidden = true
}

const thumbsAt = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('.sro-thumbs') : null)

function onThumbOver(e: MouseEvent) {
  const thumbs = thumbsAt(e.target)
  if (thumbs) showThumbTip(thumbs)
}

function onThumbOut(e: MouseEvent) {
  if (thumbsAt(e.target) && thumbsAt(e.target) !== thumbsAt(e.relatedTarget)) hideThumbTip()
}

/** Move a section to thumbs, taking along any card already placed with words. */
function switchSectionToThumbs(card: HTMLElement) {
  const section = sectionOf(card)
  if (!section || thumbSections.has(section)) return
  thumbSections.add(section)
  for (const other of section.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`)) {
    if (other === card || sectionOf(other) !== section) continue
    const appid = ownedAppId(other)
    const summary = appid ? peekCached(appid) : undefined
    if (summary && other.querySelector(`.${BADGE_CLASS}`)) placeBadge(other, summary)
  }
}

/**
 * Chart rows. Top Sellers has no room for words: thumbs follow the price, centred by CSS and out of
 * the flow, because anything added to a table's columns changes their widths. Most Played has room,
 * so the label ends the title's own flex row, which centres it and gives way to the title. Only a
 * row too narrow for that falls back to thumbs.
 */
function placeInRow(card: HTMLElement, badge: HTMLSpanElement) {
  const pick = (b: HTMLElement) => Number(b.dataset.sroScore)
  const cell = card.querySelector<HTMLElement>(':scope > td')
  ensureContainingBlock(card)
  // An empty first cell marks the Top Sellers layout, at every window width
  if (cell && !cell.textContent?.trim()) {
    // Thumbs: at a minimum font size, two language lines of long words overflow the row. They open
    // the cell after the price, one left edge down the table. CSS pads that cell so its column
    // widens to fit them, at any window width, and its own right-aligned text stays clear.
    if (!pick(badge)) {
      badge.remove()
      return
    }
    const cells = [...card.children]
    const artCell = cells.findIndex((c) => c.querySelector('img'))
    const afterPrice = cells[artCell + 2] as HTMLElement | undefined
    badge.classList.add('sro-corner', 'sro-gutter')
    ;(afterPrice ?? decorationHost(card)).appendChild(badge)
    abbreviate(badge)
    return
  }
  const titleRow = [...card.querySelectorAll<HTMLElement>('td a')].find((a) => a.querySelector('img') && getComputedStyle(a).display === 'flex')
  badge.classList.add('sro-inline', 'sro-row-end')
  ;(titleRow ?? decorationHost(card)).appendChild(badge)
  const tooNarrow = titleRow ? titleRow.scrollWidth > titleRow.clientWidth : true
  if (tooNarrow) switchSectionToThumbs(card)
  if (usesThumbs(card)) abbreviate(badge)
}

function placeInCorner(card: HTMLElement, badge: HTMLSpanElement, cardRect?: DOMRect, priceRect?: DOMRect, priceEl?: HTMLElement) {
  badge.classList.add('sro-corner')
  ensureContainingBlock(card)
  decorationHost(card).appendChild(badge)
  const cr = cardRect ?? card.getBoundingClientRect()
  if (!usesThumbs(card) && tooTightForWords(badge, cr)) switchSectionToThumbs(card)
  if (usesThumbs(card)) {
    abbreviate(badge)
    // A section of thumbs has no way to say "no reviews" that is not words
    if (!Number(badge.dataset.sroScore)) {
      badge.remove()
      return
    }
  }
  const bh = badge.offsetHeight
  const bw = badge.offsetWidth
  const apply = (pos: { bottom?: number; top?: number; right?: number; left?: number }) => {
    lowerPrices(card)
    badge.style.bottom = pos.bottom !== undefined ? `${pos.bottom}px` : 'auto'
    badge.style.top = pos.top !== undefined ? `${pos.top}px` : 'auto'
    badge.style.right = pos.right !== undefined ? `${pos.right}px` : 'auto'
    badge.style.left = pos.left !== undefined ? `${pos.left}px` : 'auto'
  }
  const clear = () => {
    const br = badge.getBoundingClientRect()
    return within(br, cr) && obstaclesFor(card, badge).length === 0
  }
  // Candidate positions, best first: a stacked panel's last screenshot, the artwork's lower-right on
  // art-on-top cards, the card's own
  // bottom-right, lifted above the price block, lifted above whatever it hits, shifted left of it,
  // then the top-right. The plain corner comes before the price lift so a row list reads as one
  // column of labels: rows with a centred price and rows with a discount stack all keep the corner.
  const candidates: Array<() => void> = []
  // Stacked panels: on the last screenshot, above the price, so the label stays out of the gap
  // under the panel. Dark chip over artwork, the same as on the small capsules.
  const shot = card.matches(STACKED_PANEL) ? [...card.querySelectorAll('.screenshots img')].pop()?.getBoundingClientRect() : undefined
  if (shot?.width) {
    candidates.push(() => apply({ bottom: Math.round(cr.bottom - shot.bottom) + 4, right: Math.round(cr.right - shot.right) + 4 }))
  }
  // A hero's capsule: the art's corner, wherever the frame goes
  const heroArt = card.closest(ROTATING_CAROUSEL) ? largestArt(card) : null
  if (heroArt) candidates.push(() => apply({ bottom: Math.max(4, Math.round(cr.bottom - heroArt.bottom) + 4), right: Math.max(4, Math.round(cr.right - heroArt.right) + 4) }))
  // Art across the top with text below (carousel tiles with a blurb or tag pills, then a price bar):
  // the art's lower-right is a fixed spot, where the card's lower half shifts from tile to tile with
  // the blurb's length and would scatter the chips along one row.
  const art = largestArt(card)
  const tile = frameBox(card)?.getBoundingClientRect()
  const compact = badge.classList.contains('sro-compact')
  // Measured against the visible tile; thumbs are small enough to need no strip below the art
  if (art && art.top - (tile ?? cr).top <= 6 && art.width >= (tile ?? cr).width * 0.8 && (compact || (tile ?? cr).bottom - art.bottom > bh + 8)) {
    candidates.push(() => apply({ bottom: Math.round(cr.bottom - art.bottom) + 4, right: Math.max(4, Math.round(cr.right - art.right) + 4) }))
  }
  // The corner of the tile a reader sees, not of the slot around it
  candidates.push(() => apply({ bottom: Math.max(4, Math.round(cr.bottom - (tile?.bottom ?? cr.bottom)) + 4), right: Math.max(4, Math.round(cr.right - (tile?.right ?? cr.right)) + 4) }))
  // Rows whose price sits in that corner: raise the price by the label's height (a translate, so
  // nothing else reflows) and put the label under it. Only when the raised price covers nothing.
  // The whole discount block moves (percentage, struck price and final price), not just the prices.
  const raiseEl = priceEl?.closest<HTMLElement>('.discount_block') ?? priceEl
  let raised = false
  let priceTouching = 0
  if (raiseEl && cr.width >= cr.height * 2.5) {
    const rr = raiseEl.getBoundingClientRect()
    // Measure the text: at a minimum font size it runs past the fixed-height box around it
    const text = document.createRange()
    text.selectNodeContents(raiseEl)
    const lift = Math.ceil(Math.max(rr.bottom, text.getBoundingClientRect().bottom) - (cr.bottom - 4 - bh)) + 2
    if (lift > 0 && rr.top - lift >= cr.top + 2) {
      candidates.push(() => {
        apply({ bottom: 4, right: 4 })
        priceTouching = obstaclesFor(card, raiseEl).length // what it sits against already is no new fault
        raiseEl.style.translate = `0 ${-lift}px`
        raiseEl.dataset.sroLift = '1'
        raised = true
      })
    }
  }
  if (priceRect) {
    const lift = Math.max(0, Math.round(cr.bottom - priceRect.top))
    if (lift > 0 && lift < cr.height - bh - 4) candidates.push(() => apply({ bottom: lift + 4, right: 4 }))
  }
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
  // Words first. When no spot takes them (an event tile's date, a price tag), thumbs usually fit.
  for (;;) {
    for (const place of candidates) {
      raised = false
      place()
      if (clear() && (!raised || (within(raiseEl!.getBoundingClientRect(), cr) && obstaclesFor(card, raiseEl!).length <= priceTouching))) return
    }
    if (badge.classList.contains('sro-compact') || !Number(badge.dataset.sroScore)) break
    switchSectionToThumbs(card)
    abbreviate(badge)
    // Thumbs need no strip below the art, so its corner is open to them now
    if (art) candidates.unshift(() => apply({ bottom: Math.round(cr.bottom - art.bottom) + 4, right: Math.max(4, Math.round(cr.right - art.right) + 4) }))
  }
  lowerPrices(card)
  badge.remove()
  badge.classList.remove('sro-corner')
  badge.style.cssText = ''
  // Last resort for dense rows (charts tables): inline right after the title text
  if (placeBesideTitle(card, badge, cr)) return
  // Nothing fits without covering something. Every game card still carries its label, because a card
  // without one reads as a game we failed to check: a chip on the art's lower-right (the usual spot),
  // or the card's own lower-right when the art is too small to hold it.
  badge.classList.add('sro-corner', 'sro-fallback')
  card.appendChild(badge)
  // A chip wider than the art (a long label under a minimum font size) ellipsizes to fit it rather
  // than move to the card's own corner, which in a row is where the price sits.
  if (art && art.width >= Math.min(bw, 100) + 8 && art.height >= bh + 8) {
    if (bw + 8 > art.width) badge.style.maxWidth = `${Math.floor(art.width) - 8}px`
    apply({ bottom: Math.max(4, Math.round(cr.bottom - art.bottom) + 4), right: Math.max(4, Math.round(cr.right - art.right) + 4) })
  } else {
    apply({ bottom: 4, right: 4 })
  }
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
/** Read live, not cached: a reader can flip the OS setting while the page is open. */
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
/** The freshest summary for a card (review data may have arrived since a deferred handler was armed). */
/**
 * The appid this card is claimed for, but only while the card still points at that game.
 *
 * Steam recycles a carousel node by swapping what is inside it, and a deferred repaint (a resize, a
 * late image, a font swap) could fire in the gap before the scanner notices, painting the previous
 * game's label, tone and highlight onto the game now in that slot. An href swapped in place never
 * reaches the scanner at all: the mutation observer watches childList and characterData, not
 * attributes.
 */
function ownedAppId(card: HTMLElement): number | undefined {
  const appid = cardsByAppId.get(card)
  if (!appid) return undefined
  const ids = appIdsWithin(card, 2)
  return ids.size === 1 && ids.has(appid) ? appid : undefined
}

function latest(card: HTMLElement, fallback: ReviewSummary): ReviewSummary {
  const appid = ownedAppId(card)
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
  const existing = card.querySelector<HTMLElement>(`.${ORBIT_CLASS}`)
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
  ring.append(document.createElement('i'), document.createElement('i')) // two lights, half a lap apart
  decorationHost(card).appendChild(ring)
  orbitVisibility.observe(ring)
}

/** Cards change size when a carousel reveals them; re-derive the highlight shape when that happens. */
const shapeWatcher = new ResizeObserver((entries) => {
  if (!alive()) return
  for (const e of entries) {
    const card = e.target as HTMLElement
    if (!card.isConnected) continue
    const appid = ownedAppId(card)
    if (!appid) {
      // The slot now holds a different game: let the scanner re-claim it rather than repaint it.
      if (cardsByAppId.has(card)) {
        stripCard(card)
        scheduleScan(card)
      }
      continue
    }
    const r = card.getBoundingClientRect()
    // A container that grew past card size (a section filled in after we claimed it) is not a card;
    // growth without a DOM mutation never reaches the scanner, so release it here.
    if (r.height > MAX_CARD_H) {
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
    if (!first && card.querySelector(`.${BADGE_CLASS}.sro-corner`)) placeBadge(card, s)
    else if (appid) reconcileBadge(card, appid)
  }
})

function applyFilter(card: HTMLElement, summary: ReviewSummary) {
  const pick = chosen(summary)
  const filtered = isFiltered(pick, settings)
  // The highlight and dim decorations are absolutely positioned against the card.
  if (filtered || (pick && isHighlighted(pick, settings))) {
    ensureContainingBlock(card)
    raiseOverhangs(card)
  }
  setFrame(card)
  // Highlight in the reader's chosen color, else the game's OWN review color (Steam's tone for its
  // tier), not the lever's. Overwhelmingly Positive can add a slow orbiting light.
  if (!filtered && pick && isHighlighted(pick, settings)) {
    card.dataset.sroHighlight = toneFor(pick.score)
    const r = card.getBoundingClientRect()
    // Not laid out yet (hidden carousel slide): draw nothing until it has a size
    if (r.width && r.height) {
      card.dataset.sroShape = highlightShape(card)
    } else {
      delete card.dataset.sroShape
    }
    shapeWatcher.observe(card)
    card.style.setProperty('--sro-hl', settings.frameColor ?? toneColorAt(pick.score))
    const sparkle = pick.score === 9 && settings.sparkle
    if (sparkle) card.dataset.sroOp = '1'
    else delete card.dataset.sroOp
    setOrbit(card, sparkle)
  } else {
    delete card.dataset.sroHighlight
    delete card.dataset.sroOp
    delete card.dataset.sroShape
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
  // hide: fade out first, then display:none so the layout reflows. A reader who asked for less
  // motion gets neither the fade (CSS) nor the wait: holding the card in the layout, invisible and
  // inert, only to snap the list closed a third of a second later is the jump they wanted avoided.
  if (reducedMotion()) {
    card.dataset.sroFiltered = 'hide'
    return
  }
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
  for (const [card] of [...cardsByAppId]) {
    if (!card.isConnected) continue
    // Same rule as every other deferred repaint: a slot that has changed hands since we claimed it
    // must not be painted with the game it used to hold. A settings change is exactly when this
    // shows, because it repaints every card at once.
    const appid = ownedAppId(card)
    if (!appid) {
      stripCard(card)
      scheduleScan(card)
      continue
    }
    const s = peekCached(appid)
    if (!s) continue
    if (rerender) {
      placeBadge(card, s)
      continue
    }
    const wasDim = card.dataset.sroFiltered === 'dim'
    applyFilter(card, s)
    // Dimming moves an inline label above the overlay, and adds one to a card with Steam's own summary
    if (wasDim !== (card.dataset.sroFiltered === 'dim')) {
      placeBadge(card, s)
      continue
    }
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
  // Always let go of the live state first. Every caller that repurposes an element needs this, and
  // one that forgot left the old game's cache subscription in place: the revalidation timer kept
  // re-fetching that appid every minute for the life of the tab, and when one of those fetches
  // resolved the orphaned listener repainted the element with the previous game's badge.
  release(card)
  card.removeAttribute(CARD_ATTR)
  for (const k of ['sroTone', 'sroScore', 'sroFiltered', 'sroHighlight', 'sroOp', 'sroShape', 'sroSize']) delete card.dataset[k]
  card.style.removeProperty('--sro-hl')
  clearFrame(card)
  if (card.dataset.sroPos) {
    card.style.removeProperty('position')
    delete card.dataset.sroPos
  }
  lowerPrices(card)
  card.querySelectorAll(`.${ORBIT_CLASS}`).forEach((n) => orbitVisibility.unobserve(n))
  card.querySelectorAll(`.${BADGE_CLASS}, .sro-spacer, .${ORBIT_CLASS}`).forEach((n) => n.remove())
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
  if (card.dataset.sroOp && !card.querySelector(`.${ORBIT_CLASS}`)) setOrbit(card, true)
}

function revalidateCards() {
  for (const [card, appid] of cardsByAppId) {
    if (!card.isConnected) {
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
    stripCard(card)
  }
}

const replaceQueue = new Set<HTMLElement>()
let replaceTimer: number | undefined
function onAssetLoad(e: Event) {
  if (!alive() || !(e.target instanceof HTMLImageElement)) return
  const card = e.target.closest<HTMLElement>(`[${CARD_ATTR}]`)
  if (!card || !(card.querySelector(`.${BADGE_CLASS}.sro-corner`) || card.dataset.sroHighlight)) return
  replaceQueue.add(card)
  if (replaceTimer) return
  replaceTimer = window.setTimeout(() => {
    replaceTimer = undefined
    for (const c of replaceQueue) {
      const appid = c.isConnected ? ownedAppId(c) : undefined
      const s = appid ? peekCached(appid) : undefined
      if (!s) continue
      if (c.querySelector(`.${BADGE_CLASS}.sro-corner`)) placeBadge(c, s)
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
  for (const [card] of cardsByAppId) {
    if (!card.isConnected || !card.querySelector(`.${BADGE_CLASS}.sro-corner`)) continue
    const appid = ownedAppId(card)
    if (!appid) continue
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
      stripCard(owner)
    } else {
      const s = appid ? peekCached(appid) : undefined
      if (s && owner.querySelector(`.${BADGE_CLASS}.sro-corner`)) placeBadge(owner, s)
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
      // Only skip it if this element still holds the game we claimed it for. A carousel reuses one
      // element for slide after slide, so a claimed container can end up showing a different game
      // while still wearing the previous one's tone and ring.
      if (cardsByAppId.get(owner) === appid) continue
      stripCard(owner) // a rotated slide, a re-attached clone, or a retired instance
    }
    if (el.closest(EXCLUDE_SELECTOR)) continue
    const card = findCard(el, appid)
    if (!card || card.hasAttribute(CARD_ATTR)) continue
    // Ignore invisible / zero-size things (hidden templates etc.) and plain prose links
    const r = card.getBoundingClientRect()
    if (r.width < 40 || r.height < 16) {
      // No layout at all (an inactive home tab, a collapsed panel): Steam reveals it by flipping a style,
      // which the mutation observer never hears about. Look again once it has a size.
      if (!card.getClientRects().length) layoutWatcher.observe(card)
      continue
    }
    // Short and image-less is usually a prose link; a block-level row of a ranking list
    // (charts: "3  Halloween: The Game  1,251,033") is a card even so.
    if (r.height < 60 && !hasArt(card) && !isTextRow(card, r)) continue // art may be a background image
    if (linksToNonGame(card)) continue
    if (isBaseGameStrip(card, r, appid)) continue
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
/** Cards skipped for having no layout: scanned again the moment they get one. */
const layoutWatcher = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target as HTMLElement
    if (!el.isConnected) {
      layoutWatcher.unobserve(el)
      continue
    }
    if (!el.getClientRects().length) continue // the initial callback for a still-hidden card
    layoutWatcher.unobserve(el)
    scheduleScan(el)
  }
})

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
  delete document.documentElement.dataset.sroReady
  document.removeEventListener('mouseover', onThumbOver)
  document.removeEventListener('mouseout', onThumbOut)
  document.removeEventListener('scroll', hideThumbTip, true)
  thumbTip?.remove()
  layoutWatcher.disconnect()
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
  document.addEventListener('mouseover', onThumbOver)
  document.addEventListener('mouseout', onThumbOut)
  document.addEventListener('scroll', hideThumbTip, { capture: true, passive: true })
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
  // Tools poll for this instead of sleeping: it separates "the overlay ran" from "no cards here"
  document.documentElement.dataset.sroReady = '1'
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
