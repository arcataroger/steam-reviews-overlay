// Post-build for the Safari target: drop manifest keys Safari's converter warns about.
import fs from 'node:fs'
const p = new URL('../dist/safari/manifest.json', import.meta.url)
const m = JSON.parse(fs.readFileSync(p, 'utf8'))
if (m.background?.type) delete m.background.type
for (const r of m.web_accessible_resources ?? []) delete r.use_dynamic_url
fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n')
console.log('safari manifest cleaned')
