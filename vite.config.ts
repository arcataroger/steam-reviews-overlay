import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'

const browser = process.env.TARGET_BROWSER === 'firefox' ? 'firefox' : 'chrome'

export default defineConfig({
  plugins: [crx({ manifest, browser })],
  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
  },
})
