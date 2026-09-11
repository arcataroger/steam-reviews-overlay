// Loads pages with the extension and counts review-related requests + badge results.
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
  const reqs = []
  page.on('request', (r) => { const u = r.url(); if (u.includes('GetItems') || u.includes('/appreviews/')) reqs.push(u) })
  page.on('console', (m) => { if (m.text().includes('SRO')) console.log('console:', m.text()) })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(1200) }
  await page.waitForTimeout(2500)
  const st = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sro-badge')]
    return { cards: document.querySelectorAll('[data-sro-card]').length, badges: b.length,
      sample: b.slice(0, 5).map(x => `${[...x.querySelectorAll('.sro-line')].map(l => l.textContent).join(' | ')} pct=${x.dataset.sroPct ?? '-'} score=${x.dataset.sroScore}`) }
  })
  const ours = reqs.filter(u => u.includes('input_protobuf_encoded'))
  console.log(url, '\n  requests by extension (protobuf GetItems):', ours.length, ' other GetItems/appreviews (Steam itself):', reqs.length - ours.length,
    '\n  ids per request:', ours.map(u => { const b = atob(decodeURIComponent(u.split('input_protobuf_encoded=')[1])); return (b.match(/\x0a[\x02-\x06]\x08/g) || []).length }).join(','),
    '\n ', JSON.stringify(st))
  await page.close()
}
await ctx.close()
