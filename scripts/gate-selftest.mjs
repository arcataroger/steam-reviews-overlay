#!/usr/bin/env node
// Prove the border gate still bites. For each falsification, rewrite the manifest to lie about the
// treatment in one specific way, re-run the gate over the SAME pixels, and require that it fails
// (nearly) every card it was lied to about. A gate that reports 0 failures on truthful manifests is
// only evidence of anything if it reports failures when the manifest is wrong.
//
// Usage: node scripts/gate-selftest.mjs <cropDir> [--min 0.9]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { FALSIFICATIONS, falsifyManifest } from './lib/falsify.mjs'

const args = process.argv.slice(2)
const cropDir = args[0]
if (!cropDir || cropDir.startsWith('--')) {
  console.error('usage: node scripts/gate-selftest.mjs <cropDir> [--min 0.9]')
  process.exit(1)
}
let min = 0.9
for (let i = 1; i < args.length; i++) if (args[i] === '--min') min = Number(args[++i])

const manifest = JSON.parse(fs.readFileSync(path.join(cropDir, 'manifest.json'), 'utf8'))
const here = path.dirname(new URL(import.meta.url).pathname)
let bad = 0

for (const mode of Object.keys(FALSIFICATIONS)) {
  const { manifest: lied, falsified } = falsifyManifest(manifest, mode)
  if (falsified.length === 0) {
    console.log(`${mode}: no cards of that kind in this capture, skipped`)
    continue
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sro-gate-${mode}-`))
  // Symlink the real pixels: the lie is only ever in the manifest.
  for (const file of fs.readdirSync(cropDir)) {
    if (file.endsWith('.png')) fs.symlinkSync(path.resolve(cropDir, file), path.join(dir, file))
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(lied))
  const jsonPath = path.join(dir, 'result.json')
  try {
    execFileSync('node', [path.join(here, 'check-borders.mjs'), dir, '--json', jsonPath], { stdio: 'ignore' })
  } catch {
    // a non-zero exit is exactly what we want here
  }
  const results = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const caught = new Set(results.filter((r) => !r.ok).map((r) => r.file))
  const hit = falsified.filter((f) => caught.has(f)).length
  const rate = hit / falsified.length
  const ok = rate >= min
  if (!ok) bad++
  console.log(`${mode}: ${hit}/${falsified.length} falsified cards caught (${(rate * 100).toFixed(0)}%) ${ok ? 'OK' : `TOO LOW, want ${(min * 100).toFixed(0)}%`}`)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(bad === 0 ? 'gate self-test passed' : `gate self-test FAILED on ${bad} falsification(s)`)
process.exit(bad > 0 ? 1 : 0)
