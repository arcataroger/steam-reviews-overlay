import { chromium } from 'playwright'
import path from 'node:path'
import crypto from 'node:crypto'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const out = process.argv[2]
// Chrome derives unpacked extension ids from the SHA-256 of the absolute path, hex→a-p.
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('')
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--window-size=1400,1000'],
  viewport: { width: 1400, height: 1000 }, locale: 'en-US',
})
const popup = await ctx.newPage()
await popup.goto(`chrome-extension://${id}/src/popup/index.html`)
await popup.waitForTimeout(500)
await popup.setViewportSize({ width: 340, height: 720 })
await popup.screenshot({ path: `${out}/popup_default.png` })

const store = await ctx.newPage()
await store.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' })
await store.waitForTimeout(7000)

async function setMode(mode, threshold) {
  await popup.bringToFront()
  await popup.click(`button[data-mode="${mode}"]`)
  if (mode !== "label") await popup.click(`.notch[data-pct="${threshold}"] span`)
  await popup.waitForTimeout(400)
  await popup.screenshot({ path: `${out}/popup_${mode}.png` })
}
for (const mode of ['dim', 'hide']) {
  await setMode(mode, 80)
  await store.bringToFront()
  await store.waitForTimeout(1200)
  const st = await store.evaluate(() => ({
    dim: document.querySelectorAll('[data-sro-filtered="dim"]').length,
    hide: document.querySelectorAll('[data-sro-filtered="hide"]').length,
    hiding: document.querySelectorAll('[data-sro-filtered="hiding"]').length,
    badges: document.querySelectorAll('.sro-badge').length,
  }))
  console.log(mode, JSON.stringify(st))
  await store.screenshot({ path: `${out}/store_${mode}.png` })
}
await setMode('label', 40)
await store.waitForTimeout(500)
console.log('label', JSON.stringify(await store.evaluate(() => document.querySelectorAll('[data-sro-filtered]').length)))
await ctx.close()
