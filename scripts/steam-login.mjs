// Opens a browser on its kept test profile at Steam's login page. Log in, then close the window.
// Later headless runs through scripts/lib/browsers.mjs reuse the session.
// Usage: node scripts/steam-login.mjs [--browser chromium|firefox]   (default chromium)
import { browserArg, launch } from './lib/browsers.mjs'
const { browser } = browserArg()
const ctx = await launch(browser, { headless: false, viewport: null })
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://store.steampowered.com/login/')
console.log(`Log in to Steam in the ${browser} window, then close it.`)
await new Promise((resolve) => ctx.on('close', resolve))
