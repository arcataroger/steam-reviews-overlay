// Screenshot matrix: popup states, locales, mobile layout, and store pages under each mode.
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const POPUP = `chrome-extension://${id}/src/popup/index.html`
const KEY = 'sro:settings:v4'
const args = [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--window-size=1400,1000']
const base = { mode: 'dim', threshold: 0, source: 'global', highlightThreshold: 10 }
const STATES = {
  parked:            { ...base },
  dim_mixed:         { ...base, mode: 'dim', threshold: 5 },
  hide_verypositive: { ...base, mode: 'hide', threshold: 8 },
  outline_op:        { ...base, highlightThreshold: 9 },
  both:              { ...base, mode: 'dim', threshold: 6, highlightThreshold: 9 },
  my_language:       { ...base, mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 8 },
}
const manifest = []
async function shot(page, name, opts = {}) { const file = `${name}.png`; await page.screenshot({ path: path.join(out, file), ...opts }); manifest.push({ name, file }); console.log('  ', file) }

const ctx = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: 1400, height: 1000 }, locale: 'en-US' })
const popup = await ctx.newPage()
await popup.goto(POPUP); await popup.waitForTimeout(400)
const apply = async (s) => { await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: s }); await popup.waitForTimeout(150) }

// Store page first so settings changes apply live
const store = await ctx.newPage()
await store.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' })
await store.waitForTimeout(6000)
const front = await ctx.newPage()
await front.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
await front.waitForTimeout(6000); await front.mouse.wheel(0, 1500); await front.waitForTimeout(2500)

console.log('popup states')
await popup.setViewportSize({ width: 340, height: 760 })
for (const [name, s] of Object.entries(STATES)) {
  await apply(s); await popup.reload(); await popup.waitForTimeout(400)
  await shot(popup, `popup_${name}`)
}
// status banners
await popup.evaluate(() => chrome.storage.local.set({ 'sro:status:v1': { kind: 'rate', ts: Date.now(), lastOk: Date.now() - 60000 } }))
await popup.bringToFront(); await popup.reload(); await popup.waitForTimeout(400)
await shot(popup, 'popup_status_ratelimited')
await popup.evaluate(() => chrome.storage.local.set({ 'sro:status:v1': { kind: 'offline', ts: Date.now(), lastOk: Date.now() - 60000 } }))
await popup.reload(); await popup.waitForTimeout(400)
await shot(popup, 'popup_status_offline')
await popup.evaluate(() => chrome.storage.local.set({ 'sro:status:v1': { kind: 'ok', ts: Date.now(), lastOk: Date.now() } }))

console.log('locales')
await apply(STATES.both)
for (const loc of ['de', 'ja', 'zh_CN', 'ru', 'fr', 'ko', 'pt_BR', 'ar']) {
  await popup.goto(`${POPUP}?locale=${loc}`); await popup.waitForTimeout(500)
  await shot(popup, `popup_locale_${loc}`)
}
await popup.goto(POPUP)

console.log('store pages')
const storeStates = { labels_only: STATES.parked, dim_mixed: STATES.dim_mixed, hide_verypositive: STATES.hide_verypositive, outline_verypositive: { ...base, highlightThreshold: 8 }, both: STATES.both }
for (const [name, s] of Object.entries(storeStates)) {
  await apply(s)
  await store.bringToFront(); await store.waitForTimeout(900)
  await shot(store, `search_${name}`, { clip: { x: 80, y: 330, width: 900, height: 620 } })
  await front.bringToFront(); await front.waitForTimeout(900)
  await shot(front, `front_${name}`, { clip: { x: 80, y: 0, width: 1240, height: 1000 } })
}
await apply(STATES.parked)
await ctx.close()

console.log('mobile')
const mob = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'en-US' })
const mp = await mob.newPage()
await mp.evaluate(() => {}) // warm
await mp.goto(POPUP); await mp.waitForTimeout(300)
await mp.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: STATES.both }); await mp.reload(); await mp.waitForTimeout(500)
await shot(mp, 'popup_mobile_360')
const ms = await mob.newPage()
await ms.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' }); await ms.waitForTimeout(6000)
await shot(ms, 'search_mobile_360')
await mob.close()
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1))
console.log('done', manifest.length)
