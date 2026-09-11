/**
 * Watches the store's own IStoreBrowseService/GetItems calls. When one that asked for reviews
 * completes, tell the content script in that tab to replay the identical URL: the browser serves
 * it from the HTTP cache (Steam marks them public, max-age=120), so we get Steam's freshly
 * fetched review data at zero network cost, before the cards even finish rendering.
 */

const ext: typeof chrome = (globalThis as any).browser ?? chrome

export const OWN_MARKER = 'sro=1'

ext.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId < 0 || details.statusCode !== 200) return
    if (details.url.includes(OWN_MARKER)) return // our own batch calls
    ext.tabs.sendMessage(details.tabId, { type: 'sro:steam-getitems', url: details.url }).catch(() => {})
  },
  { urls: ['https://api.steampowered.com/IStoreBrowseService/GetItems/*'], types: ['xmlhttprequest'] },
)
