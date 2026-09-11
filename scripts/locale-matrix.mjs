// Every Steam language × every screen: popup, desktop search, mobile search (+ front page for a few).
// Each shot is checked automatically: text overflow in the popup, badge/price/icon overlap on store rows.
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const only = process.argv[3]?.split(',')
const LOCALES = { en: 'english', zh_CN: 'schinese', zh_TW: 'tchinese', ja: 'japanese', ko: 'koreana', ru: 'russian', de: 'german', fr: 'french', es: 'spanish', es_419: 'latam', pt_BR: 'brazilian', pt_PT: 'portuguese', it: 'italian', pl: 'polish', tr: 'turkish', th: 'thai', vi: 'vietnamese', uk: 'ukrainian', nl: 'dutch', sv: 'swedish', da: 'danish', no: 'norwegian', fi: 'finnish', cs: 'czech', hu: 'hungarian', ro: 'romanian', bg: 'bulgarian', el: 'greek', id: 'indonesian', ar: 'arabic' }
const FRONT = new Set(['en', 'de', 'ja', 'ru', 'zh_CN', 'ar'])
const args = [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new']
const SETTINGS = { 'sro:settings:v4': { mode: 'dim', threshold: 6, source: 'local', highlightThreshold: 9 } }
const report = []
const rowCheck = () => [...document.querySelectorAll('.search_result_row')].filter(r => {
  const b = r.querySelector('.sro-badge'); if (!b) return false
  let a = b.getBoundingClientRect()
  // an inline badge inside an overflow:hidden column is clipped: measure only the visible part
  const col = r.querySelector('.search_reviewscore')
  if (col && getComputedStyle(col).overflow === 'hidden') { const c = col.getBoundingClientRect(); a = { left: Math.max(a.left, c.left), right: Math.min(a.right, c.right), top: a.top, bottom: a.bottom } }
  const others = [r.querySelector('.search_price_discount_combined'), ...r.querySelectorAll('.platform_img'), r.querySelector('.search_released')].filter(o => o && getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden')
  const overlaps = others.some(o => { const c = o.getBoundingClientRect(); return c.width > 0 && a.left < c.right - 1 && a.right > c.left + 1 && a.top < c.bottom - 1 && a.bottom > c.top + 1 })
  return overlaps
}).map(r => r.querySelector('.title')?.textContent.trim().slice(0, 30))
const popupCheck = () => [...document.querySelectorAll('.switch, .tier, .notch span, .seg button, .plate-title, .detent span')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className + ':' + e.textContent.trim().slice(0, 25))

for (const [loc, steam] of Object.entries(LOCALES)) {
  if (only && !only.includes(loc)) continue
  const entry = { loc, steam, problems: [] }
  const cookies = [{ name: 'Steam_Language', value: steam, domain: '.steampowered.com', path: '/' }]
  // desktop
  const ctx = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: 1400, height: 1000 } })
  await ctx.addCookies(cookies)
  const pop = await ctx.newPage(); await pop.goto(`chrome-extension://${id}/src/popup/index.html`)
  await pop.evaluate((o) => chrome.storage.sync.set(o), SETTINGS)
  await pop.setViewportSize({ width: 340, height: 760 })
  await pop.goto(`chrome-extension://${id}/src/popup/index.html?locale=${loc}`); await pop.waitForTimeout(500)
  await pop.screenshot({ path: `${out}/${loc}_popup.png` })
  const po = await pop.evaluate(popupCheck); if (po.length) entry.problems.push({ popup: po })
  const s = await ctx.newPage()
  await s.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' }); await s.waitForTimeout(6000)
  await s.screenshot({ path: `${out}/${loc}_search.png`, clip: { x: 80, y: 330, width: 900, height: 480 } })
  const so = await s.evaluate(rowCheck); if (so.length) entry.problems.push({ search: so })
  if (FRONT.has(loc)) {
    const f = await ctx.newPage(); await f.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' }); await f.waitForTimeout(6000)
    await f.mouse.wheel(0, 1500); await f.waitForTimeout(2500)
    await f.screenshot({ path: `${out}/${loc}_front.png`, clip: { x: 80, y: 0, width: 1240, height: 700 } })
  }
  await ctx.close()
  // mobile
  const mob = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })
  await mob.addCookies(cookies)
  const m = await mob.newPage(); await m.goto(`chrome-extension://${id}/src/popup/index.html`); await m.evaluate((o) => chrome.storage.sync.set(o), SETTINGS)
  await m.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' }); await m.waitForTimeout(6000)
  await m.screenshot({ path: `${out}/${loc}_mobile.png`, fullPage: true, clip: { x: 0, y: 700, width: 360, height: 760 } })
  const mo = await m.evaluate(rowCheck); if (mo.length) entry.problems.push({ mobile: mo })
  await mob.close()
  report.push(entry)
  console.log(loc.padEnd(6), entry.problems.length ? JSON.stringify(entry.problems) : 'ok')
}
fs.writeFileSync(`${out}/report_${only ? only.join('-') : 'all'}.json`, JSON.stringify(report, null, 1))
