#!/usr/bin/env node
// "A label must never change a card's size" — measured directly, by loading the same page twice in
// one run, once with the extension and once without, and comparing every card box Steam draws.
//
// The harness's old uneven-capsule-row heuristic compared sibling capsules to each other, so it
// could not tell our effect from Steam's own layout (its hero carousel has uneven slides by design)
// and flagged the same pages every round. Comparing the page against itself without the extension
// answers the actual question.
//
// Usage: node scripts/check-sizes.mjs <url> [url...]
import { chromium } from 'playwright'
import path from 'node:path'
import crypto from 'node:crypto'

const urls = process.argv.slice(2)
if (!urls.length) {
  console.error('usage: node scripts/check-sizes.mjs <url> [url...]')
  process.exit(1)
}
const ext = process.env.SRO_EXT_DIR ? path.resolve(process.env.SRO_EXT_DIR) : path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
const STOPS = Number(process.env.SRO_STOPS) || 8
const TOLERANCE = 1

// Key a box by what Steam put there, not by anything we add: the product it links to, the kind of
// element holding it, and how many like it came before. The kind matters because a store page can
// feature the same game as a big header capsule on one load and a small tile on the next, and
// comparing those two would report a size change nobody made. Hashed CSS-module class names change
// whenever Steam rebuilds, so they are dropped from the key.
const MEASURE = () => {
  const HASH_RE = /^_?[A-Za-z0-9_-]{18,}$/
  const out = []
  const seen = new Map()
  for (const el of document.querySelectorAll('a[href*="/app/"], a[href*="/sub/"], a[href*="/bundle/"], [data-ds-appid]')) {
    // The content-hub carousel rotates a different game through its slot every few seconds, so the
    // same game turns up as the big slide in one run and a small tile in the other. Comparing those
    // reports a size change nobody made.
    if (el.closest('.contenthubmaincarousel')) continue
    const href = el.getAttribute('href') || ''
    const target = href.match(/\/(app|sub|bundle)\/(\d+)/)?.slice(1).join('/') || `ds/${el.getAttribute('data-ds-appid')}`
    if (!target || target === 'ds/null') continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const kind = `${el.tagName}.${String(el.className).split(/\s+/).filter((c) => c && !HASH_RE.test(c) && !/^(app_impression|ds_|responsive_scroll_snap|Focusable|focus|hover|active|selected)/.test(c)).sort().join('.')}`
    const slot = `${target}|${kind}`
    const n = (seen.get(slot) ?? -1) + 1
    seen.set(slot, n)
    out.push({ key: `${slot}#${n}`, w: Math.round(r.width), h: Math.round(r.height), kind })
  }
  return out
}

async function measure(url, withExtension) {
  const args = withExtension ? [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new'] : ['--headless=new']
  const ctx = await chromium.launchPersistentContext('', { headless: false, args, viewport: { width: 1400, height: 1000 }, locale: 'en-US' })
  if (withExtension) {
    const pop = await ctx.newPage()
    await pop.goto(`chrome-extension://${id}/src/popup/index.html`)
    await pop.evaluate((o) => chrome.storage.sync.set(o), { 'sro:settings:v4': { mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 7 } })
  }
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)
  // Positive control: once the badges are placed, make each one a block of its own so it genuinely
  // does grow its card. A check that reports nothing is only reassuring once you have seen it
  // report something.
  if (withExtension && process.env.SRO_SIZE_SELFTEST) {
    const affected = await page.evaluate(() => {
      const st = document.createElement('style')
      st.textContent = '.sro-badge { display: block !important; position: static !important; height: 40px !important; width: 100% !important; }'
      document.head.appendChild(st)
      return document.querySelectorAll('.sro-badge').length
    })
    console.log(`  self-test: forced ${affected} badge(s) to grow their card`)
    await page.waitForTimeout(1200)
  }
  const boxes = new Map()
  for (let i = 0; i < STOPS; i++) {
    await page.evaluate((n) => scrollTo(0, n * innerHeight * 0.8), i)
    await page.waitForTimeout(1200)
    for (const b of await page.evaluate(MEASURE)) if (!boxes.has(b.key)) boxes.set(b.key, b)
  }
  await ctx.close()
  return boxes
}

let failures = 0
let compared = 0
for (const url of urls) {
  // Plain first: the page is then warm in Steam's CDN for the extension run, so content differs less.
  const plain = await measure(url, false)
  const withExt = await measure(url, true)
  let n = 0
  for (const [key, a] of withExt) {
    const b = plain.get(key)
    if (!b) continue
    n++
    compared++
    if (Math.abs(a.w - b.w) > TOLERANCE || Math.abs(a.h - b.h) > TOLERANCE) {
      failures++
      console.log(`FAIL ${url}: ${key} is ${a.w}x${a.h} with the overlay, ${b.w}x${b.h} without`)
    }
  }
  console.log(`${url}: compared ${n} boxes present in both runs`)
}
console.log(`checked ${compared} card boxes, ${failures} resized by the overlay`)
process.exit(failures ? 1 : 0)
