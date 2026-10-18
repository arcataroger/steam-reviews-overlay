// Outcome audit, logged in through the kept test profile (npm run steam-login): every game card a reader
// can see must carry our label, Steam's own summary, or a known exception. It walks the page the way a
// reader does: scrolls it, opens every home tab, pages every carousel. The filter dims everything at
// Mostly Positive and below, so dimmed cards are checked too.
//
// Usage: node scripts/audit-home.mjs [--browser chromium|firefox] [url...]   (default: chromium, store home)
// Exits 1 when any card is unlabelled. Audits the current dist/ build; rebuild first.
import { browserArg, launch } from './lib/browsers.mjs'

const { browser, rest } = browserArg()
const urls = rest.length ? rest : ['https://store.steampowered.com/']
const SETTINGS = { mode: 'dim', threshold: 6, source: 'global', highlightThreshold: 9 }

/**
 * Runs in the page. Every laid-out link to a store product with artwork, at least 120px wide (narrower
 * capsules carry no label by design), on screen horizontally. Returns the ones without a label.
 */
function unlabelled() {
  const out = []
  const seen = new Set()
  for (const a of document.querySelectorAll('a[href*="/app/"], a[href*="/sub/"], a[href*="/bundle/"], [data-ds-appid]')) {
    if (!a.getClientRects().length || !a.querySelector('img, [style*="background-image"]')) continue
    if (a.closest('#global_hover, .hover_body, #global_header, #footer')) continue
    const card = a.closest('[data-sro-card]')
    const box = card ?? a
    if (seen.has(box)) continue
    seen.add(box)
    const r = box.getBoundingClientRect()
    if (r.width < 120 || r.height < 40 || r.right < 0 || r.left > innerWidth) continue
    const href = a.getAttribute('href') ?? ''
    // Packages and bundles have no review score of their own: never labelled, by design
    if (/\/(sub|bundle)\//.test(href)) continue
    if (card?.querySelector('.sro-badge')) continue
    // Steam prints its own summary: our label only appears when local and global disagree
    const native = [...box.querySelectorAll('[class*="review" i]')].some(
      (el) => !el.closest('.sro-badge') && el.textContent.trim() &&
        (el.matches('.positive, .mixed, .negative') || /^\s*(Overwhelmingly |Very |Mostly )?(Positive|Negative|Mixed)\b/i.test(el.textContent)),
    )
    if (native) continue
    const name = a.querySelector('img')?.alt || box.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)
    const app = href.match(/\/app\/(\d+)/)?.[1] ?? a.dataset.dsAppid ?? '?'
    out.push({
      key: `${app}|${box.tagName}.${String(box.className).split(' ')[0]}`,
      line: `${card ? 'NO LABEL ' : 'UNCLAIMED'} app ${app.padEnd(8)} ${name.slice(0, 30).padEnd(30)} ${box.tagName}.${String(box.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}${card?.dataset.sroFiltered ? ` (${card.dataset.sroFiltered})` : ''}`,
    })
  }
  return out
}

const ctx = await launch(browser, { extension: true, settings: SETTINGS })
const page = await ctx.newPage()
const failures = new Map()
const record = async (where) => {
  if (!(await page.evaluate(unlabelled)).length) return
  // A slide still arriving (React carousels render on demand) is a race, not a gap: count only cards
  // still unlabelled a few seconds later
  await page.waitForTimeout(3000)
  for (const f of await page.evaluate(unlabelled)) if (!failures.has(f.key)) failures.set(f.key, `${f.line}  [${where}]`)
}

for (const url of urls) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  if (!(await page.locator('#account_pulldown').count())) console.warn(`${url}: not logged in; personalized rows will be missing (run npm run steam-login -- --browser ${browser})`)
  // Scroll in steps: sections render lazily as they come into view
  for (let y = 0, h = 1; y < h; y += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await page.waitForTimeout(300)
    h = await page.evaluate(() => document.body.scrollHeight)
  }
  await page.waitForTimeout(2000)
  await record('scrolled')

  // Home tabs (New & Trending, Top Sellers, ...): Steam reveals each by flipping a style
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[id$="_trigger"]')].filter((t) => t.getClientRects().length).map((t) => t.id))
  for (const id of tabs) {
    const tab = page.locator(`#${id}`)
    await tab.scrollIntoViewIfNeeded().catch(() => {})
    await tab.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await record(`tab ${id}`)
  }

  // Every carousel, page by page through its next arrow
  const NEXT = '.arrow.right, [class*="Right"][role="button"], button[aria-label*="ext" i]'
  const count = await page.evaluate((NEXT) => {
    const cs = [...document.querySelectorAll('.carousel_container, [class*="carousel" i]')].filter((c) => c.getClientRects().length && c.querySelector(NEXT))
    cs.forEach((c, i) => (c.dataset.sroAudit = String(i)))
    return cs.length
  }, NEXT)
  for (let i = 0; i < count; i++) {
    for (let p = 0; p < 8; p++) {
      const next = page.locator(`[data-sro-audit="${i}"]`).locator(NEXT).first()
      if (!(await next.isVisible().catch(() => false))) break
      await next.scrollIntoViewIfNeeded().catch(() => {})
      await next.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(1000)
      await record(`carousel ${i} page ${p + 2}`)
    }
  }
  console.log(`${browser} ${url}: ${tabs.length} tabs, ${count} carousels walked`)
}
await ctx.close()

if (failures.size) {
  console.log(`\n${failures.size} visible game cards without a label:\n${[...failures.values()].join('\n')}`)
  process.exit(1)
}
console.log('\nEvery visible game card carries a label, Steam\'s own summary, or a by-design exception.')
