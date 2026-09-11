import fs from 'node:fs'
import path from 'node:path'
import { test, expect, settle } from './fixtures'

test.describe('popup levers drive the overlay live', () => {
  test('dim, hide, outline and park', async ({ context, popup }) => {
    const store = await context.newPage()
    await store.goto('https://store.steampowered.com/search/?term=survival', { waitUntil: 'domcontentloaded' })
    await settle(store)

    // Both levers start parked
    await expect(popup.locator('#pctFilter')).toHaveText('OFF')
    await expect(popup.locator('#pctHighlight')).toHaveText('OFF')

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
})
