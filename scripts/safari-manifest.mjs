// Post-build for the Safari target: drop the one manifest key Safari's converter warns about that
// is safe to drop. background.type is kept: CRXJS's service-worker loader is an ES module import,
// so removing "type": "module" would break the worker (the converter's warning is only a warning).
import fs from 'node:fs'
const p = new URL('../dist/safari/manifest.json', import.meta.url)
const m = JSON.parse(fs.readFileSync(p, 'utf8'))
for (const r of m.web_accessible_resources ?? []) delete r.use_dynamic_url
fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n')
console.log('safari manifest cleaned')
