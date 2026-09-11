// Visual QA harness: loads each URL with the built extension in two settings states, scrolls
// through the page, screenshots every viewport, and runs mechanical checks on every badge/card.
// Usage: node scripts/visual-pass.mjs <outdir> <url> [url...]
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
const ext = process.env.SRO_EXT_DIR ? path.resolve(process.env.SRO_EXT_DIR) : path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
const [out, ...urls] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const KEY = 'sro:settings:v4'
const STATES = {
  labels: { mode: 'dim', threshold: 0, source: 'global', highlightThreshold: 10 },
  active: { mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 7 },
}
const slug = (u) => u.replace(/^https?:\/\/store\.steampowered\.com\/?/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'

const CHECKS = () => {
  const inter = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
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
      // collision with any other text-bearing leaf element in the card (excluding our own badge subtree)
      for (const el of card.querySelectorAll('*')) {
        if (b.contains(el) || el.contains(b)) continue
        if (el.children.length) continue
        const t = (el.textContent || '').trim(); if (!t) continue
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0') continue
        const er = el.getBoundingClientRect(); if (!er.width || !er.height) continue
        if (inter(br, er)) { issues.push({ kind: 'badge-overlaps-text', name, badge: b.textContent.trim().slice(0, 30), with: t.slice(0, 30), cls: el.className?.toString().slice(0, 40) }); break }
      }
    }
    // Steam's own summary present but our badge is a plain single label → duplicate meaning
    const native = [...card.querySelectorAll('[class*="review" i]:not(.sro-badge)')].some(e => (e.textContent || '').trim() && /Positive|Negative|Mixed/.test(e.textContent || ''))
    if (native && badges.some(b => b.querySelectorAll('.sro-line').length === 1 && !b.classList.contains('sro-beside-native'))) issues.push({ kind: 'plain-badge-beside-native', name })
    // highlight drawn without a shape (unsized at decision time and never re-derived)
    if (card.dataset.sroHighlight && !card.dataset.sroShape) issues.push({ kind: 'highlight-without-shape', name })
  }
  // capsule rows must stay uniform in size
  const rows = new Map()
  for (const c of cards) { const p = c.parentElement; if (!p) continue; if (!rows.has(p)) rows.set(p, []); rows.get(p).push(c) }
  for (const [p, cs] of rows) {
    if (cs.length < 3) continue
    const sizes = new Set(cs.map(c => { const r = c.getBoundingClientRect(); return r.width && r.height ? `${Math.round(r.width)}x${Math.round(r.height)}` : null }).filter(Boolean))
    if (sizes.size > 1 && cs.some(c => /capsule/.test(c.className.toString()))) issues.push({ kind: 'uneven-capsule-row', sizes: [...sizes], where: p.id || p.className.toString().slice(0, 40) })
  }
  return { cards: cards.length, badges: document.querySelectorAll('.sro-badge').length, highlighted: document.querySelectorAll('[data-sro-highlight]').length, filtered: document.querySelectorAll('[data-sro-filtered]').length, issues }
}

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
    for (let stop = 0; stop < (Number(process.env.SRO_STOPS) || 8); stop++) {
      await page.waitForTimeout(stop === 0 ? 2000 : 1400)
      const r = await page.evaluate(CHECKS)
      const file = `${slug(url)}__${stateName}__${stop}.png`
      await page.screenshot({ path: path.join(out, file) })
      const fresh = r.issues.filter(i => { const k = JSON.stringify(i); if (seenIssues.has(k)) return false; seenIssues.add(k); return true })
      entry.stops.push({ stop, file, cards: r.cards, badges: r.badges, highlighted: r.highlighted, filtered: r.filtered, issues: fresh })
      const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 5)
      if (atEnd) break
      await page.mouse.wheel(0, 900)
    }
    report.push(entry)
    console.log(`${slug(url)} [${stateName}]: ${entry.stops.length} stops, ${entry.stops.reduce((n, s) => n + s.issues.length, 0)} issues, ${errors.length} console errors`)
    await ctx.close()
  }
}
fs.writeFileSync(path.join(out, `report_${Date.now()}.json`), JSON.stringify(report, null, 1))
