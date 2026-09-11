/**
 * Watches the store's own IStoreBrowseService/GetItems calls. When one that asked for reviews
 * completes, tell the content script in that tab to replay the identical URL: the browser serves
 * it from the HTTP cache (Steam marks them public, max-age=120), so we get Steam's freshly
 * fetched review data at zero network cost, before the cards even finish rendering.
 */

import { OWN_MARKER } from './proto'

const ext: typeof chrome = (globalThis as any).browser ?? chrome

ext.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId < 0 || details.statusCode !== 200) return
    if (details.url.includes(OWN_MARKER)) return // our own batch calls
    ext.tabs.sendMessage(details.tabId, { type: 'sro:steam-getitems', url: details.url }).catch(() => {})
  },
  { urls: ['https://api.steampowered.com/IStoreBrowseService/GetItems/*'], types: ['xmlhttprequest'] },
)

/**
 * After an install, update or reload, content scripts in already-open store tabs are orphaned
 * (Chrome cuts them off from extension APIs). Re-inject so those tabs keep working without a
 * manual reload. The fresh script clears any leftovers from the old instance on startup.
 */
ext.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install' && reason !== 'update') return // browser updates don't orphan content scripts
  const files = ext.runtime.getManifest().content_scripts?.flatMap((cs) => cs.js ?? []) ?? []
  if (!files.length) return
  let tabs: chrome.tabs.Tab[] = []
  try {
    tabs = await ext.tabs.query({ url: 'https://store.steampowered.com/*' })
  } catch {
    return
  }
  for (const tab of tabs) {
    if (tab.id === undefined) continue
    ext.scripting.executeScript({ target: { tabId: tab.id }, files }).catch(() => {})
  }
})
