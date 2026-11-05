import fs from 'node:fs'
import path from 'node:path'
import { test, expect, settle } from './fixtures'

test.describe('popup levers drive the overlay live', () => {
  test('frame color and sparkle apply live, and the review color comes back', async ({ context, popup }) => {
    const store = await context.newPage()
    await store.goto('https://store.steampowered.com/search/?term=portal', { waitUntil: 'domcontentloaded' })
    await settle(store)
    await popup.bringToFront()
    await popup.click('.notch[data-pos="6"] .tick.r', { force: true })
    const frames = () => store.evaluate(() => [...new Set([...document.querySelectorAll<HTMLElement>('[data-sro-highlight]')].map((e) => e.style.getPropertyValue('--sro-hl')))].sort().join())
    await expect.poll(frames).toContain('#66c0f4')
    await expect.poll(() => store.locator('.sro-orbit').count()).toBeGreaterThan(0)

    await expect(popup.locator('#configView')).toBeHidden()
    await popup.click('#configToggle')
    await expect(popup.locator('#configView')).toBeVisible()
    await expect(popup.locator('#throttle')).toBeHidden()
    await expect(popup.locator('#frameSwatches button.auto')).toHaveCSS('background-color', 'rgb(102, 192, 244)')
    await expect(popup.locator('#frameHue')).toHaveValue('202') // the default frame's hue
    await popup.click('#frameSwatches [data-color="#ffd54a"]')
    await expect.poll(frames).toBe('#ffd54a')
    await expect(popup.locator('#frameHex')).toHaveValue('#ffd54a')

    await popup.fill('#frameHex', 'FF8800')
    await expect.poll(frames).toBe('#ff8800')

    await popup.locator('#frameHue').fill('200')
    await expect.poll(frames).not.toBe('#ff8800')
    expect(await popup.locator('#frameSwatches [aria-checked="true"]').count()).toBe(0) // no preset is that color

    await popup.uncheck('#sparkle')
    await expect.poll(() => store.locator('.sro-orbit').count()).toBe(0)
    expect(await store.locator('[data-sro-op]').count()).toBe(0)
    await popup.check('#sparkle')
    await expect.poll(() => store.locator('.sro-orbit').count()).toBeGreaterThan(0)

    await popup.click('#frameSwatches button.auto')
    await expect.poll(frames).toContain('#66c0f4')
    await expect(popup.locator('#frameHex')).toHaveValue('')
    await popup.click('#configToggle')
    await expect(popup.locator('#throttle')).toBeVisible()
    await store.close()
  })

  test('the dim slider sets how dark dimmed cards get, live', async ({ context, popup }) => {
    const store = await context.newPage()
    await store.goto('https://store.steampowered.com/search/?term=portal', { waitUntil: 'domcontentloaded' })
    await settle(store)
    const overlay = () =>
      store.evaluate(() => {
        const card = document.querySelector('[data-sro-card]')!
        card.setAttribute('data-sro-filtered', 'dim')
        return getComputedStyle(card, '::after').backgroundColor
      })
    await expect.poll(overlay).toBe('rgba(0, 0, 0, 0.5)')
    await popup.bringToFront()
    await popup.click('#configToggle')
    await expect(popup.locator('#dimOpacity')).toHaveValue('50')
    await popup.locator('#dimOpacity').fill('40')
    await expect(popup.locator('#dimValue')).toHaveText(/40/)
    await expect.poll(overlay).toBe('rgba(0, 0, 0, 0.4)')
    await store.close()
  })

  test('dim, hide, outline and park', async ({ context, popup }) => {
    const store = await context.newPage()
    await store.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' })
    await settle(store)

    // A new install starts at Mixed and Very Positive
    await expect(popup.locator('#tierFilter')).toContainText('Mixed')
    await expect(popup.locator('#tierHighlight')).toHaveText('Very Positive')

    // Filter lever to Very Positive, Dim
    await popup.click('button[data-mode="dim"]')
    await popup.click('.notch[data-pos="8"] .tick.l', { force: true })
    await expect(popup.locator('#tierFilter')).toContainText('Very Positive')
    await store.bringToFront()
    await expect.poll(() => store.locator('[data-sro-filtered="dim"]').count()).toBeGreaterThan(0)

    // Switch to Hide: dimmed rows become hidden
    await popup.bringToFront()
    await popup.click('button[data-mode="hide"]')
    await store.bringToFront()
    await expect.poll(() => store.locator('[data-sro-filtered="hide"]').count()).toBeGreaterThan(0)
    expect(await store.locator('[data-sro-filtered="dim"]').count()).toBe(0)

    // Highlight lever to Very Positive: outlines appear, never on a filtered card
    await popup.bringToFront()
    await popup.click('.notch[data-pos="8"] .tick.r', { force: true })
    await store.bringToFront()
    await expect.poll(() => store.locator('[data-sro-highlight]').count()).toBeGreaterThan(0)
    expect(await store.locator('[data-sro-filtered][data-sro-highlight]').count()).toBe(0)

    // Park both levers with the keyboard: everything clears
    await popup.bringToFront()
    await popup.focus('#leverFilter')
    await popup.keyboard.press('Home')
    await popup.focus('#leverHighlight')
    await popup.keyboard.press('End')
    await expect(popup.locator('#pctFilter')).toHaveText('OFF')
    await store.bringToFront()
    await expect.poll(() => store.locator('[data-sro-filtered], [data-sro-highlight]').count()).toBe(0)
  })

  test('shows a hint when the active tab is not the Steam store', async ({ context, popup }) => {
    const other = await context.newPage()
    await other.goto('about:blank')
    await other.bringToFront()
    await popup.reload()
    await expect(popup.locator('#status')).toBeVisible()
    // the catalog string itself, never a raw message key
    const en = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../_locales/en/messages.json'), 'utf8'))
    await expect(popup.locator('#status')).toHaveText(en.errNotStore.message)
  })

  test('mode and source radio groups move with the arrow keys', async ({ popup }) => {
    await popup.focus('#mode button[aria-checked="true"]')
    await popup.keyboard.press('ArrowRight')
    await expect(popup.locator('#mode button[data-mode="hide"]')).toHaveAttribute('aria-checked', 'true')
    await expect(popup.locator('#mode button[data-mode="hide"]')).toBeFocused()
    await popup.keyboard.press('ArrowLeft')
    await expect(popup.locator('#mode button[data-mode="dim"]')).toHaveAttribute('aria-checked', 'true')
    // only the checked item is a tab stop
    await expect(popup.locator('#mode button[data-mode="hide"]')).toHaveAttribute('tabindex', '-1')
  })

  test('is localized from the message catalog', async ({ popup }) => {
    await expect(popup.locator('[data-i18n="filter"]')).toHaveText('FILTER')
    await expect(popup.locator('.notch[data-pos="9"] span')).toContainText('Overwhelmingly Positive')
  })

  test('source buttons say what they change', async ({ popup }) => {
    const en = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../_locales/en/messages.json'), 'utf8'))
    const local = popup.locator('#source [data-source="local"]')
    const global = popup.locator('#source [data-source="global"]')
    await expect(local).toHaveAttribute('title', /^My language \(.+\)\nFilter and highlight using only reviews in .+\.\n/)
    expect(await global.getAttribute('title')).toBe(`All languages\n${en.sourceGlobalHint.message}\n${en.sourceLabelsNote.message}`)
    await expect(global).toHaveAttribute('aria-label', 'All languages')
  })
})
