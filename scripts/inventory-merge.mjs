// Merge inventory runs into the master set of card kinds and map the extension's treatment onto it.
// Usage: node scripts/inventory-merge.mjs <outdir> <run dir> [run dir...]
//   reads every <slug>.json in the run dirs, dedupes by structural signature, applies the curated
//   names in docs/inventory/kind-names.json, and writes <outdir>/master.json + <outdir>/master.md.
import fs from 'node:fs'
import path from 'node:path'

import { pathToFileURL } from 'node:url'

// Importing this file (the coverage tests do) must not run the CLI.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const [outDir, ...runDirs] = isMain ? process.argv.slice(2) : []
if (isMain && (!outDir || !runDirs.length)) {
  console.error('usage: node scripts/inventory-merge.mjs <outdir> <run dir> [run dir...]')
  process.exit(1)
}
const namesFile = path.resolve(import.meta.dirname, '..', 'docs', 'inventory', 'kind-names.json')
const names = fs.existsSync(namesFile) ? JSON.parse(fs.readFileSync(namesFile, 'utf8')) : {}
// Some items in a kind carry no label on purpose: a package or bundle capsule sitting on a shelf of
// games, an app page's own game, a banner that is not a game at all. Without somewhere to record
// that, every crawl re-reports them and a real gap has to be picked out of the noise by hand.
// Each entry is { reason, unclaimed } where `unclaimed` is how many were deliberately skipped when
// the kind was last reviewed. Going over that budget flags the kind again.
const expectFile = path.resolve(import.meta.dirname, '..', 'docs', 'inventory', 'kind-expectations.json')
const expectations = fs.existsSync(expectFile) ? JSON.parse(fs.readFileSync(expectFile, 'utf8')) : {}

// Signature normalisation for the master key: hashed CSS-module classes change whenever Steam
// rebuilds, so the key keeps only stable tokens plus a count of hashed ones; the exact hashes are
// recorded alongside for selector authoring.
const HASH_RE = /^_?[A-Za-z0-9_-]{18,}$/
const topKey = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
const masterKey = (k) => {
  const [tagId, ...classes] = k.signature.split('.')
  const stable = classes.filter((c) => !HASH_RE.test(c))
  const hashed = classes.length - stable.length
  // Hash-only React kinds are told apart by where they live and what they are made of
  const where = topKey(k.sections).replace(/\d+/g, 'N')
  const what = `${k.features.link}${k.features.img ? ',art' : ''}${k.features.carousel ? ',carousel' : ''}${k.features.artFraction >= 0.5 ? ',art≥50%' : ''}`
  return `${tagId}.${stable.join('.')}${hashed ? `+${hashed}h` : ''}${stable.length ? '' : `|${where}|${what}`}`
}

const pages = []
for (const dir of runDirs) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'pages.json' || f === 'master.json') continue
    const pg = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (!pg.error) pages.push({ slug: f.replace(/\.json$/, ''), ...pg })
  }
}

const kinds = new Map()
const bump = (obj, k, n = 1) => (obj[k] = (obj[k] || 0) + n)
for (const pg of pages) {
  for (const k of pg.kinds) {
    // One master kind per structural signature; feature variants (price/date/native summary…)
    // are folded in as variants so "search row with thumbs icon" and "without" stay together.
    const key = masterKey(k)
    let m = kinds.get(key)
    if (!m) {
      m = { id: '', key, signatures: {}, pages: {}, count: 0, variants: {}, sizes: {}, headings: {}, sections: {}, chains: {}, ours: {}, features: {}, examples: [] }
      kinds.set(key, m)
    }
    bump(m.signatures, k.signature, k.count)
    bump(m.pages, pg.slug, k.count)
    m.count += k.count
    bump(m.variants, k.featureKey, k.count)
    for (const [s, n] of Object.entries(k.sizes)) bump(m.sizes, s, n)
    for (const [s, n] of Object.entries(k.headings)) bump(m.headings, s, n)
    for (const [s, n] of Object.entries(k.sections)) bump(m.sections, s, n)
    for (const [s, n] of Object.entries(k.chains)) bump(m.chains, s, n)
    for (const [s, n] of Object.entries(k.ours)) {
      bump(m.ours, s, n)
      // A missing label only counts against coverage when Steam prints no summary of its own
      if (!k.features.nativeSummary && /\|badge=none$/.test(s)) m.noBadgeNonNative = (m.noBadgeNonNative || 0) + n
    }
    for (const f of ['link', 'img', 'price', 'date', 'nativeSummary', 'title', 'platforms', 'carousel', 'discount']) {
      m.features[f] ??= {}
      bump(m.features[f], String(k.features[f]), k.count)
    }
    if (m.examples.length < 3 && k.examples[0]) m.examples.push({ page: pg.slug, ...k.examples[0] })
  }
}

// Coverage verdict from the recorded treatment
export const verdict = (m, expect = expectations) => {
  const total = m.count
  let unclaimed = 0
  let other = 0
  let noBadge = 0
  let shapes = {}
  let badges = {}
  for (const [k, n] of Object.entries(m.ours)) {
    const [claim, shape, badge] = k.split('|')
    if (claim === 'unclaimed') unclaimed += n
    else if (claim.startsWith('other:')) other += n
    if (badge === 'badge=none') noBadge += n
    bump(shapes, shape.replace('shape=', ''), n)
    bump(badges, badge.replace('badge=', '').replace('sro-badge ', ''), n)
  }
  const narrow = Object.keys(m.sizes).every((s) => Number(s.split('x')[0]) < 120)
  const missing = narrow ? 0 : m.noBadgeNonNative || 0
  // Plain text links (no artwork, under 60px tall) are prose, not cards: the overlay skips them by design
  const textLink = !(m.features.img?.true > 0) && Object.keys(m.sizes).every((s) => Number(s.split('x')[1]) < 60)
  const notes = []
  if (unclaimed) notes.push(`${unclaimed}/${total} unclaimed`)
  if (other) notes.push(`${other}/${total} claimed on a different element`)
  if (missing) notes.push(`${missing}/${total} without a label although Steam shows no summary`)
  let status = textLink && unclaimed === total ? 'text-link' : unclaimed === total ? 'gap' : unclaimed || other || missing ? 'partial' : 'covered'
  const expected = expect[m.key]
  if (expected && status !== 'covered') {
    const budget = expected.unclaimed ?? 0
    const missingBudget = expected.missing ?? 0
    if (unclaimed <= budget && missing <= missingBudget && !other) {
      status = 'by-design'
      notes.length = 0
      notes.push(`${unclaimed + missing}/${total} unlabelled on purpose: ${expected.reason}`)
    } else {
      notes.push(`expected at most ${budget} unclaimed and ${missingBudget} unlabelled (${expected.reason})`)
    }
  }
  return { status, notes, shapes, badges, unclaimed, other, noBadge, missing }
}

const list = [...kinds.values()].sort((a, b) => b.count - a.count)
list.forEach((m, i) => {
  m.id = `K${String(i + 1).padStart(2, '0')}`
  m.name = names[m.key] || null
  m.coverage = verdict(m)
})
if (isMain) {
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'master.json'), JSON.stringify({ generatedAt: new Date().toISOString(), pages: pages.map((p) => ({ slug: p.slug, url: p.url, finalUrl: p.finalUrl, cards: p.cards, kinds: p.kinds.length })), kinds: list }, null, 1))

  const top = (obj, n = 3) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => (v > 1 ? `${k} ×${v}` : k))
  const md = []
  md.push(`# Steam game-card inventory (master set)\n`)
  md.push(`Generated ${new Date().toISOString().slice(0, 10)} from ${pages.length} pages, ${list.length} kinds, ${list.reduce((n, m) => n + m.count, 0)} cards. Regenerate with \`npm run inventory\` (see .claude/skills/steam-inventory).\n`)
  const unnamed = list.filter((m) => !m.name)
  if (unnamed.length) md.push(`> ${unnamed.length} kind(s) have no curated name yet: add them to docs/inventory/kind-names.json (key = master key).\n`)
  md.push(`| id | name | master key | pages | cards | sizes | features | our treatment | coverage |`)
  md.push(`|---|---|---|---|---|---|---|---|---|`)
  for (const m of list) {
    const f = m.features
    const feat = [f.link?.news ? 'news-link' : '', f.price?.true ? `price${f.price.false ? '?' : ''}` : '', f.date?.true ? `date${f.date.false ? '?' : ''}` : '', f.nativeSummary?.true ? `native${f.nativeSummary.false ? '?' : ''}` : '', f.carousel?.true ? 'carousel' : '', f.platforms?.true ? 'platforms' : ''].filter(Boolean).join(' ')
    const ours = `${top(m.coverage.shapes, 2).join('/')} · ${top(m.coverage.badges, 2).join('/')}`
    md.push(`| ${m.id} | ${m.name || '_unnamed_'} | \`${m.key}\` | ${Object.keys(m.pages).length} | ${m.count} | ${top(m.sizes, 2).join(', ')} | ${feat} | ${ours} | **${m.coverage.status}**${m.coverage.notes.length ? ' — ' + m.coverage.notes.join('; ') : ''} |`)
  }
  md.push(`\n## Kinds in detail\n`)
  for (const m of list) {
    md.push(`### ${m.id} ${m.name || '_unnamed_'}\n`)
    md.push(`- Master key: \`${m.key}\`; exact signatures: ${Object.keys(m.signatures).map((s) => `\`${s}\``).join(', ')}`)
    md.push(`- Seen on: ${top(m.pages, 6).join(', ')}${Object.keys(m.pages).length > 6 ? ` (+${Object.keys(m.pages).length - 6})` : ''}`)
    md.push(`- Under headings: ${top(m.headings, 4).join(' / ') || '-'}; section: ${top(m.sections, 2).join(' / ') || '-'}`)
    md.push(`- Ancestors: ${top(m.chains, 1)[0] || '-'}`)
    md.push(`- Variants: ${Object.entries(m.variants).map(([k, n]) => `${k.replace(/link=app,?/, '')} ×${n}`).join('; ')}`)
    md.push(`- Our treatment: ${top(m.ours, 4).join(' ; ')}`)
    md.push(`- Coverage: **${m.coverage.status}** ${m.coverage.notes.join('; ')}`)
    const ex = m.examples[0]
    if (ex) md.push(`- Example (${ex.page}, appid ${ex.appid} "${ex.title}", ${ex.sizeBucket}): card ${JSON.stringify(ex.styles.card)}; parent ${JSON.stringify(ex.styles.parent)}${ex.styles.price ? `; price ${JSON.stringify(ex.styles.price)}` : ''}${ex.styles.native ? `; native ${JSON.stringify(ex.styles.native)}` : ''}`)
    md.push('')
  }
  fs.writeFileSync(path.join(outDir, 'master.md'), md.join('\n'))
  console.log(`${list.length} kinds from ${pages.length} pages → ${outDir}/master.{json,md}; ${unnamed.length} unnamed; coverage: ${['covered', 'by-design', 'partial', 'gap', 'text-link'].map((s) => `${s} ${list.filter((m) => m.coverage.status === s).length}`).join(', ')}`)
}
