import fs from 'node:fs'
import path from 'node:path'
import { test, expect, settle } from './fixtures'

test.describe('popup levers drive the overlay live', () => {
  test('frame color and sparkle apply live', async ({ context, popup }) => {
    const store = await context.newPage()
    await store.goto('https://store.steampowered.com/search/?term=portal', { waitUntil: 'domcontentloaded' })
    await settle(store)
    await popup.bringToFront()
    await popup.click('.notch[data-pos="6"] .tick.r', { force: true })
    const frames = () => store.evaluate(() => [...new Set([...document.querySelectorAll<HTMLElement>('[data-sro-highlight]')].map((e) => e.style.getPropertyValue('--sro-hl')))].sort().join())
    await expect.poll(frames).toBe('#66c0f4') // a new install: Steam's blue
    await expect.poll(() => store.locator('.sro-orbit').count()).toBeGreaterThan(0)

    await expect(popup.locator('#configView')).toBeHidden()
    await popup.click('#configToggle')
    await expect(popup.locator('#configView')).toBeVisible()
    await expect(popup.locator('#throttle')).toBeHidden()
    const checked = popup.locator('#frameSwatches [aria-checked="true"]')
    await expect(checked).toHaveAttribute('data-color', '#66c0f4')
    await expect(popup.locator('#frameHue')).toHaveValue('400') // the blue notch

    // A swatch moves the slider onto its notch
    await popup.click('#frameSwatches [data-color="#f6e155"]')
    await expect.poll(frames).toBe('#f6e155')
    await expect(popup.locator('#frameHue')).toHaveValue('200')
    await expect(popup.locator('#frameHex')).toHaveValue('#f6e155')

    // Arrow keys walk off a notch: only a drag snaps back onto it
    await popup.locator('#frameHue').focus()
    for (let i = 0; i < 8; i++) await popup.keyboard.press('ArrowRight')
    await expect(popup.locator('#frameHue')).toHaveValue('208')

    // The slider on a notch lights that swatch, with the swatch's exact color
    await popup.locator('#frameHue').fill('400')
    await expect.poll(frames).toBe('#66c0f4')
    await expect(checked).toHaveAttribute('data-color', '#66c0f4')

    await popup.fill('#frameHex', 'FF8800')
    await expect.poll(frames).toBe('#ff8800')
    await expect(checked).toHaveCount(0) // no swatch is that color
    const pick = popup.locator('.hue-pick')
    await expect(pick).toHaveClass(/custom/) // the presets fade: this color is the user's own
    await expect(popup.locator('#framePreview')).toHaveCSS('--sro-hl', '#ff8800') // the hex field wears the frame

    // A swatch still brings the presets back
    await popup.click('#frameSwatches [data-color="#f655a6"]')
    await expect.poll(frames).toBe('#f655a6')
    await expect(pick).not.toHaveClass(/custom/)
    await expect(popup.locator('#frameHue')).toHaveValue('700') // pink closes the slider

    await popup.locator('#frameHue').fill('150')
    await expect.poll(frames).not.toBe('#ff8800')
    await expect(checked).toHaveCount(0) // between notches
    await expect(popup.locator('.hue-pick')).not.toHaveClass(/custom/) // still a slider color

    await expect(popup.locator('#previewOrbit > i').first()).toBeAttached() // the preview sparkles too
    await popup.uncheck('#sparkle')
    await expect(popup.locator('#previewOrbit')).toBeHidden()
    expect(await popup.locator('#framePreview').evaluate((e) => getComputedStyle(e, '::before').boxShadow)).toBe('none') // no glow without the sparkle
    await expect.poll(() => store.locator('.sro-orbit').count()).toBe(0)
    expect(await store.locator('[data-sro-op]').count()).toBe(0)
    await popup.check('#sparkle')
    await expect.poll(() => store.locator('.sro-orbit').count()).toBeGreaterThan(0)

    // Clearing the field changes nothing, and leaving it shows the color in force again
    const before = await frames()
    await popup.fill('#frameHex', '')
    await popup.locator('#frameHex').blur()
    await expect(popup.locator('#frameHex')).toHaveValue(before)
    expect(await frames()).toBe(before)
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

    // Hide makes Dim moot: the slider greys out and a hint says why
    await popup.click('#configToggle')
    await popup.click('[data-mode="hide"]')
    await popup.click('#configToggle')
    await expect(popup.locator('#dimOpacity')).toBeDisabled()
    await expect(popup.locator('#dimOpacity')).toHaveCSS('cursor', 'not-allowed')
    await expect(popup.locator('#dimHint')).toHaveText('Games at Mixed and below are set to Hide, so Dim has no effect.')
    await popup.click('#configToggle')
    await popup.click('[data-mode="dim"]')
    await popup.click('#configToggle')
    await expect(popup.locator('#dimOpacity')).toBeEnabled()
    await expect(popup.locator('#dimHint')).toBeHidden()
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
