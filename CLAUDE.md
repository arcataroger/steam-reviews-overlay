# Steam Reviews Overlay

## Check layout after every change

Steam's layouts shift with the window width and the font size. A change that looks right once can overlap at another size. After any change to labels, frames, dimming, card detection or CSS:

1. Run `npm run build:firefox`.
2. Run `npm run check:overlaps`. It loads live pages at four widths and both font settings. It fails on a label over text, a label off its card, a price pushed out of its card, or a table split into different column layouts.
3. Fix every fault it reports. Never call a change done while it fails.
4. Look at screenshots of the pages you changed. Measurements pass things a reader would reject.
5. When you find a new kind of fault by eye, add it to `scripts/check-overlaps.mjs` so it stays caught.
6. If a browser already holds the test profile, set `SRO_PROFILE_DIR` to a temporary folder. That run is logged out, so say that personalised rows went unchecked.

When you notice a layout risk, test it before you report it. Never only mention it.

## Label rules

1. Use words wherever they reasonably fit. Thumbs are the last resort.
2. Keep one treatment per section. Never mix words and thumbs in a list.
3. Show labels in one consistent place across a list, lined up and vertically centred.
4. Never cover text, prices, dates or Steam's controls.

## Traps

1. Never put anything straight into a `<tr>`. Firefox gives it an anonymous cell, which shifts the row's columns.
2. Keep frames inside the card, above Steam's art. Steam stacks art as high as z-index 10, and neighbours paint over anything outside the box.
3. Firefox remembers each site's zoom in the test profile. Pass `'browser.zoom.siteSpecific': false` in `prefs` for captures.
4. Never sleep and hope. Call `waitForOverlay` from `scripts/lib/browsers.mjs`. It polls the `data-sro-ready` marker, then waits for labels to settle. An inactive page passes every check, so treat its `null` as a failure.
5. The first launch on a kept profile can install the add-on and never activate it, however many times you reload. Launches after it work, and fresh profiles have not shown this. When `waitForOverlay` returns `null` on every load, relaunch the browser.
6. Keep the user's preview window open unless they say otherwise. Use a temporary profile for your own tests.

The `steam-visual-check` skill covers the pixel-level border gate. Use it as well after changing frames.
