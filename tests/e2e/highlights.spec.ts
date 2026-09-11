import { test, expect, settle } from './fixtures'

const KEY = 'sro:settings:v4'
const base = { mode: 'dim', threshold: 0, source: 'global', highlightThreshold: 10 }

test.describe('highlight shapes and layout invariants', () => {
  test('a badge never changes a capsule’s size (front-page carousels stay uniform)', async ({ context, popup }) => {
    await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: base })
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    const groups = await page.evaluate(() => {
      // every carousel row of sale capsules: all siblings must share one size
      const out: string[] = []
      const rows = new Set<Element>()
      for (const c of document.querySelectorAll('a.sale_capsule[data-sro-card]')) if (c.parentElement) rows.add(c.parentElement)
      for (const row of rows) {
        const sizes = new Set([...row.querySelectorAll('a.sale_capsule[data-sro-card]')].map((c) => { const r = c.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }))
        if (sizes.size > 1) out.push([...sizes].join(','))
      }
      return out
    })
    expect(groups, 'rows whose capsules differ in size').toEqual([])
    await page.close()
  })

  test('highlights use the game’s own color, rows get a ring, OP cards get the orbit', async ({ context, popup }) => {
    await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: { ...base, highlightThreshold: 5 } })
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/search/?term=roguelike', { waitUntil: 'domcontentloaded' })
    await settle(page)
    const info = await page.evaluate(() => {
      const hl = [...document.querySelectorAll<HTMLElement>('.search_result_row[data-sro-highlight]')]
      const tones = new Set(hl.map((e) => e.dataset.sroHighlight))
      const colors = new Set(hl.map((e) => e.style.getPropertyValue('--sro-hl')))
      const shapes = new Set(hl.map((e) => e.dataset.sroShape))
      const op = hl.filter((e) => e.dataset.sroOp).length
      const opScores = hl.filter((e) => e.dataset.sroOp).every((e) => e.dataset.sroScore === '9')
      return { n: hl.length, tones: [...tones], colors: [...colors], shapes: [...shapes], op, opScores }
    })
    expect(info.n).toBeGreaterThan(5)
    expect(info.shapes).toEqual(['row'])
    expect(info.tones.length).toBeGreaterThan(1) // mixed + positive present at a Mixed bar
    expect(info.colors.length).toBe(info.tones.length) // one color per tone, the game's own
    expect(info.op).toBeGreaterThan(0)
    expect(info.opScores).toBe(true)
    await page.close()
  })

  test('search rows: label centred with the date and never over the price', async ({ context, popup }) => {
    await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: { ...base, source: 'local' } })
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/search/?filter=topsellers', { waitUntil: 'domcontentloaded' })
    await settle(page)
    const r = await page.evaluate(() => {
      let overlap = 0, off = 0, n = 0
      for (const row of document.querySelectorAll('.search_result_row')) {
        const b = row.querySelector('.sro-badge'); if (!b) continue
        n++
        const a = b.getBoundingClientRect(), pr = row.querySelector('.search_price_discount_combined')?.getBoundingClientRect(), d = row.querySelector('.search_released')?.getBoundingClientRect()
        if (pr && pr.width && a.right > pr.left + 1) overlap++
        if (d && d.height && Math.abs((a.top + a.bottom) / 2 - (d.top + d.bottom) / 2) > 4) off++
      }
      return { n, overlap, off }
    })
    expect(r.n).toBeGreaterThan(20)
    expect(r.overlap).toBe(0)
    expect(r.off).toBe(0)
    await page.close()
  })

  test('cards with Steam’s own summary get our badge only when local and global differ', async ({ context, popup }) => {
    await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: base })
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    const r = await page.evaluate(() => {
      const native = [...document.querySelectorAll('[data-sro-card]')].filter((c) => [...c.querySelectorAll('[class*="review" i]:not(.sro-badge)')].some((e) => /Positive|Negative|Mixed/.test(e.textContent || '')))
      const withBadge = native.filter((c) => c.querySelector('.sro-badge'))
      const allTwoLine = withBadge.every((c) => c.querySelectorAll('.sro-line').length === 2)
      return { native: native.length, withBadge: withBadge.length, allTwoLine }
    })
    expect(r.native).toBeGreaterThan(0)
    expect(r.allTwoLine).toBe(true) // never a duplicate single label beside Steam's text
    await page.close()
  })
})

test.describe('popup: this session’s controls', () => {
  test('readouts show ≤ band top for filter and ≥ band start for highlight; levers push', async ({ popup }) => {
    await popup.evaluate((o) => chrome.storage.sync.set(o), { [KEY]: { ...base, threshold: 5, highlightThreshold: 7 } })
    await popup.reload()
    await expect(popup.locator('#pctFilter')).toHaveText('≤ 69%')
    await expect(popup.locator('#pctHighlight')).toHaveText('≥ 80%')
    // push the filter up past the highlight: highlight moves one tier above it
    await popup.click('.notch[data-pos="8"] .tick.l', { force: true })
    await expect(popup.locator('#tierFilter')).toHaveText('Very Positive')
    await expect(popup.locator('#tierHighlight')).toHaveText('Overwhelmingly Positive')
    // parked lever reads OFF and its side's ticks go dark
    await popup.focus('#leverHighlight'); await popup.keyboard.press('End')
    await expect(popup.locator('#pctHighlight')).toHaveText('OFF')
    await expect(popup.locator('#notches')).toHaveClass(/off-r/)
  })

  test('language toggle is icon-only with names in tooltips, and the popup fits Chrome’s cap', async ({ popup }) => {
    const local = popup.locator('#source [data-source="local"]')
    await expect(local).toHaveAttribute('title', /My language \(.+\)/)
    await expect(popup.locator('#source [data-source="global"]')).toHaveAttribute('title', 'All languages')
    await popup.setViewportSize({ width: 340, height: 400 })
    const h = await popup.evaluate(() => document.documentElement.scrollHeight)
    expect(h).toBeLessThanOrEqual(600)
  })
})
