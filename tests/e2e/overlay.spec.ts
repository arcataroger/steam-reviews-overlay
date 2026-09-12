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

  test('no card wraps two different products', async ({ context }) => {
    // The homepage pairs a game capsule with a package capsule in one column. Only /app/ links
    // counted towards "how many games are in here", so the column looked like a single game and
    // became the card: Death Stranding's ring wrapped the unrelated package's capsule below it.
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    // Cards are claimed as they come into view, and the offending column sits well down the page.
    for (let i = 0; i < 8; i++) {
      await page.evaluate((n) => scrollTo(0, n * innerHeight * 0.8), i)
      await page.waitForTimeout(700)
    }
    const spanning = await page.evaluate(() => {
      const out: string[] = []
      for (const card of document.querySelectorAll('[data-sro-card]')) {
        const links = [...card.querySelectorAll('a[href*="/app/"], a[href*="/sub/"], a[href*="/bundle/"]')]
        const targets = new Set(
          links.map((a) => (a.getAttribute('href') || '').match(/\/(app|sub|bundle)\/(\d+)/)?.slice(1).join('/')).filter(Boolean) as string[],
        )
        if (targets.size > 1) out.push(`${card.className.slice(0, 40)} -> ${[...targets].join(', ')}`)
      }
      return out
    })
    expect(spanning).toEqual([])

    // The live shelf only appears in some sessions, so also build the shape and let the real
    // detector claim it: a game capsule stacked with a package capsule of the same size.
    await page.evaluate(() => {
      const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      const wrap = document.createElement('div')
      wrap.id = 'sro-test-shelf'
      wrap.style.cssText = 'position:relative;width:341px'
      wrap.innerHTML =
        `<a href="https://store.steampowered.com/app/620/Portal_2/" style="display:block;width:341px;height:193px"><img src="${px}" style="width:341px;height:193px"></a>` +
        `<a href="https://store.steampowered.com/sub/1390270/" style="display:block;width:341px;height:193px"><img src="${px}" style="width:341px;height:193px"></a>`
      document.body.appendChild(wrap)
      wrap.scrollIntoView()
    })
    await page.waitForTimeout(4000)
    const shelf = await page.evaluate(() => {
      const wrap = document.getElementById('sro-test-shelf')!
      return {
        wrapClaimed: wrap.hasAttribute('data-sro-card'),
        gameClaimed: wrap.querySelector('a[href*="/app/"]')!.hasAttribute('data-sro-card'),
        packageClaimed: wrap.querySelector('a[href*="/sub/"]')!.hasAttribute('data-sro-card'),
      }
    })
    expect(shelf).toEqual({ wrapClaimed: false, gameClaimed: true, packageClaimed: false })
    await page.close()
  })

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
