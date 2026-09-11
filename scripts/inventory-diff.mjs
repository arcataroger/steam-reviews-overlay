// Compare two master inventories (e.g. the committed one against a fresh crawl) and report what
// Steam changed: kinds that appeared, disappeared, changed their hashed classes, or lost coverage.
// Usage: node scripts/inventory-diff.mjs <old master.json> <new master.json>
import fs from 'node:fs'

const [oldPath, newPath] = process.argv.slice(2)
if (!oldPath || !newPath) {
  console.error('usage: node scripts/inventory-diff.mjs <old master.json> <new master.json>')
  process.exit(1)
}
const a = JSON.parse(fs.readFileSync(oldPath, 'utf8'))
const b = JSON.parse(fs.readFileSync(newPath, 'utf8'))
const byKey = (m) => new Map(m.kinds.map((k) => [k.key, k]))
const A = byKey(a)
const B = byKey(b)
let changes = 0
const say = (s) => {
  changes++
  console.log(s)
}
for (const [key, k] of B) {
  const o = A.get(key)
  if (!o) {
    say(`+ NEW kind ${k.id} ${k.name || '(unnamed)'} \`${key}\` — ${k.count} cards on ${Object.keys(k.pages).length} page(s); coverage ${k.coverage.status}`)
    continue
  }
  const oldSigs = Object.keys(o.signatures).sort().join(' ')
  const newSigs = Object.keys(k.signatures).sort().join(' ')
  if (oldSigs !== newSigs) say(`~ ${k.id} ${k.name || key}: hashed classes changed\n    was ${oldSigs}\n    now ${newSigs}`)
  if (o.coverage.status !== k.coverage.status) say(`! ${k.id} ${k.name || key}: coverage ${o.coverage.status} → ${k.coverage.status} ${k.coverage.notes.join('; ')}`)
}
for (const [key, o] of A) if (!B.has(key)) say(`- GONE kind ${o.id} ${o.name || '(unnamed)'} \`${key}\` (was ${o.count} cards)`)
const oldPages = new Set(a.pages.map((p) => p.slug))
for (const p of b.pages) if (!oldPages.has(p.slug)) say(`+ new page ${p.slug}`)
for (const p of a.pages) if (!b.pages.some((q) => q.slug === p.slug)) say(`- page no longer crawled: ${p.slug}`)
console.log(changes ? `\n${changes} change(s)` : 'No structural changes: same kinds, same classes, same coverage.')
process.exit(changes ? 2 : 0)
