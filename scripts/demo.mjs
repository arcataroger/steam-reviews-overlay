// Opens a visible Chromium with the built extension loaded, on a couple of store pages, and stays up.
import { chromium } from 'playwright'
import path from 'node:path'
const ext = path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const ctx = await chromium.launchPersistentContext(path.resolve(import.meta.dirname, '..', '.demo-profile'), {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--window-size=1440,1000'],
  viewport: null,
  locale: 'en-US',
})
const p1 = await ctx.newPage(); await p1.goto('https://store.steampowered.com/search/?term=roguelike')
const p2 = await ctx.newPage(); await p2.goto('https://store.steampowered.com/')
await p1.bringToFront()
console.log('Demo browser is open. Close the window to end.')
await new Promise((resolve) => ctx.on('close', resolve))
