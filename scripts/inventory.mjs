// Card inventory: for each URL, find every game-card candidate on the page (independently of the
// extension's own card logic), reduce it to a structural signature, and record example markup,
// computed styles, and what the extension did with it. Deterministic given the same page markup.
//
// Usage: node scripts/inventory.mjs <outdir> <url> [url...]      (SRO_EXT_DIR overrides dist/chrome)
// Output: <outdir>/<slug>.json per page and <outdir>/pages.json (all pages, merged by signature).
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'

const srcExt = process.env.SRO_EXT_DIR ? path.resolve(process.env.SRO_EXT_DIR) : path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const [out, ...urls] = process.argv.slice(2)
if (!out || !urls.length) {
  console.error('usage: node scripts/inventory.mjs <outdir> <url> [url...]')
  process.exit(1)
}
// Crawl against our own copy. A full crawl runs for most of an hour, and a rebuild in the same
// checkout meanwhile replaces the content script's content-hashed filename: every page loaded after
// that fails to inject and is recorded as having no overlay at all, which reads as a coverage gap.
fs.mkdirSync(out, { recursive: true })
// realpath: macOS hands back /var/folders/..., a symlink, and Chrome derives the id from the
// real path, so hashing the symlink gives an id that does not exist.
const ext = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sro-ext-')))
fs.cpSync(srcExt, ext, { recursive: true })
process.on('exit', () => fs.rmSync(ext, { recursive: true, force: true }))
// Chrome derives an unpacked extension's id from the SHA-256 of its path, so this follows the copy.
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
const slug = (u) => u.replace(/^https?:\/\/store\.steampowered\.com\/?/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
// Active state so the inventory also records highlight shapes and dim decisions
const SETTINGS = { mode: 'dim', threshold: 0, source: 'local', highlightThreshold: 1 } // filter parked, highlight everything reviewed

/** Runs in the page. Everything here must be self-contained. */
const INVENTORY = () => {
  const APP_RE = /(?:^|store\.steampowered\.com)\/(?:news\/)?app\/(\d+)/
  const EXCLUDE = '#global_header, #footer, #global_hover, .hover_body, #search_suggestion_contents, .game_area_purchase_game'
  const NEVER_CARD = '.page_content, .page_content_ctn, #responsive_page_template_content, .responsive_page_content, main, [role="main"], .app_reviews_area, .game_page_autocollapse_ctn, .leftcol, .rightcol, .block, #game_area_reviews, .game_area_dlc_section, .game_area_dlc_list'
  // Class tokens that describe state, not structure
  const STATE_RE = /^(sro-|ds_|app_impression|carousel__slide--|focus|hover|active|selected|visible|hidden|loaded|loading|Focusable$|_\d+$|impression|with_microtrailer|add_microtrailer|prev$|next$|responsive_scroll_snap|ImpressionTracked)/i
  const HASH_RE = /^_?[A-Za-z0-9_-]{18,}$/ // Steam's CSS-module hashes: kept, but flagged
  const appIdOf = (el) => {
    const ds = el.getAttribute?.('data-ds-appid')
    if (ds) return Number(ds.split(',')[0]) || 0
    const href = el.getAttribute?.('href') || ''
    const m = href.match(APP_RE)
    return m ? Number(m[1]) : 0
  }
  const idsWithin = (root, limit) => {
    const ids = new Set()
    const self = appIdOf(root)
    if (self) ids.add(self)
    for (const n of root.querySelectorAll('a[href*="/app/"], [data-ds-appid]')) {
      const v = appIdOf(n)
      if (v) ids.add(v)
      if (ids.size >= limit) break
    }
    return ids
  }
  const maxW = Math.min(1240, innerWidth - 80)
  // A row of artwork tiles that all link to one game (news hub groups) is a group, not a card
  const hasSiblingTile = (parent, tile, appid) => {
    const tr = tile.getBoundingClientRect()
    if (tr.width < 60 || tr.height < 40) return false
    for (const n of parent.querySelectorAll('a[href*="/app/"], [data-ds-appid]')) {
      if (tile.contains(n) || appIdOf(n) !== appid) continue
      const r = n.getBoundingClientRect()
      if (r.height < 40 || r.width < 60 || !n.querySelector('img, picture, video, [style*="background-image"]')) continue
      // Repeated tiles look alike; a box-art capsule next to its own wide info panel does not
      if (Math.abs(r.width - tr.width) <= 0.25 * Math.max(r.width, tr.width) && Math.abs(r.height - tr.height) <= 0.25 * Math.max(r.height, tr.height)) return true
    }
    return false
  }
  const findCard = (start, appid) => {
    let card = null
    let el = start
    let hops = 0
    while (el && el !== document.body && hops < 12) {
      const ids = idsWithin(el, 2)
      if (ids.size !== 1 || !ids.has(appid)) break
      const r = el.getBoundingClientRect()
      if (r.height > 700 || el.matches(NEVER_CARD)) break
      if (card && r.width > maxW) break
      if (card && hasSiblingTile(el, card, appid)) break
      card = el
      el = el.parentElement
      hops++
    }
    return card
  }
  const tokens = (el) => [...(el.classList || [])].filter((c) => !STATE_RE.test(c))
  const sig = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id.replace(/\d+/g, 'N') : ''}.${tokens(el).sort().join('.')}`
  const pageStructures = [] // {el, sig} for headings
  // Section headings: short, large-type text outside the chrome and outside any game link
  const CHROME = '#global_header, #global_actions, .responsive_header, #footer, #global_hover, .hover_body, #store_nav_area, [class*="StoreNav" i]'
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, div, span')].filter((h) => {
    if (h.children.length > 2 || h.closest(CHROME) || h.closest('a[href*="/app/"], [data-ds-appid]')) return false
    const t = (h.textContent || '').trim()
    if (!t || t.length > 60 || t.length < 3 || /^[-+\d%$.,\s]+$/.test(t)) return false // "-50%" is a price tag
    if (/^h[1-4]$/i.test(h.tagName)) return true
    const cs = getComputedStyle(h)
    return parseFloat(cs.fontSize) >= 17 && (cs.textTransform === 'uppercase' || parseFloat(cs.fontSize) >= 20 || /title|header|heading/i.test(h.className))
  })
  const headingFor = (card) => {
    let best = null
    for (const h of headings) {
      if (card.contains(h)) continue
      const pos = h.compareDocumentPosition(card)
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) best = h // heading precedes card
      else if (pos & Node.DOCUMENT_POSITION_PRECEDING) break
    }
    return best ? (best.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : ''
  }
  const sectionFor = (card) => {
    let el = card.parentElement
    let hops = 0
    while (el && el !== document.body && hops < 8) {
      if (el.id) return `#${el.id.replace(/\d+/g, 'N')}`
      const t = tokens(el).filter((c) => !HASH_RE.test(c))
      if (t.length) return '.' + t.sort().join('.')
      el = el.parentElement
      hops++
    }
    return ''
  }
  const has = (card, sel) => !!card.querySelector(sel)
  const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const cleanHtml = (el) =>
    el.outerHTML
      .replace(/\s(src|srcset|data-src|href|style|data-tooltip-html|title|alt|aria-label)="[^"]*"/g, (m, a) => (a === 'href' || a === 'style' ? ` ${a}="…"` : ''))
      .replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>')
      .replace(/>\s+</g, '><')
      .slice(0, 1600)
  const cs = (el, props) => Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]]))

  const cards = new Map() // card element → record
  for (const link of document.querySelectorAll('a[href*="/app/"], [data-ds-appid]')) {
    const appid = appIdOf(link)
    if (!appid || link.closest(EXCLUDE)) continue
    const card = findCard(link, appid)
    if (!card || cards.has(card)) continue
    const r = card.getBoundingClientRect()
    if (r.width < 40 || r.height < 16) continue
    const parent = card.parentElement
    const pcs = getComputedStyle(parent)
    const priceEl = [...card.querySelectorAll('[class*="price" i], [class*="discount" i]')].find((e) => /\d/.test(textOf(e)) && !e.querySelector('[class*="price" i]'))
    const dateEl = [...card.querySelectorAll('*')].find((e) => e.children.length === 0 && /(^|\s)(Available|Coming soon|To be announced|\w{3}, \w+ \d{1,2}, 20\d\d|\w{3} \d{1,2}, 20\d\d|Q[1-4] 20\d\d|20\d\d)$/i.test(textOf(e)) && textOf(e).length < 40)
    const nativeEl = [...card.querySelectorAll('[class*="review" i]')].find((e) => textOf(e) && !e.closest('.sro-badge'))
    const titleEl = card.querySelector('.title, .tab_item_name, [class*="title" i], [class*="name" i], [class*="Title" i]')
    const imgEl = card.querySelector('img, picture, video, [style*="background-image"]')
    const ir = imgEl?.getBoundingClientRect()
    const artFraction = ir && r.width && r.height ? Math.round(((ir.width * ir.height) / (r.width * r.height)) * 100) / 100 : 0
    const ourCard = link.closest('[data-sro-card]')
    const badge = card.querySelector('.sro-badge')
    const features = {
      link: /\/news\/app\//.test(link.getAttribute('href') || '') ? 'news' : 'app',
      img: !!imgEl,
      artFraction,
      price: !!priceEl,
      date: !!dateEl,
      nativeSummary: !!nativeEl,
      title: !!titleEl,
      platforms: has(card, '.platform_img, [class*="platform" i]'),
      discount: has(card, '[class*="discount_pct" i], [class*="DiscountPct" i]'),
      carousel: !!card.closest('[class*="carousel" i], [class*="slide" i], .carousel_container'),
      parentDisplay: pcs.display + (pcs.display.includes('flex') ? '/' + pcs.flexDirection : ''),
      siblings: parent.children.length,
    }
    const sizeBucket = `${Math.round(r.width / 20) * 20}x${Math.round(r.height / 20) * 20}`
    const featureKey = ['link', 'img', 'price', 'date', 'nativeSummary', 'title', 'platforms', 'carousel'].map((k) => `${k}=${features[k]}`).join(',')
    cards.set(card, {
      appid,
      signature: sig(card),
      hashedClasses: tokens(card).some((c) => HASH_RE.test(c)),
      section: sectionFor(card),
      heading: headingFor(card),
      chain: (() => {
        const c = []
        let el = card.parentElement
        for (let i = 0; i < 4 && el && el !== document.body; i++, el = el.parentElement) c.push(sig(el))
        return c
      })(),
      sizeBucket,
      features,
      featureKey,
      styles: {
        card: cs(card, ['position', 'display', 'overflow', 'borderRadius', 'backgroundImage']),
        parent: cs(parent, ['display', 'flexDirection', 'overflow', 'overflowX', 'gap']),
        price: priceEl ? { cls: tokens(priceEl).join(' '), ...cs(priceEl, ['position', 'display', 'textAlign']) } : null,
        native: nativeEl ? { cls: tokens(nativeEl).join(' '), text: textOf(nativeEl).slice(0, 40) } : null,
      },
      ours: {
        claimed: !!ourCard,
        sameElement: ourCard === card,
        ourCardSig: ourCard && ourCard !== card ? sig(ourCard) : null,
        shape: ourCard?.dataset.sroShape || null,
        axis: ourCard?.dataset.sroAxis || null,
        filtered: ourCard?.dataset.sroFiltered || null,
        highlighted: !!ourCard?.dataset.sroHighlight,
        badge: badge ? [...badge.classList].filter((c) => c.startsWith('sro-') && !/^sro-(positive|mixed|negative|none)$/.test(c)).join(' ') : ourCard ? 'none' : null,
        badgeParent: badge ? sig(badge.parentElement) : null,
      },
      title: textOf(titleEl).slice(0, 60),
      html: cleanHtml(card),
    })
  }
  // Group by (signature, featureKey)
  const kinds = new Map()
  for (const rec of cards.values()) {
    const key = `${rec.signature}|${rec.featureKey}`
    let k = kinds.get(key)
    if (!k) {
      k = { key, signature: rec.signature, hashedClasses: rec.hashedClasses, featureKey: rec.featureKey, features: rec.features, count: 0, sizes: {}, sections: {}, headings: {}, chains: {}, ours: {}, examples: [] }
      kinds.set(key, k)
    }
    k.count++
    k.sizes[rec.sizeBucket] = (k.sizes[rec.sizeBucket] || 0) + 1
    k.sections[rec.section] = (k.sections[rec.section] || 0) + 1
    if (rec.heading) k.headings[rec.heading] = (k.headings[rec.heading] || 0) + 1
    k.chains[rec.chain.join(' < ')] = (k.chains[rec.chain.join(' < ')] || 0) + 1
    const o = `${rec.ours.claimed ? (rec.ours.sameElement ? 'same' : 'other:' + rec.ours.ourCardSig) : 'unclaimed'}|shape=${rec.ours.shape}|badge=${rec.ours.badge}`
    k.ours[o] = (k.ours[o] || 0) + 1
    if (k.examples.length < 2) k.examples.push({ appid: rec.appid, title: rec.title, sizeBucket: rec.sizeBucket, styles: rec.styles, ours: rec.ours, html: rec.html })
  }
  return { title: document.title, cards: cards.size, kinds: [...kinds.values()].sort((a, b) => b.count - a.count) }
}

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new'],
  viewport: { width: 1400, height: 1000 },
  locale: 'en-US',
})
const pop = await ctx.newPage()
await pop.goto(`chrome-extension://${id}/src/popup/index.html`)
await pop.evaluate((o) => chrome.storage.sync.set(o), { 'sro:settings:v4': SETTINGS })
const pages = []
for (const url of urls) {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } catch (e) {
    pages.push({ url, error: String(e).slice(0, 160) })
    await page.close()
    continue
  }
  await page.waitForTimeout(6000)
  // Scroll the whole page so lazy sections and infinite lists render, then return to the top
  for (let i = 0; i < 25; i++) {
    const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 5)
    if (atEnd) break
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(2500)
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(1000)
  const r = await page.evaluate(INVENTORY)
  const finalUrl = page.url()
  const entry = { url, finalUrl, title: r.title, cards: r.cards, kinds: r.kinds, errors, capturedAt: new Date().toISOString() }
  fs.writeFileSync(path.join(out, `${slug(url)}.json`), JSON.stringify(entry, null, 1))
  pages.push(entry)
  console.log(`${slug(url)}: ${r.cards} cards, ${r.kinds.length} kinds${finalUrl !== url ? ` (→ ${finalUrl})` : ''}`)
  await page.close()
}
await ctx.close()
fs.writeFileSync(path.join(out, 'pages.json'), JSON.stringify(pages, null, 1))
