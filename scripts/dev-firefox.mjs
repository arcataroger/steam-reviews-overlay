// Firefox dev loop: rebuilds dist/firefox on every source change and runs Firefox with it loaded as a temporary add-on.
// web-ext reloads the extension whenever dist/firefox changes. Close the Firefox window or press Ctrl+C to end.
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const env = { ...process.env, TARGET_BROWSER: 'firefox' }
const bin = (name) => path.join(root, 'node_modules', '.bin', name)

// web-ext needs a manifest to exist before it starts, so build once up front
if (spawnSync(bin('vite'), ['build'], { cwd: root, env, stdio: 'inherit' }).status !== 0) process.exit(1)

const vite = spawn(bin('vite'), ['build', '--watch'], { cwd: root, env, stdio: 'inherit' })
const ext = spawn(bin('web-ext'), [
  'run',
  '--source-dir', 'dist/firefox',
  '--firefox', process.env.FIREFOX ?? 'firefox',
  // a kept profile, so a Steam login survives restarts (personalized home rows only render logged in)
  '--firefox-profile', path.join(root, '.firefox-dev-profile'),
  '--profile-create-if-missing',
  '--keep-profile-changes',
  '--start-url', 'https://store.steampowered.com/search/?term=roguelike',
  '--start-url', 'https://store.steampowered.com/',
  '--browser-console',
], { cwd: root, env, stdio: 'inherit' })

const stop = () => { vite.kill(); ext.kill() }
ext.on('exit', (code) => { vite.kill(); process.exit(code ?? 0) })
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
