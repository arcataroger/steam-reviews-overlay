#!/usr/bin/env node
// Positive controls for the visual harness's mechanical checks.
//
// Those checks are only worth reading if they fire on a real fault and stay quiet otherwise. Both
// spent several rounds crying wolf — the overlap check measured element boxes instead of glyph
// boxes, and the duplicate-label check read our own badge's text back through Steam's review
// column — so after quieting them this proves they can still see the thing they are for.
//
// Usage: node scripts/harness-selftest.mjs [url]
import { chromium } from 'playwright'
import path from 'node:path'
import crypto from 'node:crypto'
import { CHECKS } from './visual-pass.mjs'

const url = process.argv[2] || 'https://store.steampowered.com/search/?term=roguelike'
const ext = process.env.SRO_EXT_DIR ? path.resolve(process.env.SRO_EXT_DIR) : path.resolve(import.meta.dirname, '..', 'dist', 'chrome')
const id = [...crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new'],
  viewport: { width: 1400, height: 1000 },
  locale: 'en-US',
})
const pop = await ctx.newPage()
await pop.goto(`chrome-extension://${id}/src/popup/index.html`)
await pop.evaluate((o) => chrome.storage.sync.set(o), { 'sro:settings:v4': { mode: 'dim', threshold: 5, source: 'local', highlightThreshold: 7 } })
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(8000)

const count = async (kind) => (await page.evaluate(CHECKS)).issues.filter((i) => i.kind === kind).length
const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// 1. Quiet on an untouched page: every flag here has proved false on inspection.
const overlapsAtRest = await count('badge-overlaps-text')
const duplicatesAtRest = await count('plain-badge-beside-native')
record('no overlap flags on an untouched page', overlapsAtRest === 0, `${overlapsAtRest} flag(s)`)
record('no duplicate-label flags on an untouched page', duplicatesAtRest === 0, `${duplicatesAtRest} flag(s)`)

// 2. A badge dragged onto a title's glyphs must be flagged.
const moved = await page.evaluate(() => {
  for (const card of document.querySelectorAll('[data-sro-card]')) {
    const badge = card.querySelector('.sro-badge')
    const title = card.querySelector('.title, [class*="title" i]')
    if (!badge || !title || !(title.textContent || '').trim()) continue
    const tr = title.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative'
    Object.assign(badge.style, { position: 'absolute', left: `${tr.left - cr.left + 4}px`, top: `${tr.top - cr.top}px`, right: 'auto', bottom: 'auto' })
    return (title.textContent || '').trim().slice(0, 40)
  }
  return null
})
await page.waitForTimeout(300)
const overlapsMoved = await count('badge-overlaps-text')
record('a badge moved onto a title is flagged', !!moved && overlapsMoved > overlapsAtRest, `${overlapsMoved} flag(s), moved onto "${moved}"`)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)

// 3. A genuine Steam summary beside a plain single-line badge must be flagged.
// Built as a standalone element rather than planted on a real card: the extension reacts correctly
// to a native summary by withdrawing its own plain label, so a real card can never hold this state.
// With no app link and no data-ds-appid inside, the content script never claims this element.
const planted = await page.evaluate(() => {
  // A badge with exactly one line: the two-line 🇺🇸/🌐 pair is a different case, and which of them
  // comes first in the DOM depends on whichever games the page happens to be showing. Taking the
  // first badge made this control fail on any page whose first card carries the pair.
  const real = [...document.querySelectorAll('.sro-badge')].find((b) => b.querySelectorAll('.sro-line').length === 1)
  if (!real) return null
  const card = document.createElement('div')
  card.setAttribute('data-sro-card', '620')
  // Fixed in the viewport: the search page keeps growing, so anything appended to the body ends up
  // far below the fold and the checks skip whatever is off screen.
  card.style.cssText = 'position:fixed;top:20px;left:20px;width:400px;height:60px;z-index:99999'
  const badge = real.cloneNode(true)
  badge.removeAttribute('style')
  badge.classList.remove('sro-beside-native')
  const native = document.createElement('span')
  native.className = 'review_summary'
  native.textContent = 'Very Positive'
  card.append(native, badge)
  document.body.appendChild(card)
  return { lines: badge.querySelectorAll('.sro-line').length }
})
await page.waitForTimeout(500)
const duplicatesPlanted = await count('plain-badge-beside-native')
record("Steam's own summary beside a plain badge is flagged", !!planted && planted.lines === 1 && duplicatesPlanted > duplicatesAtRest, `${duplicatesPlanted} flag(s)`)

await ctx.close()
const failed = results.filter((r) => !r.ok).length
console.log(failed === 0 ? 'harness self-test passed' : `harness self-test FAILED on ${failed} control(s)`)
process.exit(failed ? 1 : 0)
