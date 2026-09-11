import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'
import crypto from 'node:crypto'

const extPath = process.env.SRO_EXT_DIR ? path.resolve(process.env.SRO_EXT_DIR) : path.resolve(import.meta.dirname, '../../dist/chrome')
// Chrome derives unpacked extension ids from the SHA-256 of the absolute path, hex -> a..p
export const extensionId = [...crypto.createHash('sha256').update(extPath).digest('hex').slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
  .join('')

export const test = base.extend<{ context: BrowserContext; popup: Page }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`, '--headless=new', '--window-size=1400,1000'],
      viewport: { width: 1400, height: 1000 },
      locale: 'en-US',
    })
    await use(context)
    await context.close()
  },
  popup: async ({ context }, use) => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
    await page.setViewportSize({ width: 340, height: 800 })
    await use(page)
  },
})
export const expect = test.expect

/** Scroll a store page a bit so lazily rendered sections load, then wait for badges. */
export async function settle(page: Page) {
  await page.waitForTimeout(3000)
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(800)
  }
  await page.waitForTimeout(1500)
}
