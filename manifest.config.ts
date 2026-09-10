import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

const browser = process.env.TARGET_BROWSER === 'firefox' ? 'firefox' : 'chrome'

export default defineManifest({
  manifest_version: 3,
  name: 'Steam Reviews Overlay',
  description:
    'Shows the review summary ("Very Positive", "Mixed", ...) on every game card on the Steam store without hovering.',
  version: pkg.version,
  icons: {
    16: 'public/icon16.png',
    48: 'public/icon48.png',
    128: 'public/icon128.png',
  },
  permissions: ['storage'],
  host_permissions: ['https://store.steampowered.com/*'],
  content_scripts: [
    {
      matches: ['https://store.steampowered.com/*'],
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
  ...(browser === 'firefox'
    ? {
        browser_specific_settings: {
          gecko: {
            id: 'steam-reviews-overlay@arcataroger',
            strict_min_version: '140.0',
            data_collection_permissions: { required: ['none'] },
          },
        },
      }
    : {}),
})
