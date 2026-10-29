// Signs the Firefox build on AMO as an unlisted (private) add-on and saves the signed .xpi to web-ext-artifacts/.
// Needs WEB_EXT_API_KEY (the JWT issuer, "user:...") and WEB_EXT_API_SECRET from AMO's "Manage API Keys" page.
// npm run publish:firefox loads them from .env (git-ignored) when it exists.
// AMO accepts each version once, so bump "version" in package.json before every run.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const artifacts = path.join(root, 'web-ext-artifacts')
const bin = (name) => path.join(root, 'node_modules', '.bin', name)
const run = (cmd, args, env = process.env) => {
  if (spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit' }).status !== 0) process.exit(1)
}

for (const name of ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET']) {
  if (!process.env[name]) { console.error(`Set ${name} first (AMO → Developer Hub → Manage API Keys).`); process.exit(1) }
}

// catch the common mistake locally instead of after an upload: a signed file for this version already exists
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
if (existsSync(artifacts) && readdirSync(artifacts).some((f) => f.endsWith(`-${version}.xpi`))) {
  console.error(`Version ${version} is already signed (see web-ext-artifacts/). Bump "version" in package.json.`)
  process.exit(1)
}

run('npm', ['run', 'lint']) // builds dist/firefox, then runs AMO's linter on it
run(bin('web-ext'), ['sign', '--channel', 'unlisted', '--source-dir', 'dist/firefox', '--artifacts-dir', artifacts])
