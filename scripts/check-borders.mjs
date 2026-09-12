#!/usr/bin/env node
// Verify highlight borders from pixels alone: reads a segment-cards.mjs crop dir's manifest.json,
// decodes each card's PNG, and runs the pure checks in scripts/lib/border-check.mjs against it.
// This never reads content.css or the DOM — it's independent evidence the rendered page matches
// what the manifest says it should.
//
// Usage: node scripts/check-borders.mjs <cropDir> [--json <path>] [--only <substring>]
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { checkCard } from './lib/border-check.mjs'

const args = process.argv.slice(2)
const cropDir = args[0]
if (!cropDir || cropDir.startsWith('--')) {
  console.error('usage: node scripts/check-borders.mjs <cropDir> [--json <path>] [--only <substring>]')
  process.exit(1)
}

let jsonOut = null
let only = null
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--json') jsonOut = args[++i]
  else if (args[i] === '--only') only = args[++i]
  else {
    console.error(`unknown argument: ${args[i]}`)
    process.exit(1)
  }
}

const manifestPath = path.join(cropDir, 'manifest.json')
if (!fs.existsSync(manifestPath)) {
  console.error(`no manifest.json in ${cropDir} — run scripts/segment-cards.mjs on a capture dir first`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
} catch (err) {
  console.error(`could not parse ${manifestPath}: ${err.message}`)
  process.exit(1)
}

const cards = Array.isArray(manifest.cards) ? manifest.cards : []

// Pair every active-state card with the same card from the labels-state capture, where the overlay
// draws no highlight at all. Steam's own accent blue is the very colour we highlight in, so only
// the difference between the two states is ours. Key on the exact rect: a card that moved (a
// rotating carousel) has no twin and its "should have no highlight" edges go unjudged rather than
// being blamed for Steam's own colours.
const twinKey = (c) => `${c.slug}__${c.stop}__${c.appid}__${c.rect.x},${c.rect.y},${c.rect.w},${c.rect.h}`
const baselines = new Map()
for (const c of cards) if (c.state === 'labels') baselines.set(twinKey(c), c.file)
const selected = only ? cards.filter((c) => (c.file || '').includes(only)) : cards

const results = []
let failures = 0

for (const card of selected) {
  const file = card.file
  const pngPath = path.join(cropDir, file)
  let result
  try {
    const buf = fs.readFileSync(pngPath)
    const png = PNG.sync.read(buf)
    const image = { width: png.width, height: png.height, data: png.data }
    let baseline = null
    const twin = card.state === 'active' ? baselines.get(twinKey(card)) : null
    if (twin && twin !== card.file) {
      try {
        const b = PNG.sync.read(fs.readFileSync(path.join(cropDir, twin)))
        if (b.width === png.width && b.height === png.height) baseline = { width: b.width, height: b.height, data: b.data }
      } catch {
        baseline = null
      }
    }
    // Crops are cut in device pixels, so the band geometry must use the device-pixel padding.
    const padPx = manifest.padPx ?? Math.round((manifest.pad ?? 12) * (manifest.dpr ?? 1))
    result = checkCard(image, card, { pad: padPx, baseline, negativeNeedsBaseline: true })
    result.twin = twin || null
  } catch (err) {
    result = { ok: false, edges: {}, notes: [`could not read/check ${file}: ${err.message}`] }
  }

  if (!result.ok) failures++
  results.push({ file, state: card.state, ...result })

  if (!result.ok) {
    const colourLabel = card.color ? String(card.color).replace(/^#/, '') : 'none'
    for (const [name, edge] of Object.entries(result.edges)) {
      if (edge.pass) continue
      const expectedLabel = edge.expected ? colourLabel : 'none'
      console.log(`FAIL ${file}: edge ${name} expected ${expectedLabel} got ${edge.fraction.toFixed(2)}`)
    }
    for (const note of result.notes) {
      if (note) console.log(`  note ${file}: ${note}`)
    }
  }
}

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true })
  fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2) + '\n')
}

// labels-state crops exist to be the baseline for their active-state twin: every card there is
// parked, so nothing is expected and no edge can be judged without a twin of its own. Counting them
// as "checked" inflated the total and made the unjudged tally look far worse than it was.
const judged = results.filter((r) => r.state !== 'labels')
const baselinesOnly = results.length - judged.length
const paired = judged.filter((r) => r.twin).length
const unjudged = judged.reduce((n, r) => n + Object.values(r.edges || {}).filter((e) => e.unverified).length, 0)
console.log(
  `checked ${judged.length} cards, ${failures} failures ` +
    `(${paired} paired with an un-highlighted twin, ${unjudged} edges unjudged for want of one; ` +
    `${baselinesOnly} labels-state crops read as baselines)`,
)
process.exit(failures > 0 ? 1 : 0)
