import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

const target = process.env.TARGET_BROWSER ?? 'chrome'
const browser = target === 'firefox' ? 'firefox' : 'chrome'

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  version: pkg.version,
  icons: {
    16: 'public/icon16.png',
    32: 'public/icon32.png',
    48: 'public/icon48.png',
    128: 'public/icon128.png',
  },
  permissions: ['storage', 'webRequest', 'scripting'],
  action: {
    default_title: '__MSG_extName__',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icon16.png',
      32: 'public/icon32.png',
      48: 'public/icon48.png',
    },
  },
  host_permissions: ['https://store.steampowered.com/*', 'https://api.steampowered.com/*'],
  background:
    browser === 'firefox'
      ? ({ scripts: ['src/background.ts'], type: 'module' } as any)
      : { service_worker: 'src/background.ts', type: 'module' },
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
          gecko_android: { strict_min_version: '142.0' },
        } as any,
      }
    : {}),
})
