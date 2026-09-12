// Stage 2: cut every fully-visible card out of visual-pass's screenshots (Stage 1's
// `<slug>__<state>__<stop>.cards.json` sidecars) into its own PNG, named after what it should
// look like, plus a manifest.json the border checker (Stage 3/4) reads.
// Usage: node scripts/segment-cards.mjs <captureDir> [--out <dir>] [--pad N]
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TIER_WORDS = {
  0: 'none',
  1: 'overwhelmingly-negative',
  2: 'very-negative',
  3: 'negative',
  4: 'mostly-negative',
  5: 'mixed',
  6: 'mostly-positive',
  7: 'positive',
  8: 'very-positive',
  9: 'overwhelmingly-positive',
}

/** Tier word for a score, independent of the (possibly localised) badge label. */
export function tierWord(score) {
  return TIER_WORDS[score] ?? 'none'
}

/** `t9-overwhelmingly-positive`, `t0-none`, ... */
export function tierSegment(score) {
  return `t${score}-${tierWord(score)}`
}

/** `none`, `row`, `card`, `panel-y`, `panel-x`, each optionally suffixed `-dim`/`-hide` and/or `-op`. */
export function treatmentString(card) {
  let base = 'none'
  if (card.highlight) {
    base = card.shape ? (card.axis ? `${card.shape}-${card.axis}` : card.shape) : 'none'
  }
  if (card.filtered === 'dim') base += '-dim'
  else if (card.filtered === 'hide' || card.filtered === 'hiding') base += '-hide'
  if (card.op) base += '-op'
  return base
}

/** Lowercase, collapse any run of non `[a-z0-9]` characters to one `-`, trim leading/trailing `-`. */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Title segment: truncated to 40 chars, slugified, falling back to "untitled". */
export function titleSegment(title) {
  return slugify(String(title ?? '').slice(0, 40)) || 'untitled'
}

/** `66c0f4` or `nocolour`. */
export function colourSegment(color) {
  if (!color) return 'nocolour'
  return slugify(String(color).replace(/^#/, '')) || 'nocolour'
}

/**
 * Build the human-facing file name for one card crop. `usedNames` is a Set shared across the
 * whole run: a repeat gets `-2`, `-3`, ... appended before `.png` (mutates `usedNames`).
 */
export function buildFileName({ slug, state, stop, card }, usedNames) {
  const base = [
    slugify(slug),
    slugify(state),
    slugify(stop),
    `app${card.appid}`,
    titleSegment(card.title),
    tierSegment(card.score),
    slugify(treatmentString(card)),
    colourSegment(card.color),
  ].join('__')
  let name = base
  let n = 1
  while (usedNames.has(name)) {
    n += 1
    name = `${base}-${n}`
  }
  usedNames.add(name)
  return `${name}.png`
}

/**
 * Pixel-space crop rectangle for a card: `rect` (CSS px) scaled by `dpr`, padded by `pad` CSS px
 * (also scaled by `dpr`) on every side, then clamped to the image bounds.
 */
export function cropRect(rect, dpr, pad, imageWidth, imageHeight) {
  const x0 = rect.x * dpr - pad * dpr
  const y0 = rect.y * dpr - pad * dpr
  const x1 = (rect.x + rect.w) * dpr + pad * dpr
  const y1 = (rect.y + rect.h) * dpr + pad * dpr
  const x = Math.max(0, Math.round(x0))
  const y = Math.max(0, Math.round(y0))
  const right = Math.min(imageWidth, Math.round(x1))
  const bottom = Math.min(imageHeight, Math.round(y1))
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) }
}

function parseArgs(argv) {
  const [captureDir, ...rest] = argv
  let out = null
  let pad = 12
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--out') out = rest[++i]
    else if (rest[i] === '--pad') pad = Number(rest[++i])
  }
  return { captureDir, out: out ?? (captureDir ? path.join(captureDir, 'cards') : null), pad }
}

function main() {
  const { captureDir, out, pad } = parseArgs(process.argv.slice(2))
  if (!captureDir) {
    console.error('Usage: node scripts/segment-cards.mjs <captureDir> [--out <dir>] [--pad N]')
    process.exit(1)
  }
  fs.mkdirSync(out, { recursive: true })

  const sidecarFiles = fs.readdirSync(captureDir).filter((f) => f.endsWith('.cards.json')).sort()
  const usedNames = new Set()
  const manifestCards = []
  let cropped = 0
  let skipped = 0
  let manifestDpr = null

  for (const sidecarFile of sidecarFiles) {
    let sidecar
    try {
      sidecar = JSON.parse(fs.readFileSync(path.join(captureDir, sidecarFile), 'utf8'))
    } catch {
      continue // unreadable/partial sidecar: skip rather than abort the whole run
    }
    const pngName = sidecarFile.replace(/\.cards\.json$/, '.png')
    const pngPath = path.join(captureDir, pngName)
    if (!fs.existsSync(pngPath)) continue

    const png = PNG.sync.read(fs.readFileSync(pngPath))
    const dpr = sidecar.dpr || 1
    if (manifestDpr === null) manifestDpr = dpr

    for (const card of sidecar.cards ?? []) {
      if (!card.fullyVisible) {
        skipped++
        continue
      }
      const crop = cropRect(card.rect, dpr, pad, png.width, png.height)
      if (crop.w <= 0 || crop.h <= 0) {
        skipped++
        continue
      }
      const dst = new PNG({ width: crop.w, height: crop.h })
      PNG.bitblt(png, dst, crop.x, crop.y, crop.w, crop.h, 0, 0)
      const file = buildFileName({ slug: sidecar.slug, state: sidecar.state, stop: sidecar.stop, card }, usedNames)
      fs.writeFileSync(path.join(out, file), PNG.sync.write(dst))
      manifestCards.push({ file, ...card, slug: sidecar.slug, state: sidecar.state, stop: sidecar.stop, source: pngName, crop })
      cropped++
    }
  }

  // `pad` is the CSS-px option; `padPx` is what was actually cut into the images (pad * dpr), which
  // is the only one the pixel checker can use. Writing just `pad` made every band land short of the
  // card box on any capture at dpr != 1 and failed every correct highlight.
  const dprOut = manifestDpr ?? 1
  fs.writeFileSync(
    path.join(out, 'manifest.json'),
    JSON.stringify({ pad, padPx: Math.round(pad * dprOut), dpr: dprOut, cards: manifestCards }, null, 1),
  )
  console.log(`segment-cards: ${cropped} crops from ${sidecarFiles.length} screenshots, ${skipped} cards skipped (not fully visible)`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) main()
