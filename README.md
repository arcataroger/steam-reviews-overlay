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
- Data comes from Steam's public `store.steampowered.com/appreviews/<id>?json=1`
  endpoint (all languages, all purchase types). Responses are cached in
  `storage.local` for 24 h, fetches are lazy (only cards near the viewport)
  and throttled (4 in flight, backs off on 429).

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
```

## Layout

All styling lives in `src/content.css` (`.sro-badge`, `.sro-inline`,
`.sro-corner`, tone classes). Card detection and placement heuristics are in
`src/content.ts` (`findCard`, `findPriceEl`, `placeBadge`).
