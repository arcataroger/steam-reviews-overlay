# Steam Reviews Overlay

Browser extension (Chrome + Firefox, Manifest V3) that shows each game's review
summary ("Very Positive", "Mixed", "Mostly Negative", ...) directly on game
cards across the Steam store, so you don't have to hover every capsule.

- Works on the front page, search results, category/tag pages, sale pages,
  "more like this" carousels on app pages, and anything else that links to
  `/app/<id>`. Dynamically loaded content is picked up via a `MutationObserver`.
- The badge sits inline right after the price when there is one, otherwise in
  the lower-right corner of the card.
- Uses Steam's own review colors, taken from the store's stylesheet:
  positive `#66c0f4`, mixed `#b9a074`, negative `#c85e2d` (Steam uses the same
  color for every negative tier; there is no darker red for Very or
  Overwhelmingly Negative), no-score gray `#929396`. Each card also gets `data-sro-tone="positive|mixed|negative|none"`
  and `data-sro-score="0-9"` so future overlays (dimming, hiding, etc.) can hook
  in with plain CSS.
- Badges read like "Very Positive (83%)": Steam's label plus Steam's exact
  integer percent.
- Toolbar popup (click the icon) styled as a two-lever throttle. The **left
  lever** sets the bar under which games are **dimmed** (black overlay, still
  clickable) or **hidden** (fade out, then collapsed so lists reflow); a
  Dim/Hide switch sits in its readout. The **right lever** sets the bar above
  which games are outlined. Each track runs past its end notch into a parking
  gate marked OFF; a parked lever does nothing. "Under Negative" is a real
  stop (it filters Very Negative and Overwhelmingly Negative), as is "above
  Overwhelmingly Positive". Both levers run along
  Steam's full nine-tier ladder (Overwhelmingly Negative, Very Negative,
  Negative, Mostly Negative, Mixed, Mostly Positive, Positive, Very Positive,
  Overwhelmingly Positive), each notch labeled with Steam's rule for it. Where
  two neighbouring tiers differ by percentage the lever can rest between them
  and the bar becomes that exact percent; where they differ only by review
  count (the three negatives; Positive vs Very Positive) it snaps to a tier.
  The shared notch labels sit between the levers and the tick on each side is
  clickable for that lever. The rails carry a gradient through Steam's three review colors
  (solid negative to 20 %, mixed at 55 %, solid positive from 85 %, blended
  between) and the outline, readout and knob light sample that gradient at
  the lever's position. Settings sync via `storage.sync` and apply live to open tabs.
- Data is Steam's own, never recomputed:
  1. Summaries already rendered on the page are reused (search rows carry the
     label, percent and count in a tooltip; the homepage embeds
     `review_summary_filtered` JSON). Those ids are never fetched.
  2. On pages where Steam's own frontend already calls
     `IStoreBrowseService/GetItems` with reviews (category, tag, sale pages),
     the background script watches those calls complete (`webRequest`) and the
     content script replays the identical URL. The browser serves it from the
     HTTP cache (Steam marks them `public, max-age=120`), so the extension gets
     Steam's freshly fetched data at zero network cost, decoded from protobuf,
     before the cards finish rendering. Measured: 0 extension requests on
     category and sale pages.
  3. Everything else goes in one batched, protobuf-encoded request per page to
     `api.steampowered.com/IStoreBrowseService/GetItems` (no key needed, up to
     400 ids per call). We use Steam's `summary_filtered`: label, 0-9 score,
     integer percent positive, review count.
  4. Two scores per game: Steam's language-specific summary for your Steam
     language (flag icon, on top) and the all-languages summary (globe icon).
     The popup's "judged by" toggle picks which one the filter uses.
  5. Cache is stale-while-revalidate keyed to Steam's own freshness: each batch
     response carries `Cache-Control: max-age=N` counting down the life of
     Steam's CDN copy, and the entry expires at exactly that moment, so
     the next fetch is guaranteed a refreshed copy. Entries are shown while
     revalidating for up to 15 min, then dropped. Persistence only exists to
     survive reloads and back/forward navigation.
- Filtering follows Steam's algorithm: on a tier the comparison is by
  Steam's `review_score` (what Steam's own "sort by reviews" does, so its
  review-count rules apply: 96% with 300 reviews is "Very Positive", not
  "Overwhelmingly", and "Positive" ranks under "Very Positive"). Between tiers
  the comparison uses Steam's integer percent. Games Steam gives no score to (under 10 reviews)
  are labeled with Steam's text ("3 user reviews", "No user reviews") and are
  never filtered, so new and small releases aren't penalized.

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
