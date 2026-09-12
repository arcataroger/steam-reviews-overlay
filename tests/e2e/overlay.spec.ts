import { test, expect, settle, extensionId } from './fixtures'

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

  test('a rotating carousel is labelled per slide, not as one card', async ({ context }) => {
    // Steam's content-hub carousel rotates a different game through one viewport every few seconds,
    // and only the current slide is in the DOM. The viewport therefore looked like a single game's
    // card and took a ring around the whole widget: the video controls, the auto-advance bar and the
    // pagination for twelve other games. Built here rather than waited for, because which pages
    // carry the carousel and which game it shows both change by the hour.
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.evaluate(() => {
      const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      const hub = document.createElement('div')
      hub.className = 'contenthubmaincarousel'
      hub.id = 'sro-test-carousel'
      // Wider than the climb's own width cap, so without the fix the climb settles on the viewport
      // exactly as it does on the real page.
      hub.style.cssText = 'position:relative;width:1386px;height:591px'
      hub.innerHTML =
        '<div id="sro-test-viewport" style="position:relative;width:1200px;height:541px">' +
        `<a id="sro-test-slide" href="https://store.steampowered.com/app/620/Portal_2/" style="display:block;width:384px;height:252px"><img src="${px}" style="width:384px;height:252px"></a>` +
        '<div style="height:40px">Next Game in 3 seconds</div>' +
        '</div>'
      document.body.appendChild(hub)
    })
    await page.waitForTimeout(4000)
    const claimed = await page.evaluate(() => ({
      viewport: document.getElementById('sro-test-viewport')!.hasAttribute('data-sro-card'),
      slide: document.getElementById('sro-test-slide')!.hasAttribute('data-sro-card'),
      hub: document.getElementById('sro-test-carousel')!.hasAttribute('data-sro-card'),
    }))
    expect(claimed).toEqual({ viewport: false, slide: true, hub: false })
    await page.close()
  })

  test('a recycled slot is not repainted with the game it used to hold', async ({ context }) => {
    // Steam recycles a carousel node by swapping what is inside it. A deferred repaint (a resize, a
    // late image, a font swap) could fire before the scanner notices and paint the previous game's
    // label and tone onto the game now in that slot. An href swapped in place never reaches the
    // scanner on its own: the mutation observer watches childList and characterData, not attributes.
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.evaluate(() => {
      const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      const slot = document.createElement('a')
      slot.id = 'sro-test-slot'
      slot.href = 'https://store.steampowered.com/app/620/Portal_2/'
      slot.style.cssText = 'display:block;position:relative;width:300px;height:180px'
      slot.innerHTML = `<img src="${px}" style="width:300px;height:180px">`
      document.body.appendChild(slot)
    })
    await expect
      .poll(() => page.evaluate(() => document.getElementById('sro-test-slot')?.getAttribute('data-sro-card')), { timeout: 20_000 })
      .toBe('620')
    // The claim lands before the score arrives, so wait for the label rather than reading once.
    await expect
      .poll(() => page.evaluate(() => (document.getElementById('sro-test-slot')!.querySelector('.sro-badge')?.textContent || '').trim().length), { timeout: 20_000 })
      .toBeGreaterThan(0)
    const before = await page.evaluate(() => (document.getElementById('sro-test-slot')!.querySelector('.sro-badge')?.textContent || '').trim())

    // Swap the game in place, then make the slot resize so the deferred repaint runs.
    await page.evaluate(() => {
      const slot = document.getElementById('sro-test-slot') as HTMLAnchorElement
      slot.href = 'https://store.steampowered.com/app/730/CounterStrike_2/'
      slot.style.width = '340px'
    })
    await page.waitForTimeout(5000)
    const after = await page.evaluate(() => {
      const slot = document.getElementById('sro-test-slot')!
      return { claimed: slot.getAttribute('data-sro-card'), badge: (slot.querySelector('.sro-badge')?.textContent || '').trim() }
    })
    expect(after.claimed).not.toBe('620')
    // The visible symptom is the wrong game's label, so check that too: clearing the claim while
    // leaving the old badge on screen would be no better for the reader.
    expect(after.badge).not.toBe(before)
    await page.close()
  })

  test('a settings change does not repaint a recycled slot with its old game', async ({ context }) => {
    // Changing a setting repaints every card at once, which is exactly when a slot that has quietly
    // changed hands shows the wrong game's tone and label. This path was missed when the other
    // deferred repaints were put behind one ownership check.
    const page = await context.newPage()
    await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.evaluate(() => {
      const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      const slot = document.createElement('a')
      slot.id = 'sro-test-slot2'
      slot.href = 'https://store.steampowered.com/app/620/Portal_2/'
      slot.style.cssText = 'display:block;position:relative;width:300px;height:180px'
      slot.innerHTML = `<img src="${px}" style="width:300px;height:180px">`
      document.body.appendChild(slot)
    })
    await expect
      .poll(() => page.evaluate(() => document.getElementById('sro-test-slot2')?.getAttribute('data-sro-card')), { timeout: 20_000 })
      .toBe('620')
    // The claim lands before the score arrives, so wait for the label rather than reading once.
    await expect
      .poll(() => page.evaluate(() => (document.getElementById('sro-test-slot2')!.querySelector('.sro-badge')?.textContent || '').trim().length), { timeout: 20_000 })
      .toBeGreaterThan(0)
    const before = await page.evaluate(() => (document.getElementById('sro-test-slot2')!.querySelector('.sro-badge')?.textContent || '').trim())

    // Swap the game in place (an attribute change the scanner never sees), then move a lever.
    await page.evaluate(() => {
      ;(document.getElementById('sro-test-slot2') as HTMLAnchorElement).href = 'https://store.steampowered.com/app/730/CounterStrike_2/'
    })
    const popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
    await popup.evaluate((o) => chrome.storage.sync.set(o), { 'sro:settings:v4': { mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 7 } })
    await page.bringToFront()
    await page.waitForTimeout(4000)
    const after = await page.evaluate(() => {
      const slot = document.getElementById('sro-test-slot2')!
      return { claimed: slot.getAttribute('data-sro-card'), badge: (slot.querySelector('.sro-badge')?.textContent || '').trim() }
    })
    expect(after.claimed).not.toBe('620')
    expect(after.badge).not.toBe(before)
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
