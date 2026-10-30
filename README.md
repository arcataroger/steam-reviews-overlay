> **Made with AI (Claude) under human supervision.**

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
- Badges show Steam's label only ("Very Positive"), to stay short enough to sit
  beside a price without covering anything. Steam's exact integer percent and
  review count are in the badge's hover tooltip and on `data-sro-pct`; the
  popup's levers show the percent bands.
- Toolbar popup (click the icon) styled as a two-lever throttle. The **left
  lever** picks a tier: games at that tier **or lower** are **dimmed** (black
  overlay, still clickable) or **hidden** (fade out, then collapsed so lists
  reflow); a Dim/Hide switch sits in its readout. The **right lever** picks a
  tier: games at that tier **or higher** are outlined. Both are inclusive, so
  the highlight lever always sits at least one tier above the filter lever and
  pushes it along if you drag past. Each track runs past its end notch into a parking
  gate marked OFF; a parked lever does nothing. "Under Negative" is a real
  stop (it filters Very Negative and Overwhelmingly Negative), as is "above
  Overwhelmingly Positive". Both levers run along
  Steam's full nine-tier ladder (Overwhelmingly Negative, Very Negative,
  Negative, Mostly Negative, Mixed, Mostly Positive, Positive, Very Positive,
  Overwhelmingly Positive), each notch labeled with Steam's rule for it. Levers
  always rest on a tier. The shared notch labels sit between the levers and
  the tick on each side is clickable for that lever; the flag/globe toggle in
  the band below picks whether the levers judge by your language's score or
  the all-languages score. The rails carry a gradient through Steam's three review colors,
  and the readouts sample it at the lever's position. Highlights on the store
  use each game's own review color. Settings sync via `storage.sync` and apply live to open tabs.
- Data is Steam's own, never recomputed:
  1. Summaries already rendered on the page are reused for an instant first
     paint (search rows carry the label, percent and count in a tooltip; the
     homepage embeds `review_summary_filtered` JSON). The page only ever
     carries one language's number, so the batch below still fetches the other
     side for those ids (English store pages only; other locales rely on the
     batch).
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
     response carries `Cache-Control: max-age=N`; the entry expires when that
     runs out (counted from receipt; Steam doesn't expose an Age header
     cross-origin, and the browser's own cache still refetches at the true
     moment). Ids still on the page are re-fetched once they expire, entries
     are shown while revalidating for up to 15 min, then dropped. Persistence
     only exists to survive reloads and back/forward navigation. On errors the
     batch retries with exponential backoff (jittered, capped at 10 min) and
     gives up after eight tries.
- Filtering follows Steam's algorithm: on a tier the comparison is by
  Steam's `review_score` (what Steam's own "sort by reviews" does, so its
  review-count rules apply: 96% with 300 reviews is "Very Positive", not
  "Overwhelmingly", and "Positive" ranks under "Very Positive"). Between tiers
  the comparison uses Steam's integer percent. Games Steam gives no score to (under 10 reviews)
  are labeled with Steam's text ("3 user reviews", "No user reviews") and are
  never filtered, so new and small releases aren't penalized.

- Localized into every language Steam supports (30 locales under `_locales/`),
  including the extension name. "Steam" itself stays "Steam" in every locale,
  as it does on Valve's own store.
  The nine review labels in the popup are pulled from Steam itself per
  language (`node --experimental-strip-types scripts/steam-labels.mjs`), and
  the badges on the store show Steam's own localized label strings from the
  API, so wording always matches what Steam shows.
- Friendly errors: if Steam can't be reached, rate-limits, or answers oddly,
  the popup shows a one-line notice and the overlay keeps showing whatever is
  cached while retrying with backoff. Nothing is ever blanked out, and a
  failure inside the overlay can't break the store page.

## Build

```sh
npm install
npm run build            # dist/chrome, dist/firefox and dist/safari
npm run build:chrome
npm run build:firefox
npm run build:safari     # Chrome-shaped MV3 manifest with Safari-unsupported keys stripped
npm run safari:xcode     # wraps dist/safari in an Xcode project under build/safari (needs Xcode)
npm run dev              # CRXJS dev server with HMR (Chrome)
npm run dev:firefox      # rebuilds dist/firefox on save; your Firefox reloads the add-on
```

`dev:firefox` opens your installed Firefox on a kept profile (`.firefox-dev-profile/`), so a
Steam login there survives restarts.

## Release

A version tag makes GitHub Actions (`.github/workflows/release.yml`) test, build and publish a
GitHub Release. The release carries the Chrome zip, the unsigned Firefox `.xpi` and the
source zip. Its page explains how to install them (`.github/release-notes.md`) and lists the commits since
the previous tag.

1. Raise `version` in `package.json` and commit.
2. Run `git tag v<version> && git push origin main v<version>`.
3. Upload the Chrome zip to the Chrome Web Store, and the `.xpi` and source zip to AMO.

The workflow fails when the tag doesn't match `package.json`.

## Publish (Firefox, unlisted)

AMO signs the add-on but never lists it. You install the signed `.xpi` from a file. AMO counts
each version once across both channels, so an unlisted build uses up that version number.

1. Raise `version` in `package.json`. AMO accepts each version once.
2. Put `WEB_EXT_API_KEY` (the JWT issuer, `user:…`) and `WEB_EXT_API_SECRET` from AMO's
   Developer Hub → Manage API Keys in `.env` (git-ignored). Exported variables work too.
3. Run `npm run publish:firefox`. It builds, lints, signs, and saves the `.xpi` to
   `web-ext-artifacts/`.

## Load

- **Chrome/Edge/Brave**: `chrome://extensions` → Developer mode → "Load
  unpacked" → pick `dist/chrome`.
- **Firefox**: `about:debugging#/runtime/this-firefox` → "Load Temporary
  Add-on…" → pick `dist/firefox/manifest.json`. Or `npx web-ext run
  --source-dir dist/firefox`.
- **Firefox for Android**: the manifest declares `gecko_android` support.
  Run `npx web-ext run -t firefox-android --adb-device <id>
  --firefox-apk org.mozilla.fenix --source-dir dist/firefox` with a device or
  emulator attached. The popup is laid out for touch (bigger hit zones,
  full-width on narrow screens).
- **Safari (macOS / iOS)**: `npm run build:safari && npm run safari:xcode`,
  then open `build/safari/Steam Reviews Overlay.xcodeproj`, build and run;
  enable the extension in Safari → Settings → Extensions. Add `--ios` to the
  converter command in `package.json` for an iOS target. Safari supports the
  APIs used (MV3 service worker, `storage`, non-blocking `webRequest`).

## Test

```sh
npm test                 # Vitest unit tests: tier ladder, Steam comparison rules,
                         # protobuf encode/decode, page seeding, gradient, i18n
npm run test:e2e         # Playwright: loads dist/chrome into Chromium, visits live
                         # Steam pages, checks badges, request counts, and drives
                         # the popup (dim / hide / outline / park) end to end
npm run lint             # web-ext lint on the Firefox build
npm run audit:home       # every visible game card on the home page carries a label (below)
```

`audit:home` checks the outcome, not Steam's markup, so it catches layouts we have never seen.
It scrolls the page, opens every home tab, pages every carousel, and dims cards at Mostly
Positive and below. It fails on any visible game card without our label, Steam's own summary,
or a by-design exception (packages, bundles). To run it:

1. Run `npm run build`.
2. If this browser has no Steam login yet, run `npm run steam-login -- --browser chromium`,
   log in, then close the window. Personalized home rows only render for a logged-in account.
3. Run `npm run audit:home`. Add `--browser firefox` for Firefox, or pass URLs to audit other pages.

To run it every week:

1. Run `scripts/install-weekly-audit.sh`. A LaunchAgent then runs `scripts/weekly-audit.sh` on
   Mondays at 9:07, or at the next wake if the Mac was asleep.
2. Read results in `~/Library/Logs/steam-reviews-overlay-audit.log`. A failed run also posts a macOS
   notification.
3. To stop it, run `scripts/install-weekly-audit.sh --uninstall`.

Chromium is the primary test browser. Firefox runs as your installed copy over WebDriver BiDi.
Playwright's WebKit cannot load extensions, so it can only check our CSS on bare pages.

Screenshot galleries are on demand only (not part of the test run):

```sh
npm run shots:gallery      # popup states, store modes, mobile → ./shots
node scripts/build-gallery.mjs ./shots ./shots/gallery.html   # assemble the contact sheet
npm run shots:locales      # all 30 languages × every screen, with overlap checks → ./shots/matrix
npm run demo               # open a visible Chromium with the extension loaded
npm run dev                # CRXJS dev server: rebuilds dist/chrome and hot-reloads the demo browser
```

Helper scripts (all take the built `dist/chrome`):

```sh
node scripts/smoke.mjs ./shots <urls...>   # badge counts + screenshots
node scripts/debug-cards.mjs ./shots <url> # dump every claimed card
node scripts/popup-test.mjs ./shots        # popup screenshots through every state
node scripts/netcount.mjs <urls...>        # classify GetItems traffic per page
node scripts/make-icons.mjs                # re-rasterize public/icon.svg → PNGs
```

## Layout

All styling lives in `src/content.css` (`.sro-badge`, `.sro-inline`,
`.sro-corner`, tone classes, and the `[data-sro-filtered="dim|hide"]` rules).
The popup is `src/popup/`; shared settings live in `src/settings.ts`. Card detection and placement heuristics are in
`src/content.ts` (`findCard`, `findPriceEl`, `placeBadge`).

## Building from source

See [BUILD.md](BUILD.md).

## Privacy

The extension collects no personal data. See [PRIVACY.md](PRIVACY.md).

## License

Public domain, via [The Unlicense](LICENSE).
