// Launches a browser with the extension loaded, on a kept per-browser profile, for scripts that check the
// overlay on live pages. The profiles keep a Steam login made once with scripts/steam-login.mjs:
// personalized home rows (Because You Played, Recently Updated) only render for a logged-in account.
//
// Chromium is the primary target: it loads the unpacked build directly and lets us write settings
// through the extension's service worker. Firefox (the installed one, over WebDriver BiDi) is second
// tier: it only takes the build as a temporary add-on, and its driver cannot open extension pages, so
// settings are written into the build copy's defaults instead. Playwright's WebKit cannot load
// extensions at all; it can only check our CSS on bare pages.
import { chromium, firefox } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
// web-ext's remote debugging client is not in its package "exports"; a file path import skips that check
const { connectWithMaxRetries, findFreeTcpPort } = await import(path.join(root, 'node_modules', 'web-ext', 'lib', 'firefox', 'remote.js'))

export const BROWSERS = ['chromium', 'firefox']
export const profileDir = (browser) => path.join(root, `.${browser}-test-profile`)
export const SETTINGS_KEY = 'sro:settings:v4'

/** The browser named by `--browser <name>` (or `--browser=<name>`) in argv, default Chromium; argv minus the flag. */
export function browserArg(argv = process.argv.slice(2)) {
  const rest = []
  let browser = 'chromium'
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--browser(?:=(.*))?$/)
    if (!m) rest.push(argv[i])
    else browser = m[1] ?? argv[++i]
  }
  if (!BROWSERS.includes(browser)) throw new Error(`--browser must be one of ${BROWSERS.join(', ')}`)
  return { browser, rest }
}

/**
 * Copy dist/<browser> aside so a rebuild mid-run cannot pull content-hashed files out from under the
 * loaded extension. macOS hands back a symlinked temp path; Chrome keys unpacked extensions by real path.
 */
function copyBuild(browser) {
  // SRO_CHROMIUM_DIST / SRO_FIREFOX_DIST point at a build made elsewhere (the weekly audit builds
  // Firefox outside dist/, where `npm run dev:firefox` would reload the add-on mid-session)
  const src = process.env[`SRO_${browser.toUpperCase()}_DIST`] ?? path.join(root, 'dist', browser === 'chromium' ? 'chrome' : 'firefox')
  if (!fs.existsSync(path.join(src, 'manifest.json'))) throw new Error(`${src} is missing: run npm run build:${browser === 'chromium' ? 'chrome' : 'firefox'}`)
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sro-ext-')))
  fs.cpSync(src, dir, { recursive: true })
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** Firefox only: bake settings into the copy's defaults (the minified shape is checked, never guessed). */
function bakeSettings(dir, settings) {
  const assets = path.join(dir, 'assets')
  const file = fs.readdirSync(assets).find((f) => /^settings-.*\.js$/.test(f))
  const DEFAULTS = /mode:`dim`,threshold:0,source:`global`,highlightThreshold:10/
  const src = file && fs.readFileSync(path.join(assets, file), 'utf8')
  if (!src || !DEFAULTS.test(src)) throw new Error('settings defaults not found in the Firefox build; update DEFAULTS in scripts/lib/browsers.mjs')
  const s = settings
  fs.writeFileSync(path.join(assets, file), src.replace(DEFAULTS, `mode:\`${s.mode}\`,threshold:${s.threshold},source:\`${s.source}\`,highlightThreshold:${s.highlightThreshold}`))
}

/**
 * Launch `browser` on its kept profile. With `extension: true`, load a private copy of the current build;
 * with `settings`, start the overlay from those settings ({ mode, threshold, source, highlightThreshold }).
 */
export async function launch(browser, { headless = true, extension = false, settings, viewport = { width: 1400, height: 1000 } } = {}) {
  const dir = extension ? copyBuild(browser) : null
  if (browser === 'chromium') {
    const args = ['--window-size=1400,1000']
    if (dir) args.push(`--disable-extensions-except=${dir}`, `--load-extension=${dir}`)
    // Chromium's headless shell cannot load extensions; the new headless mode can
    if (headless) args.push('--headless=new')
    const ctx = await chromium.launchPersistentContext(profileDir(browser), { headless: false, args, viewport, locale: 'en-US' })
    if (dir && settings) {
      const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
      await sw.evaluate(([key, value]) => chrome.storage.sync.set({ [key]: value }), [SETTINGS_KEY, settings])
    }
    return ctx
  }
  if (dir && settings) bakeSettings(dir, settings)
  const port = await findFreeTcpPort()
  const ctx = await firefox.launchPersistentContext(profileDir(browser), {
    channel: 'moz-firefox',
    headless,
    viewport,
    locale: 'en-US',
    args: ['-start-debugger-server'],
    firefoxUserPrefs: {
      'devtools.debugger.remote-enabled': true,
      'devtools.debugger.remote-port': port,
      'devtools.chrome.enabled': true,
      'devtools.debugger.prompt-connection': false,
    },
  })
  if (dir) {
    // Firefox refuses unsigned add-ons from any other route; this is how web-ext loads them too
    const rdp = await connectWithMaxRetries({ port })
    await rdp.installTemporaryAddon(dir)
    rdp.disconnect()
  }
  return ctx
}
