# Steam card inventory: how the overlay maps onto Steam's game displays

`master.md` is the machine-built source of truth: every kind of game display found on every page
reachable from the store's top menu (102 pages, ~3,000 cards on the last crawl), with the exact
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
| **corner** chip | Absolute chip: the art's lower-right on art-on-top cards, else the card's lower-right lifted above the price, shifted, or moved to the top-right on collision | no price spot fits |
| **fallback** chip | Corner chip (`sro-fallback`) on the art's lower-right, or the card's, even when it covers some text | every other spot collides: every game card carries a label |
| **row** highlight | Crisp inset ring | listing rows, tab rows, anything art < 50% and not a hero |
| **card** highlight | Tight underglow | art ≥ 50%, heroes ≥ 1100px, overlapping carousel slides |
| **panel** highlight | Side wings (`y`) or top/bottom wings (`x`) | tall stacked cards, edge-to-edge carousel tiles |
| **dim / hide** | Dark overlay, or fade then `display:none` | filter lever; a card holding keyboard focus is dimmed instead of hidden |

## Coverage by kind (from `master.md`)

Covered (label placed on every reviewed card, highlight shape as designed): search result rows,
home sale/daily-deal/store capsules, home hero broadcast capsules, tab rows, category hero
spotlights, React grid capsule tiles (Popular Titles / Top Demos / Popular Discounted rails), React
expanded capsules with info panel, React demo rows, event/news carousel tiles, news hub post rows,
charts table rows, charts overview tiles and rank rows, tag browse tiles, specials small capsules, New/Upcoming
Releases capsules, community recommendation cards, home takeover banners, app-page DLC rows.

Kinds where some items carry no label on purpose are recorded in `kind-expectations.json`, so each
crawl marks them **by-design** instead of re-reporting them as gaps. Each entry gives the reason and
a budget: how many items were deliberately skipped when the kind was last reviewed. Going over that
budget flags the kind again, so a real regression cannot hide behind a known exception.

| Kind | What the report shows | Why it is fine |
|---|---|---|
| K01 React expanded capsule | most cards `badge=none` | Steam prints its own summary there; we add a label only as the 🇺🇸/🌐 pair when the two differ |
| K07 news post row with large art | app-page tiles unclaimed | an app page's own Recent Events tiles link to the game whose page you are already on |
| K09 classless React tile | unclaimed on app pages | the 780×380 tile left unclaimed on each app page carries that page's own appid |
| K16 home spotlight | 9/15 unclaimed | franchise and publisher sale spotlights carry a representative game's `data-ds-appid` for Steam's hover panel but link to a `/sale/` page: the tile is the sale, not the game |
| K04 sale capsule, K17 daily deal | a few unclaimed | package capsules share those shelves with game capsules, and a package has its own page and its own score |
| K22 / K36 / K37 Labs fragments | claimed, no label | Steam Labs experiments and banners, not games |
| K27 home takeunder, K35 Great on Deck banner | no label | a hidden fallback anchor and a banner panel, neither of them a game |
| K31 plain text link | 1 of 2 unclaimed | prose on a package page, not a card |

## Open coverage items

These are still unexplained and deliberately left flagged rather than excused:

- **Logged-in demo recommendation block** — `npm run audit:home` once found a home recommendation
  block for a demo (Bladesong Demo) with no label. Its `data-ds-appid` names the demo, so the block
  likely counts as two games. It rotated out before we could inspect it. When the audit reports it
  again, dump the block's `data-ds-appid` and `/app/` links.

- **K03 event/news carousel tile** — on one crawl of the news hub, 3 of 333 tiles had the overlay's
  card on the carousel *container* (`div.EventTileCarouselCtn`) rather than on the tile, with no
  badge. That would put a highlight around a whole carousel. It did not reproduce on a later live
  check of the same page, so the shape that triggers it is transient (most likely a carousel showing
  a single slide). A visual round since then swept every stop of the news hub's event and article
  carousels looking for a ring spanning more than one product and found none. Check this kind's
  `other:` count on every crawl until it is understood.

A related defect of the same shape WAS found and fixed on Steam's main content-hub carousel: the
rotating viewport held only the current slide, so it looked like one game's card and took a ring
around the whole widget. The card is now the slide's own art, with an inset ring rather than the
outside glow the widget was shaving off. See `src/content.ts`'s `ROTATING_CAROUSEL`.
