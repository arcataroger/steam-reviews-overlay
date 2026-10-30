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
await shot(search, 'extra-search-dim')

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
await shot(comp, '4-popup')

await apply(OFF)
await ctx.close()

// The popup on its own: rendered at 2× in a second profile, scaled to fit, with a caption per control.
const hi = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: 340, height: 600 }, deviceScaleFactor: 2, locale: 'en-US' })
const hp = await hi.newPage()
await hp.goto(POPUP); await hp.waitForTimeout(400)
await hp.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: both }); await hp.reload(); await hp.waitForTimeout(800)
// No Steam tab is open here, so drop the "open a store page" notice the popup would show.
await hp.evaluate(() => { document.body.classList.remove('has-notice'); document.getElementById('status').hidden = true })
await hp.waitForTimeout(300)
const uiH = await hp.evaluate(() => Math.ceil(document.querySelector('.panel-wrap').getBoundingClientRect().bottom))
const ui = (await hp.screenshot({ clip: { x: 0, y: 0, width: 340, height: uiH } })).toString('base64')
const scale = Math.min(1.25, 720 / uiH)
const cap = (title, text) => `<div class="cap"><h2>${title}</h2><p>${text}</p></div>`
await hp.setViewportSize({ width: W, height: H })
await hp.goto('about:blank')
await hp.setContent(`<style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:"Motiva Sans",Arial,Helvetica,sans-serif;
    background:radial-gradient(ellipse at 70% 40%,#2a475e 0%,#1b2838 55%,#171a21 100%);color:#c7d5e0}
  .wrap{display:flex;align-items:center;justify-content:center;gap:72px;height:100%}
  .caps{width:520px;display:flex;flex-direction:column;gap:30px}
  h1{margin:0 0 6px;font-size:40px;color:#fff;font-weight:600;letter-spacing:.2px}
  .cap h2{margin:0 0 6px;font-size:22px;color:#66c0f4;font-weight:600}
  .cap p{margin:0;font-size:18px;line-height:1.45;color:#acb2b8}
  img{width:${Math.round(340 * scale)}px;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.08)}</style>
  <div class="wrap"><div class="caps"><h1>Two levers, nine tiers</h1>
    ${cap('Filter', 'Dim or hide every game at or below a tier.')}
    ${cap('Highlight', 'Outline every game at or above a tier, in its review color.')}
    ${cap('Your language or all', 'Judge by reviews in your Steam language, or in every language.')}
    ${cap("Steam's own rules", 'Each notch shows the percent and review count Steam requires.')}
  </div><img src="data:image/png;base64,${ui}"></div>`)
await hp.waitForTimeout(400)
await hp.screenshot({ path: path.join(out, '5-popup-ui.png'), scale: 'css' }); console.log('   5-popup-ui')
await hi.close()
console.log('wrote', out)
