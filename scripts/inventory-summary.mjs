// Print a compact table of the card kinds an inventory run found, or one kind's example markup.
// Usage: node scripts/inventory-summary.mjs <dir> [--example <slug> <kindIndex>] [--json]
import fs from 'node:fs'
import path from 'node:path'

const [dir, ...rest] = process.argv.slice(2)
if (!dir) {
  console.error('usage: node scripts/inventory-summary.mjs <dir> [--example <slug> <kindIndex>]')
  process.exit(1)
}
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'pages.json' && f !== 'master.json')
const pages = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
const slugOf = (f) => f.replace(/\.json$/, '')

if (rest[0] === '--example') {
  const [, slug, idx] = rest
  const i = files.findIndex((f) => slugOf(f) === slug)
  if (i < 0) throw new Error(`no page ${slug}`)
  const k = pages[i].kinds[Number(idx)]
  if (!k) throw new Error(`no kind ${idx} on ${slug}`)
  const { examples, ...meta } = k
  console.log(JSON.stringify(meta, null, 1))
  for (const ex of examples) {
    console.log(`\n--- example appid ${ex.appid} "${ex.title}" ${ex.sizeBucket}`)
    console.log('styles:', JSON.stringify(ex.styles))
    console.log('ours:', JSON.stringify(ex.ours))
    console.log(ex.html)
  }
  process.exit(0)
}

const top = (obj, n = 3) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => (v > 1 ? `${k} ×${v}` : k))
for (let i = 0; i < pages.length; i++) {
  const pg = pages[i]
  const slug = slugOf(files[i])
  console.log(`\n## ${slug}  ${pg.url}${pg.finalUrl && pg.finalUrl !== pg.url ? ` → ${pg.finalUrl}` : ''}`)
  if (pg.error) {
    console.log(`  ERROR ${pg.error}`)
    continue
  }
  console.log(`  ${pg.cards} cards, ${pg.kinds.length} kinds${pg.errors?.length ? `, page errors: ${pg.errors.length}` : ''}`)
  pg.kinds.forEach((k, j) => {
    const f = k.features
    const flags = [f.link === 'news' ? 'news-link' : '', f.img ? `art${Math.round(f.artFraction * 100)}%` : 'no-art', f.price ? 'price' : '', f.date ? 'date' : '', f.nativeSummary ? 'native-summary' : '', f.platforms ? 'platforms' : '', f.carousel ? 'carousel' : ''].filter(Boolean).join(' ')
    console.log(`  [${j}] ×${k.count} ${k.signature}`)
    console.log(`      sizes ${top(k.sizes).join(', ')} | ${flags} | parent ${f.parentDisplay} ×${f.siblings}`)
    console.log(`      section ${top(k.sections, 2).join(' / ')} | heading ${top(k.headings, 2).join(' / ') || '-'}`)
    console.log(`      ours: ${top(k.ours, 3).join(' ; ')}`)
  })
}
