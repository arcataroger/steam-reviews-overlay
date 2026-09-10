import { chromium } from 'playwright'
import path from 'node:path'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const out = process.argv[2]
const urls = process.argv.slice(3)
const ctx = await chromium.launchPersistentContext('', {
  headless: false, // extensions need headed (or new headless) — use channel-less chromium with args
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--window-size=1400,1000'],
  viewport: { width: 1400, height: 1000 },
  locale: 'en-US',
})
for (const url of urls) {
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.text().includes('SRO')) console.log('console:', m.text()) })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  // scroll a bit to trigger lazy stuff
  await page.mouse.wheel(0, 1200); await page.waitForTimeout(3000)
  await page.mouse.wheel(0, -1200); await page.waitForTimeout(2500)
  const stats = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-sro-card]').length
    const badges = [...document.querySelectorAll('.sro-badge')]
    const inline = badges.filter(b => b.classList.contains('sro-inline')).length
    const corner = badges.filter(b => b.classList.contains('sro-corner')).length
    const sample = badges.slice(0, 8).map(b => `${b.textContent} [${b.className}] card=${b.closest('[data-sro-card]')?.className.slice(0,60)}`)
    return { cards, badges: badges.length, inline, corner, sample }
  })
  console.log(url, JSON.stringify(stats, null, 1))
  const name = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
  await page.close()
}
await ctx.close()
