import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

const target = process.env.TARGET_BROWSER ?? 'chrome'
// Safari consumes a Chrome-shaped MV3 manifest (converted by Xcode), so it builds as 'chrome'
const browser = target === 'firefox' ? 'firefox' : 'chrome'

export default defineConfig({
  plugins: [crx({ manifest, browser })],
  publicDir: false,
  build: {
    outDir: `dist/${target}`,
    emptyOutDir: true,
  },
})
