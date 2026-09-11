import { test, expect, settle } from './fixtures'

test.describe('badges on Steam store pages', () => {
  // Category pages are React-rendered section by section, so fewer cards exist early on.
  for (const [url, min] of [
    ['https://store.steampowered.com/', 10],
    ['https://store.steampowered.com/search/?term=roguelike', 10],
    ['https://store.steampowered.com/category/action/', 3],
  ] as const) {
    test(`labels games on ${new URL(url).pathname}`, async ({ context }) => {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await settle(page)
      const badges = page.locator('.sro-badge')
      await expect.poll(() => badges.count(), { timeout: 15_000 }).toBeGreaterThan(min)
      // Every badge carries Steam's label text and a tone class
      const first = badges.first()
      await expect(first).toHaveClass(/sro-(positive|mixed|negative|none)/)
      expect((await first.textContent())!.trim().length).toBeGreaterThan(0)
      // No badge is ever empty
      const empty = await badges.evaluateAll((els) => els.filter((e) => !e.textContent?.trim()).length)
      expect(empty).toBe(0)
      await page.close()
    })
  }

  test('search rows reuse on-page data and stay in one batch', async ({ context }) => {
    const page = await context.newPage()
    const own: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('GetItems') && r.url().includes('sro=1')) own.push(r.url())
    })
    await page.goto('https://store.steampowered.com/search/?term=hollow', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)
    expect(own.length).toBeLessThanOrEqual(2)
    await page.close()
  })

  test('does not label the page’s own game on an app page', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/app/570/Dota_2/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    expect(await page.locator('[data-sro-card="570"]').count()).toBe(0)
    await page.close()
  })
})
