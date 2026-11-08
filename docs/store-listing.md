# Store listing copy

Paste these into the Chrome Web Store and addons.mozilla.org (AMO) forms.

## Name

Steam Reviews Overlay

## Summary

Chrome takes the short description from the manifest (`extDescription`, max 132 characters).
AMO asks for a summary of up to 250 characters; use the same text:

> See Steam review scores ("Very Positive", "Mixed"…) on every store game without hovering. Dim, hide or outline games by score.

## Description

See every game's review score on the Steam store at a glance, without hovering.

Steam hides its review summary behind a hover tooltip. Steam Reviews Overlay puts that summary right on each game card: "Overwhelmingly Positive", "Mixed", "Mostly Negative" and the rest. It appears on the front page, search results, tag and category pages, sales and "More like this" carousels. Each label uses Steam's own review colors.

**Filter out the noise**
Drag the left lever to a tier. Games at that tier or below get dimmed or hidden, and lists close the gaps.

**Spot the gems**
Drag the right lever to a tier. Games at that tier or above get a frame in Steam's blue, or in a color you pick.

**Your language or everyone's**
Steam scores each game twice: once from reviews in your language, once from reviews in every language. Labels show both when they differ. Pick the score the levers judge by on the Settings screen, behind the gear.

**Fair to small games**
Games with fewer than 10 reviews have no Steam score. The overlay labels them but never filters them out.

**Steam's numbers, nothing else**
The overlay reuses data the store page already loaded, or asks Steam's public store API. It never recomputes a score and sends nothing anywhere else.

**Private by design**
No account, no tracking, no analytics. Your settings sync through your browser.

Works in 30 languages, matching every language Steam supports.

## Category

- Chrome: Shopping (or Fun)
- AMO: Shopping (or Games & Entertainment)

## Store icon

- Chrome: `docs/store/icon-chrome-128.png` (96px artwork, 16px transparent padding, per Chrome's guidelines).
- AMO: `docs/store/icon-amo-128.png` (full 128px; AMO also reads the icon from the manifest).

To regenerate them, run `node scripts/make-icons.mjs`.

## Screenshots

1280×800 PNGs in `docs/store/screenshots/`, plain RGB with no alpha (Chrome's requirement; AMO accepts them too). We use three, in this order:

1. `5-popup-ui.png`: the popup up close, with a caption for each control.
2. `6-popup-config.png`: the options screen, with a caption for each section.
3. `4-popup.png`: the popup over a dimmed and outlined search page.

Chrome asks for screenshots twice: "Global screenshots" show in every language; "Localized screenshots" replace them for one language. Upload both as global, and as localized for English if the form requires it.

To retake them from live Steam pages, run `npm run shots:store`.

## Release notes

Paste the current version's notes into AMO's "Release notes" field when you submit it. Firefox shows them on the add-on's Release Notes tab. AMO takes plain text.

### 0.3.1

- Cosmetic consistency fixes for the extension settings screens.

### 0.3.0

- Every highlight is now a complete frame around the card you see. Frames no longer lose a side, and no longer float outside the card.
- Top Sellers and Most Played line up again in Firefox, with every rating in one neat column.
- Lists too small for words now show thumbs: three, two or one up or down, and a tilde for Mixed. Hover over them for the full label.
- Labels on dimmed cards stay readable.
- Labels no longer cover dates or prices.
- Stacked recommendations on the front page now sit apart, and their labels sit on the screenshots.
- New Settings screen: click the gear at the top right of the popup.
- Pick your own frame color, or keep each game's review color.
- Overwhelmingly Positive frames now have a soft glow, and a faster sparkle that follows every edge. Turn them on or off in Settings.
- Choose how dark dimmed cards get.
- New installs start with Mixed and below dimmed, and Very Positive and above highlighted. Your saved settings stay as they are.
- The language choice moved to Settings, with labels that say what it does.
- A cleaner popup, with the screws gone.


- AMO: The Unlicense (public domain; matches `LICENSE`).

## Privacy policy URL

Both stores take this link:

> https://github.com/arcataroger/steam-reviews-overlay/blob/main/PRIVACY.md

## Privacy (Chrome "Privacy practices" tab)

Single purpose:

> Show Steam's review score on each game in the Steam store, and let the user dim, hide or outline games by that score.

Permission justifications:

- **storage:** Saves the user's lever, filter and language settings, and caches Steam's review scores briefly so reloads don't refetch them.
- **webRequest:** Notices when the Steam store finishes its own review-data request, so we can reuse that cached response instead of sending a new one.
- **scripting:** After an install or update, re-adds the overlay to Steam tabs that are already open, so the user doesn't have to reload them.
- **Host permission `store.steampowered.com`:** Shows the review labels and filters on Steam store pages.
- **Host permission `api.steampowered.com`:** Fetches review summaries from Steam's public store API for games the page didn't include.
- **Remote code:** No. All code ships in the package.

Data usage: tick none of the data types. Certify all three statements: we don't sell user data, don't use it for unrelated purposes, and don't use it for creditworthiness.

## AMO source code

Vite bundles and minifies the extension, so AMO asks for the source. Upload `release/steam-reviews-overlay-source-<version>.zip` (made with `git archive`). For the reviewer build steps, see [BUILD.md](../BUILD.md); paste them into AMO's "Notes to Reviewer" field too.
