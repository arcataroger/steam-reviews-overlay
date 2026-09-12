// Visual QA harness: loads each URL with the built extension in two settings states, scrolls
// through the page, screenshots every viewport, and runs mechanical checks on every badge/card.
// Usage: node scripts/visual-pass.mjs <outdir> <url> [url...]
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
const ext = process.env.SRO_EXT_DIR ? path.resolve(process.env.SRO_EXT_DIR) : path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
// Importing this file (the mechanical checks are exercised against a live page by their own
// positive control) must not start a capture run.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const [out, ...urls] = isMain ? process.argv.slice(2) : []
if (isMain) fs.mkdirSync(out, { recursive: true })
const KEY = 'sro:settings:v4'
const STATES = {
  labels: { mode: 'dim', threshold: 0, source: 'global', highlightThreshold: 10 },
  active: { mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 7 },
}
const slug = (u) => u.replace(/^https?:\/\/store\.steampowered\.com\/?/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'

export const CHECKS = () => {
  const inter = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
  // Stage 1 sidecar: normalise --sro-hl (almost always already a literal #hex, but be defensive
  // about rgb()/color(srgb ...) forms a browser could hand back from getComputedStyle).
  const normalizeHexColor = (raw) => {
    const s = (raw || '').trim()
    if (!s) return null
    let m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s)
    if (m) {
      let hex = m[1].toLowerCase()
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
      return '#' + hex
    }
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s)
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Math.round(parseFloat(v)))))
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    }
    m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(s)
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Math.round(parseFloat(v) * 255))))
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    }
    return null
  }
  const issues = []
  const cards = [...document.querySelectorAll('[data-sro-card]')]
  for (const card of cards) {
    const cr = card.getBoundingClientRect()
    if (!cr.width || !cr.height) continue
    if (cr.bottom < 0 || cr.top > innerHeight) continue // only what's on screen for this stop
    const badges = [...card.querySelectorAll('.sro-badge')]
    const name = (card.querySelector('.title, .tab_item_name, [class*="title" i]')?.textContent || card.getAttribute('href') || '').trim().slice(0, 40)
    if (badges.length > 1) issues.push({ kind: 'duplicate-badge', name, count: badges.length })
    for (const b of badges) {
      const br = b.getBoundingClientRect()
      if (!br.width) continue
      if (br.left < cr.left - 2 || br.right > cr.right + 2 || br.top < cr.top - 2 || br.bottom > cr.bottom + 2) issues.push({ kind: 'badge-outside-card', name, badge: b.textContent.trim().slice(0, 30) })
      // Collision with any other text in the card, measured the way a reader sees it: the glyph
      // boxes from each text node's range, not the element's box. A block element is routinely far
      // wider than the words inside it, so element boxes touch when nothing visibly overlaps —
      // every such flag on a category page proved false when the glyphs were measured. Text painted
      // in a fully transparent colour is not text either.
      for (const el of card.querySelectorAll('*')) {
        if (b.contains(el) || el.contains(b)) continue
        if (el.children.length) continue
        const t = (el.textContent || '').trim(); if (!t) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.opacity === '0' || /rgba\(\d+, \d+, \d+, 0\)$/.test(cs.color)) continue
        const er = el.getBoundingClientRect(); if (!er.width || !er.height) continue
        if (!inter(br, er)) continue
        let glyphHit = false
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n && !glyphHit; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(n)
          for (const g of range.getClientRects()) if (g.width && g.height && inter(br, g)) glyphHit = true
        }
        if (glyphHit) { issues.push({ kind: 'badge-overlaps-text', name, badge: b.textContent.trim().slice(0, 30), with: t.slice(0, 30), cls: el.className?.toString().slice(0, 40) }); break }
      }
    }
    // Steam's own summary present but our badge is a plain single label → duplicate meaning.
    // Read the candidate's text with our own badges stripped out: search rows put our badge INSIDE
    // Steam's review column, whose class contains "review", so the check was reading our own label
    // back and flagging every row on the page.
    const ownText = (e) => {
      const clone = e.cloneNode(true)
      clone.querySelectorAll('.sro-badge').forEach((n) => n.remove())
      return (clone.textContent || '').trim()
    }
    const native = [...card.querySelectorAll('[class*="review" i]:not(.sro-badge)')].some(e => /Positive|Negative|Mixed/.test(ownText(e)))
    if (native && badges.some(b => b.querySelectorAll('.sro-line').length === 1 && !b.classList.contains('sro-beside-native'))) issues.push({ kind: 'plain-badge-beside-native', name })
    // highlight drawn without a shape (unsized at decision time and never re-derived)
    if (card.dataset.sroHighlight && !card.dataset.sroShape) issues.push({ kind: 'highlight-without-shape', name })
  }
  // "A label must never change a card's size" used to be checked here by comparing sibling capsules
  // to each other, which cannot tell our effect from Steam's own layout: its hero carousel has
  // uneven slides by design, so this flagged the same pages every round and never found anything.
  // scripts/check-sizes.mjs answers the real question by loading the page with and without the
  // extension and comparing every box Steam draws.
  // Stage 1 sidecar: one record per card with non-zero area (independent of the on-screen filter
  // above — Stage 2 decides what to crop via `fullyVisible`, so off-screen cards are kept too).
  const sroCards = []
  for (const card of cards) {
    const cr = card.getBoundingClientRect()
    if (!cr.width || !cr.height) continue
    const appid = Number(card.getAttribute('data-sro-card'))
    const title = (card.querySelector('.title, .tab_item_name, [class*="title" i]')?.textContent || '').trim()
    const score = Number(card.dataset.sroScore || 0)
    const tone = card.dataset.sroTone || null
    const label = (card.querySelector('.sro-badge')?.textContent || '').trim()
    const filtered = card.dataset.sroFiltered || null
    const highlight = card.dataset.sroHighlight || null
    const shape = card.dataset.sroShape || null
    const axis = card.dataset.sroAxis || null
    const op = !!card.dataset.sroOp
    const color = highlight ? normalizeHexColor(getComputedStyle(card).getPropertyValue('--sro-hl')) : null
    const rect = { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) }
    const fullyVisible = rect.x >= 16 && rect.y >= 16 && rect.x + rect.w <= innerWidth - 16 && rect.y + rect.h <= innerHeight - 16
    // Steam's sticky category bar and its hover panels cover parts of cards that are still "visible"
    // by geometry. Probe just inside each edge: if the topmost element there isn't this card or one
    // of its descendants, something is painted over that edge and its pixels can't be judged.
    const covered = (x, y) => {
      const el = document.elementFromPoint(x, y)
      return !el || !(el === card || card.contains(el))
    }
    // Probe five points spread along each edge, not just its midpoint: Steam's hover panels and
    // dropdowns cover one end of a card while leaving the centre clear, and a single centre sample
    // called that edge judgeable. The fractions stay inside the 10px corner the checker skips.
    const FRACTIONS = [0.15, 0.325, 0.5, 0.675, 0.85]
    const anyCovered = (points) => points.some(([x, y]) => covered(x, y))
    const alongX = (yy) => FRACTIONS.map((f) => [cr.left + cr.width * f, yy])
    const alongY = (xx) => FRACTIONS.map((f) => [xx, cr.top + cr.height * f])
    const occluded = fullyVisible
      ? {
          top: anyCovered(alongX(cr.top + 2)),
          right: anyCovered(alongY(cr.right - 2)),
          bottom: anyCovered(alongX(cr.bottom - 2)),
          left: anyCovered(alongY(cr.left + 2)),
        }
      : { top: true, right: true, bottom: true, left: true }
    sroCards.push({ appid, title, rect, score, tone, label, filtered, highlight, shape, axis, color, op, fullyVisible, occluded })
  }
  return { cards: cards.length, badges: document.querySelectorAll('.sro-badge').length, highlighted: document.querySelectorAll('[data-sro-highlight]').length, filtered: document.querySelectorAll('[data-sro-filtered]').length, issues, sroCards, sroDpr: devicePixelRatio, sroViewport: { width: innerWidth, height: innerHeight } }
}

if (isMain) {
  const report = []
  for (const url of urls) {
    for (const [stateName, settings] of Object.entries(STATES)) {
      const ctx = await chromium.launchPersistentContext('', { headless: false, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new'], viewport: { width: 1400, height: 1000 }, locale: 'en-US' })
      const errors = []
      const pop = await ctx.newPage(); await pop.goto(`chrome-extension://${id}/src/popup/index.html`); await pop.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: settings })
      const page = await ctx.newPage()
      page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[SRO]')) errors.push(m.text().slice(0, 160)) })
      page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 160)))
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }) } catch (e) { report.push({ url, state: stateName, error: String(e).slice(0, 120) }); await ctx.close(); continue }
      await page.waitForTimeout(6000)
      const entry = { url, state: stateName, stops: [], errors }
      const seenIssues = new Set()
      // One flaky stop (a screenshot timing out under load) must not lose the whole run's report
      try {
        for (let stop = 0; stop < (Number(process.env.SRO_STOPS) || 8); stop++) {
          await page.waitForTimeout(stop === 0 ? 2000 : 1400)
          const r = await page.evaluate(CHECKS)
          const file = `${slug(url)}__${stateName}__${stop}.png`
          try {
            await page.screenshot({ path: path.join(out, file), timeout: 30000 })
          } catch (e) {
            entry.stops.push({ stop, file: null, shotError: String(e).slice(0, 100), issues: [] })
            continue
          }
          // Stage 1 sidecar: metadata for scripts/segment-cards.mjs, one per screenshot. Carousels
          // rotate and Steam recycles capsule nodes, so a record captured before the screenshot can
          // describe a different game than the pixels. Re-read after the shot and keep only cards
          // that are byte-identical in both reads: those provably did not move while it was taken.
          const after = await page.evaluate(CHECKS)
          const settled = new Map(after.sroCards.map((c) => [`${c.appid}@${c.rect.x},${c.rect.y}`, JSON.stringify(c)]))
          const stableCards = r.sroCards.filter((c) => settled.get(`${c.appid}@${c.rect.x},${c.rect.y}`) === JSON.stringify(c))
          fs.writeFileSync(path.join(out, file.replace(/\.png$/, '.cards.json')), JSON.stringify({
            url, slug: slug(url), state: stateName, stop,
            dpr: r.sroDpr, viewport: r.sroViewport,
            capturedCards: r.sroCards.length, stableCards: stableCards.length,
            cards: stableCards,
          }, null, 1))
          const fresh = r.issues.filter(i => { const k = JSON.stringify(i); if (seenIssues.has(k)) return false; seenIssues.add(k); return true })
          entry.stops.push({ stop, file, cards: r.cards, badges: r.badges, highlighted: r.highlighted, filtered: r.filtered, issues: fresh })
          const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 5)
          if (atEnd) break
          await page.mouse.wheel(0, 900)
        }
      } catch (e) {
        entry.error = String(e).slice(0, 160)
      }
      report.push(entry)
      console.log(`${slug(url)} [${stateName}]: ${entry.stops.length} stops, ${entry.stops.reduce((n, s) => n + s.issues.length, 0)} issues, ${errors.length} console errors${entry.error ? `, ERROR ${entry.error}` : ''}`)
      await ctx.close()
    }
  }
  fs.writeFileSync(path.join(out, `report_${Date.now()}.json`), JSON.stringify(report, null, 1))
}
