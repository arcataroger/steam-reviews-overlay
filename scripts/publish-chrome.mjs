// Uploads a release zip to the Chrome Web Store and submits it for review. The API cannot change
// the listing, so a release with new screenshots uses --upload-only, then finishes in the dashboard.
// Auth impersonates a service account through gcloud, so there is no key file: see the README.
//
//   npm run publish:chrome                  upload release/<zip for this version>, then submit it
//   npm run publish:chrome -- --upload-only upload it and leave the draft for the dashboard
//   npm run publish:chrome -- --status      show the store's state and change nothing
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const PUBLISHER = '4a0c45f1-c3e6-45e4-94da-17b9086a4b0a'
const ITEM = 'ofaaleepnlflabmjpaieodjgpgddaein'
const ACCOUNT = 'cws-publisher@steam-reviews-overlay-cws.iam.gserviceaccount.com'
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const API = 'https://chromewebstore.googleapis.com'
const item = `v2/publishers/${PUBLISHER}/items/${ITEM}`
const flag = (name) => process.argv.includes(`--${name}`)

const token = execFileSync('gcloud', ['auth', 'print-access-token', `--impersonate-service-account=${ACCOUNT}`, `--scopes=${SCOPE}`], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'], // gcloud's own errors explain a failed sign-in
}).trim()
const call = async (url, init = {}) => {
  const res = await fetch(`${API}/${url}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status} ${JSON.stringify(body)}`)
  return body
}
const status = () => call(`${item}:fetchStatus`)

if (flag('status')) {
  console.log(JSON.stringify(await status(), null, 2))
  process.exit(0)
}

const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const zip = path.join(root, 'release', `steam-reviews-overlay-chrome-${version}.zip`)
if (!existsSync(zip)) throw new Error(`${zip} is missing: download it from the GitHub Release for v${version}`)

let upload = await call(`upload/${item}:upload`, { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: readFileSync(zip) })
for (let i = 0; i < 30 && upload.uploadState === 'UPLOAD_IN_PROGRESS'; i++) {
  await new Promise((r) => setTimeout(r, 2000))
  upload = await status()
}
console.log('upload:', JSON.stringify(upload))
// Submitting after a failed upload would send whatever draft the store already holds
if (upload.uploadState !== 'SUCCEEDED') throw new Error(`upload did not succeed (${upload.uploadState}); nothing submitted`)
if (flag('upload-only')) {
  console.log('Uploaded. Finish the listing and submit in the dashboard.')
  process.exit(0)
}
console.log('publish:', JSON.stringify(await call(`${item}:publish`, { method: 'POST' })))
