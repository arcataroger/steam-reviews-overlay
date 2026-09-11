# Steam Reviews Overlay

Browser extension (Chrome + Firefox, Manifest V3) that shows each game's review
summary ("Very Positive", "Mixed", "Mostly Negative", ...) directly on game
cards across the Steam store, so you don't have to hover every capsule.

- Works on the front page, search results, category/tag pages, sale pages,
  "more like this" carousels on app pages, and anything else that links to
  `/app/<id>`. Dynamically loaded content is picked up via a `MutationObserver`.
- The badge sits inline right after the price when there is one, otherwise in
  the lower-right corner of the card.
- Uses Steam's own review colors: positive `#66c0f4`, mixed `#b9a074`,
  negative `#a34c25`. Each card also gets `data-sro-tone="positive|mixed|negative|none"`
  and `data-sro-score="0-9"` so future overlays (dimming, hiding, etc.) can hook
  in with plain CSS.
- Toolbar popup (click the icon) with a filter: set a minimum
  positive-review percentage on the slider (0–100, snaps to Steam's named
  tiers: Mostly Negative 20%, Mixed 40%, Mostly Positive 70%, Very Positive
  80%, Overwhelmingly Positive 95%, also clickable as chips) and choose whether
  games below it are just **Labeled** (default),
  **Dimmed** (black overlay, still clickable) or **Hidden** (fade out, then
  collapsed with `display:none` so lists reflow). Optionally treat "No user
  reviews" as below the bar. Settings sync via `storage.sync` and apply live
  to open tabs.
- Data is Steam's own, never recomputed:
  1. Summaries already rendered on the page are reused (search rows carry the
     label, percent and count in a tooltip; the homepage embeds
     `review_summary_filtered` JSON). Those ids are never fetched.
  2. Everything else goes in one batched, protobuf-encoded request per page to
     `api.steampowered.com/IStoreBrowseService/GetItems` (no key needed, up to
     400 ids per call). We use Steam's `summary_filtered`: label, 0-9 score,
     integer percent positive, review count.
  3. Two scores per game: Steam's language-specific summary for your Steam
     language (flag icon, on top) and the all-languages summary (globe icon).
     The popup's "judged by" toggle picks which one the filter uses.
  4. Cache is stale-while-revalidate keyed to Steam's own freshness: each batch
     response carries `Cache-Control: max-age=N` counting down the life of
     Steam's CDN copy, and the entry expires at exactly that moment (+1 s), so
     the next fetch is guaranteed a refreshed copy. Entries are shown while
     revalidating for up to 15 min, then dropped. Persistence only exists to
     survive reloads and back/forward navigation.
- Filtering follows Steam's algorithm: on a named notch the comparison is by
  Steam's tier (`review_score`), which is what Steam's own "sort by reviews"
  does and respects its review-count rules (e.g. 96% with 300 reviews is
  "Very Positive", not "Overwhelmingly"). Between notches the comparison uses
  Steam's integer percent. Games Steam gives no score to (under 10 reviews)
  are labeled with Steam's text ("3 user reviews", "No user reviews") and
  only filtered if "Treat games with no reviews as below the bar" is on.
  Steam's "Positive" (80%+ with 10–49 reviews) passes the "Very Positive" notch
  because it is the same percentage band.

## Build

```sh
npm install
npm run build            # builds dist/chrome and dist/firefox
npm run build:chrome
npm run build:firefox
npm run dev              # CRXJS dev server with HMR (Chrome)
```

## Load

- **Chrome/Edge/Brave**: `chrome://extensions` → Developer mode → "Load
  unpacked" → pick `dist/chrome`.
- **Firefox**: `about:debugging#/runtime/this-firefox` → "Load Temporary
  Add-on…" → pick `dist/firefox/manifest.json`. Or `npx web-ext run
  --source-dir dist/firefox`.

## Test

`scripts/smoke.mjs` loads the built Chrome extension into Playwright's
Chromium, visits store pages, and reports how many cards got badges plus a
screenshot:

```sh
npm run build:chrome
node scripts/smoke.mjs ./shots https://store.steampowered.com/ "https://store.steampowered.com/search/?term=roguelike"
node scripts/debug-cards.mjs ./shots https://store.steampowered.com/specials 6   # dump every claimed card
node scripts/popup-test.mjs ./shots        # drives the popup, checks dim/hide apply live
node scripts/netcount.mjs <urls...>        # counts requests the extension makes per page
node scripts/make-icons.mjs                # re-rasterize public/icon.svg → PNGs
```

## Layout

All styling lives in `src/content.css` (`.sro-badge`, `.sro-inline`,
`.sro-corner`, tone classes, and the `[data-sro-filtered="dim|hide"]` rules).
The popup is `src/popup/`; shared settings live in `src/settings.ts`. Card detection and placement heuristics are in
`src/content.ts` (`findCard`, `findPriceEl`, `placeBadge`).
