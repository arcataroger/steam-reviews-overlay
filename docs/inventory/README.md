# Steam card inventory: how the overlay maps onto Steam's game displays

`master.md` is the machine-built source of truth: every kind of game display found on every page
reachable from the store's top menu (99 pages, ~2,900 cards on the last crawl), with the exact
markup signature, sizes, features, and what the extension did to each. This file is the curated
reading of it: which of our treatments each kind gets, and the gaps we know about and accept.
Regenerate both with the `steam-inventory` skill (`.claude/skills/steam-inventory/SKILL.md`).

## Our treatments

| Treatment | What it is | Decided by |
|---|---|---|
| **slot** label | Label inside Steam's own review column of a search row | `.search_result_row` → `.search_reviewscore` |
| **inline** label | Label right after the price line, in flow | a price element exists and the label fits without resizing the card or covering text |
| **inline beside native** | Two-line 🇺🇸/🌐 pair next to Steam's own summary text, only when the labels differ | card has a native summary |
| **beside title** | Label after the title text (dense table rows) | every corner candidate collides |
| **corner** chip | Absolute chip in the lower-right, lifted above the price, shifted or moved to the top-right on collision | fallback; removed if nothing fits |
| **row** highlight | Crisp inset ring | listing rows, tab rows, anything art < 50% and not a hero |
| **card** highlight | Tight underglow | art ≥ 50%, heroes ≥ 1100px, overlapping carousel slides |
| **panel** highlight | Side wings (`y`) or top/bottom wings (`x`) | tall stacked cards, edge-to-edge carousel tiles |
| **dim / hide** | Dark overlay, or fade then `display:none` | filter lever; a card holding keyboard focus is dimmed instead of hidden |

## Coverage by kind (from `master.md`)

Covered (label placed on every reviewed card, highlight shape as designed): search result rows,
home sale/daily-deal/store capsules, home hero broadcast capsules, tab rows, category hero
spotlights, React grid capsule tiles (Popular Titles / Top Demos / Popular Discounted rails), React
expanded capsules with info panel, React demo rows, event/news carousel tiles, news hub post rows,
charts table rows, charts overview tiles, tag browse tiles, specials small capsules, New/Upcoming
Releases capsules, community recommendation cards, home takeover banners, app-page DLC rows.

Notes on kinds that look "partial" in `master.md` but are by design:

| Kind | What the report shows | Why it is fine |
|---|---|---|
| K01 React expanded capsule | most cards `badge=none` | Steam prints its own summary there; we add a label only as the 🇺🇸/🌐 pair when the two differ |
| K03 event/news tile | a few tiles `badge=none` | two-line title plus date leave no clear spot; the label is omitted rather than overlapping |
| K09 classless React tile | 2 unclaimed on app pages | they are the page's own game (never labelled) |
| K17 home spotlight | 9/15 unclaimed | those spotlights are sale/event promos with no app link |
| K20 / K35 / K36 Labs capsules | claimed, no label | Steam Labs experiments; GetItems reports them as non-game types, so no label by design |
| K23 home takeunder | no label | hidden fallback anchor with no art, width 1200 |
| K25 cart form | 1 unclaimed | the "add to cart" form is not a card |
| K34 Great on Deck "Ignored" banner | no label | promo panel |
| text-link kinds | unclaimed | prose links (breadcrumbs, BBCode lists, chart rank text rows): under 60px tall with no art |

## Known gaps (accepted for now)

- **Charts overview text rows** (`a.S0OGjWAy4Co-`, the "Top 8" lists on /charts): 540×40 text-only
  rows get no label. Treating text rows as cards would also label prose links elsewhere.
- **Off-screen carousel slides** choose their highlight shape before their lazy image loads; the shape
  is re-derived when the image loads, so it corrects itself as the slide scrolls into view.
- **Sign-in and age-gated pages** (Discovery Queue, Your Personal Calendar, Popular Among Friends,
  Steam Replay, mature app pages) are not crawled; their card kinds are the same React families.

## When Steam changes its site

Run the skill. `inventory-diff` reports: new kinds (name them in `kind-names.json`, then check
`master.md` for their coverage), kinds whose hashed classes changed (our selectors never depend on
hashed classes, so this is informational), and kinds whose coverage regressed (fix in
`src/content.ts`, re-crawl the affected pages, re-run the visual harness on them).
