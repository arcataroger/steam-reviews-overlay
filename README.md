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
node scripts/popup-test.mjs ./shots        # drives the popup, checks dim/hide apply live
node scripts/make-icons.mjs                # re-rasterize public/icon.svg → PNGs
```

## Layout

All styling lives in `src/content.css` (`.sro-badge`, `.sro-inline`,
`.sro-corner`, tone classes, and the `[data-sro-filtered="dim|hide"]` rules).
The popup is `src/popup/`; shared settings live in `src/settings.ts`. Card detection and placement heuristics are in
`src/content.ts` (`findCard`, `findPriceEl`, `placeBadge`).
