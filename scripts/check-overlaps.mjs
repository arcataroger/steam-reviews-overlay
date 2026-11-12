#!/usr/bin/env node
// Layout gate: load live pages at several window widths and both font settings, scroll through
// each, and fail if a label covers text, leaves its card, a price is pushed out of its card, a
// table loses its shared columns, or search labels lose their shared left edge. On tiles it also
// fails a frame that leaves out the price bar, a card holding a section heading, a game tile
// without a card, and a label flush against the price beside it.
// Steam's layouts change with the window and the font, so a fix checked once proves little: one
// chart overlap only appeared at the default font, another only at 1400px with a 16px minimum.
//
//   npm run check:overlaps                      all pages, all widths
//   npm run check:overlaps -- --pages charts/topselling/US,search/
//   npm run check:overlaps -- --widths 1100,1760 --fonts 0,16
//   npm run check:overlaps -- --browser chromium
//
// Needs a build of the browser under test: `npm run build:firefox` (the default) or `build:chrome`.
// Set SRO_PROFILE_DIR to run beside a browser already holding the kept profile (logged out, so
// personalised rows go unchecked).
import { browserArg, launch, waitForOverlay } from './lib/browsers.mjs'
import { CHECKS } from './visual-pass.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : process.argv[i + 1]
}
const { browser } = browserArg(process.argv.slice(2).join(' ').includes('--browser') ? undefined : ['--browser', 'firefox'])
const STORE = 'https://store.steampowered.com/'
const PAGES = ['', 'charts/topselling/US', 'charts/mostplayed', 'search/?filter=topsellers', 'explore/new/', 'category/programming', 'specials/', 'tag/browse/', 'recommended/friendactivity/',
  // A sale page: rows centre a lone last tile between empty slots, and tiles carry "In Library" ribbons.
  // Event pages expire; when this one redirects, swap in any current /sale/ page with both.
  'sale/goldenjoystickawards']
const pages = arg('pages')?.split(',') ?? PAGES
const widths = (arg('widths') ?? '1100,1400,1760,2200').split(',').map(Number)
const fonts = (arg('fonts') ?? '0,16').split(',').map(Number)
const FAULTS = /overlaps|outside|overflow|clipped/
const STOPS = 8
/** A sale page runs to 11,000px, and its later sections hold the faults the early ones don't. */
const stopsFor = (route) => (route.startsWith('sale/') ? 14 : STOPS)

/** Rows of one table sharing different column widths means something got into the table's flow. */
const tableLayouts = () => {
  const rows = [...document.querySelectorAll('tr[data-sro-card]')]
  return new Set(rows.map((r) => [...r.children].filter((c) => c.tagName === 'TD').map((c) => Math.round(c.getBoundingClientRect().width)).join())).size
}

/** Prices pushed past their card's edge. Our column changes can do this without overlapping anything. */
/** Search rows: words share one left edge, with or without a flag, and never lose their ends. */
const searchLabels = () => {
  const lines = [...document.querySelectorAll('.sro-slot .sro-line')].filter((l) => l.getClientRects().length)
  const edges = new Set()
  for (const l of lines) {
    const text = [...l.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)
    if (!text) continue
    const range = document.createRange()
    range.selectNodeContents(text)
    edges.add(Math.round(range.getBoundingClientRect().left))
  }
  const sorted = [...edges].sort((x, y) => x - y)
  return { spread: sorted.length ? sorted.at(-1) - sorted[0] : 0, cut: lines.filter((l) => l.scrollWidth > l.clientWidth).map((l) => l.textContent) }
}

/** A frame hugs the tile: a price bar narrower than its frame means the frame took in the slot's margin. */
const wideFrames = () =>
  [...document.querySelectorAll('[data-sro-highlight]')].flatMap((card) => {
    const bar = card.querySelector('[class*="CapsuleBottomBar"]')
    if (!bar?.getClientRects().length) return []
    const style = getComputedStyle(card)
    const c = card.getBoundingClientRect()
    // A carousel's off-screen slide has not loaded its lazy art, so its tile has no size yet. Its frame
    // is measured again when the art loads, as the slide comes into view: judge only what a reader sees.
    if (c.left < 0 || c.right > innerWidth || c.bottom < 0 || c.top > innerHeight) return []
    const b = bar.getBoundingClientRect()
    const left = c.left + (parseFloat(style.getPropertyValue('--sro-frame-left')) || 0)
    const right = c.right - (parseFloat(style.getPropertyValue('--sro-frame-right')) || 0)
    return Math.abs(b.left - left) > 2 || Math.abs(right - b.right) > 2 ? [card.textContent.trim().slice(0, 30)] : []
  })

/**
 * Tile faults, from what a reader sees rather than how we chose the box:
 *  - a frame that stops at the art, with the price bar under it left outside;
 *  - a card holding a section heading (a whole sale section became one game's card);
 *  - a visible game tile with no card (a claim lost while Steam built the row around it);
 *  - an inline label flush against the price beside it, or against the card's edge.
 */
const tileFaults = () => {
  const out = []
  const name = (el) => (el.querySelector('a[href*="/app/"]')?.getAttribute('href') ?? '').match(/app\/\d+\/([^/?#]*)/)?.[1]?.slice(0, 28) ?? (el.textContent ?? '').trim().slice(0, 28)
  const onScreen = (r) => r.width && r.bottom > 0 && r.top < innerHeight
  for (const card of document.querySelectorAll('[data-sro-card]')) {
    const r = card.getBoundingClientRect()
    if (!onScreen(r)) continue
    if (card.querySelector('[class*="SectionHeader"], [class*="SectionLabel"]')) out.push(`card holds a section heading: ${name(card)}`)
    const bar = card.querySelector('[class*="CapsuleBottomBar"]')
    if (card.dataset.sroHighlight && bar?.getClientRects().length) {
      const st = getComputedStyle(card)
      const o = (side) => parseFloat(st.getPropertyValue(`--sro-frame-${side}`)) || 0
      const b = bar.getBoundingClientRect()
      if (b.top < r.top + o('top') - 2 || b.bottom > r.bottom - o('bottom') + 2 || b.left < r.left + o('left') - 2 || b.right > r.right - o('right') + 2) out.push(`price bar outside the frame: ${name(card)}`)
    }
    const badge = card.querySelector('.sro-badge:not(.sro-corner, .sro-compact)')
    if (badge && bar) {
      const a = badge.getBoundingClientRect()
      const before = [...bar.querySelectorAll('*')]
        .filter((e) => !e.children.length && e.textContent?.trim() && !e.closest('.sro-badge'))
        .map((e) => e.getBoundingClientRect())
        .filter((q) => q.width && q.top < a.bottom && q.bottom > a.top && q.left < a.left)
      const gap = before.length ? Math.min(...before.map((q) => a.left - q.right)) : Infinity
      if (gap < 4) out.push(`label flush against the price (${Math.round(gap)}px): ${name(card)}`)
      // The frame's border sits on the card's edge: a label running up to it reads as cut off
      const edge = Math.round(r.right - a.right)
      if (edge < 4 && edge > -2) out.push(`label flush against the card's edge (${edge}px): ${name(card)}`)
      const floor = Math.round(r.bottom - a.bottom)
      if (floor < 2 && floor > -2) out.push(`label on the card's bottom edge (${floor}px): ${name(card)}`)
    }
  }
  for (const a of document.querySelectorAll('a[href*="/app/"]')) {
    const q = a.getBoundingClientRect()
    if (q.width < 100 || q.height < 80 || !onScreen(q) || !a.querySelector('img') || a.closest('[data-sro-card], #global_hover, .hover_body')) continue
    out.push(`game tile without a card: ${name(a.parentElement ?? a)}`)
  }
  return out
}

const lostPrices = () => {
  const lost = []
  for (const card of document.querySelectorAll('[data-sro-card]')) {
    const r = card.getBoundingClientRect()
    if (!r.width || r.bottom < 0 || r.top > innerHeight || r.left < 0 || r.right > innerWidth) continue
    for (const el of card.querySelectorAll('[class*="price" i]')) {
      if (el.children.length || !(el.textContent || '').trim()) continue
      const q = el.getBoundingClientRect()
      if (q.width && q.right > r.right + 1) lost.push(`${el.textContent.trim().slice(0, 14)} past ${(card.className + '').slice(0, 24)}`)
    }
  }
  return lost
}

const settings = { mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 6 }
const faults = new Map()
let checked = 0

for (const font of fonts) {
  const prefs = { 'browser.zoom.siteSpecific': false, 'font.minimum-size.x-western': font }
  const ctx = await launch(browser, { extension: true, settings, viewport: { width: widths[0], height: 1000 }, prefs })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  for (const width of widths) {
    const where = `${width}px, min font ${font}`
    await page.setViewportSize({ width, height: 1000 })
    for (const route of pages) {
      await page.goto(STORE + route, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {})
      const cards = await waitForOverlay(page)
      if (cards === null) {
        faults.set(`${route}|not-run`, `${where} /${route}: the overlay never ran on this page`)
        continue
      }
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let i = 0, y = 0; i < stopsFor(route) && y < height; i++, y += 900) {
        await page.evaluate((top) => scrollTo(0, top), y)
        await page.waitForTimeout(700)
        for (const name of await page.evaluate(wideFrames)) faults.set(`${route}|wide|${name}`, `${where} /${route}: frame wider than its tile: ${name}`)
        for (const tile of await page.evaluate(tileFaults)) faults.set(`${route}|tile|${tile}`, `${where} /${route}: ${tile}`)
        for (const price of await page.evaluate(lostPrices)) faults.set(`${route}|price|${price}`, `${where} /${route}: price-lost: ${price}`)
        const { issues } = await page.evaluate(CHECKS)
        for (const issue of issues.filter((x) => FAULTS.test(x.kind))) {
          const key = `${route}|${issue.kind}|${issue.name}|${issue.with ?? ''}`
          if (!faults.has(key)) faults.set(key, `${where} /${route}: ${issue.kind}: ${issue.name ?? ''} ${issue.badge ? `"${issue.badge}"` : ''} ${issue.with ? `over "${issue.with}"` : ''}`)
        }
      }
      const { spread, cut } = await page.evaluate(searchLabels)
      if (spread > 1) faults.set(`${route}|edges`, `${where} /${route}: search labels start ${spread}px apart`)
      for (const text of cut) faults.set(`${route}|cut|${text}`, `${where} /${route}: search label cut off: ${text}`)
      const layouts = await page.evaluate(tableLayouts)
      if (layouts > 1) faults.set(`${route}|layouts`, `${where} /${route}: table rows split into ${layouts} column layouts`)
      checked++
      console.log(`${where} /${route}: ${cards} cards, ${faults.size} faults so far`)
    }
  }
  await ctx.close()
}

for (const fault of faults.values()) console.log(`FAIL ${fault}`)
console.log(`checked ${checked} page loads: ${faults.size} faults`)
process.exit(faults.size ? 1 : 0)
