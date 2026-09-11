// Loads pages with the extension and classifies GetItems traffic:
//   steam   = the store's own calls
//   replay  = our replays of those URLs (should be served from cache, no network)
//   own     = our own batch calls (sro=1), for ids Steam didn't ask about
import { chromium } from 'playwright'
import path from 'node:path'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const urls = process.argv.slice(2)
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--window-size=1400,1000'],
  viewport: { width: 1400, height: 1000 }, locale: 'en-US',
})
for (const url of urls) {
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable')
  const seen = new Map()
  cdp.on('Network.requestWillBeSent', (e) => { if (e.request.url.includes('GetItems')) seen.set(e.requestId, { url: e.request.url }) })
  cdp.on('Network.responseReceived', (e) => { const r = seen.get(e.requestId); if (r) { r.disk = e.response.fromDiskCache; r.mem = e.response.fromMemoryCache; r.status = e.response.status } })
  page.on('console', (m) => { if (m.text().includes('SRO')) console.log('console:', m.text()) })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(1200) }
  await page.waitForTimeout(2500)
  const st = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sro-badge')]
    return { cards: document.querySelectorAll('[data-sro-card]').length, badges: b.length }
  })
  const all = [...seen.values()]
  const own = all.filter(r => r.url.includes('sro=1'))
  const rest = all.filter(r => !r.url.includes('sro=1'))
  const byUrl = new Map(); for (const r of rest) byUrl.set(r.url, (byUrl.get(r.url) || []).concat(r))
  let steam = 0, replayCached = 0, replayNet = 0
  for (const rs of byUrl.values()) { steam++; for (const r of rs.slice(1)) (r.disk || r.mem) ? replayCached++ : replayNet++ }
  const ownIds = own.map(r => { const b = atob(decodeURIComponent(r.url.split('input_protobuf_encoded=')[1])); return (b.match(/\x0a[\x02-\x06]\x08/g) || []).length })
  console.log(url, `\n  steam's own calls: ${steam}  our cache replays: ${replayCached} (network: ${replayNet})  our own batch calls: ${own.length} [ids: ${ownIds.join(',')}]\n  ${JSON.stringify(st)}`)
  await page.close()
}
await ctx.close()
