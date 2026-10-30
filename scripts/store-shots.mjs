// Store listing screenshots: 1280×800 PNGs (Chrome Web Store's size; AMO takes the same ratio).
// Live Steam pages with the Chrome build loaded, plus one with the popup laid over the page.
// Usage: npm run build:chrome && node scripts/store-shots.mjs [outDir]
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
const out = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '..', 'docs', 'store', 'screenshots'))
fs.mkdirSync(out, { recursive: true })
const POPUP = `chrome-extension://${id}/src/popup/index.html`
const KEY = 'sro:settings:v4'
const W = 1280, H = 800
const args = [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', `--window-size=${W},${H}`]
const OFF = { mode: 'dim', threshold: 0, source: 'global', highlightThreshold: 10 }

const ctx = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: W, height: H }, locale: 'en-US' })
const popup = await ctx.newPage()
await popup.goto(POPUP); await popup.waitForTimeout(400)
const apply = async (s) => { await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: s }); await popup.waitForTimeout(1200) }
const shot = async (page, name) => { await page.bringToFront(); await page.waitForTimeout(800); await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log('  ', name) }

const open = async (url, scrollTo) => {
  const p = await ctx.newPage()
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(6000)
  if (scrollTo) await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), scrollTo)
  await p.waitForTimeout(2500)
  return p
}
const search = await open('https://store.steampowered.com/search/?term=racing', '#search_resultsRows')
await search.evaluate(() => window.scrollBy(0, -60))
const front = await open('https://store.steampowered.com/', '.home_page_content .tab_container, #tab_newreleases_content, .home_tabs_row')

await apply(OFF)
await shot(search, '1-search-labels')
await shot(front, '2-front-labels')
await apply({ ...OFF, highlightThreshold: 8 })
await shot(search, '3-search-outline')
await apply({ ...OFF, mode: 'dim', threshold: 6 })
await shot(search, '4-search-dim')

// The popup over the page, where the toolbar would drop it.
const both = { ...OFF, mode: 'dim', threshold: 6, highlightThreshold: 9 }
await apply(both)
await search.bringToFront(); await search.waitForTimeout(800)
const page = (await search.screenshot()).toString('base64')
await popup.setViewportSize({ width: 340, height: 600 }); await popup.reload(); await popup.waitForTimeout(600)
const pop = (await popup.screenshot({ fullPage: true })).toString('base64')
const comp = await ctx.newPage()
await comp.setViewportSize({ width: W, height: H })
await comp.setContent(`<style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  .bg{position:absolute;inset:0;width:${W}px;height:${H}px}
  .pop{position:absolute;top:24px;right:32px;width:340px;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}</style>
  <img class="bg" src="data:image/png;base64,${page}"><img class="pop" src="data:image/png;base64,${pop}">`)
await comp.waitForTimeout(300)
await shot(comp, '5-popup')

await apply(OFF)
await ctx.close()
console.log('wrote', out)
