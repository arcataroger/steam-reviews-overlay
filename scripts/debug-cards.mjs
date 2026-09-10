import { chromium } from 'playwright'
import path from 'node:path'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const [out, url] = process.argv.slice(2)
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--window-size=1400,1000'],
  viewport: { width: 1400, height: 1000 }, locale: 'en-US',
})
const page = await ctx.newPage()
page.on('console', (m) => { if (m.text().includes('SRO')) console.log('console:', m.text()) })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
const scrolls = Number(process.argv[4] ?? 6); for (let i = 0; i < scrolls; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(1500) }
await page.waitForTimeout(3000)
const info = await page.evaluate(() => [...document.querySelectorAll('[data-sro-card]')].map(c => {
  const r = c.getBoundingClientRect(); const b = c.querySelector('.sro-badge')
  return `${c.getAttribute('data-sro-card')} ${c.tagName}.${c.className.toString().slice(0,50)} ${Math.round(r.width)}x${Math.round(r.height)} top=${Math.round(r.top+scrollY)} badge=${b ? b.textContent+'/'+(b.classList.contains('sro-inline')?'inline':'corner') : '-'}`
}))
console.log(info.join('\n'))
await page.screenshot({ path: `${out}/debug_${url.replace(/[^a-z0-9]+/gi,'_').slice(0,40)}.png`, fullPage: false })
await ctx.close()
