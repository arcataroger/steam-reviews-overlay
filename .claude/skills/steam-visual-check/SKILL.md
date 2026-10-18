---
name: steam-visual-check
description: Deterministically verify the overlay's highlight borders on live Steam pages by cutting every game card out of page screenshots and checking its edges pixel by pixel. Use after changing highlight CSS or card detection, when Steam changes its markup, or as a release gate.
---

# Border verification from pixels

Three stages. Geometry comes from the DOM (exact rectangles, no shape guessing); the verdict comes
only from pixels, so it is independent evidence that the page renders what we intended rather than a
restatement of our own CSS.

1. **Capture** — `npm run visual:capture -- <outDir> <url...>` (env `SRO_STOPS=12`, `SRO_EXT_DIR`)
   screenshots each page in two settings states (`labels`: everything parked, no highlights;
   `active`: dim at Mixed and below, highlight at Positive and above) and writes
   `<slug>__<state>__<stop>.cards.json` beside each PNG: every card's rect, appid, title, tier,
   treatment, expected colour, whether it is fully visible, and which edges the page paints over.
   Card records are read twice, before and after the shot, and only records identical in both are
   kept — a card a rotating carousel moved mid-screenshot is dropped rather than mislabelled.
2. **Segment** — `npm run visual:segment -- <captureDir> [--out <dir>] [--pad 12]` crops every fully
   visible card with padding into `<captureDir>/cards`, named
   `<slug>__<state>__<stop>__app<id>__<title>__<tier>__<treatment>__<colour>.png`, plus a
   `manifest.json` the checker reads.
3. **Check** — `npm run visual:borders -- <cropDir> [--json out.json] [--only substring]` decodes
   each crop and asserts the highlight is on the right edges in the right colour. Exit code 1 on any
   failure.

## What the checker knows

- **Treatments** (`src/content.css`): `row` = 2px inset ring on all four edges; `panel` +
  `axis: y` = wings on left and right only, `axis: x` = top and bottom only; `card` = a 2px ring
  plus soft glow just *outside* the box, so its band straddles the edge.
- **Alpha**: rings are drawn at 85% opacity, so the same ring measures differently over dark artwork
  than over the page. Matching is by chromaticity plus a brightness floor, not raw RGB distance.
- **Steam's own blue is our positive colour.** So "this card must NOT be highlighted" is judged by
  differencing the active crop against its labels-state twin (same page, stop, appid and rect).
  Cards with no twin report those edges as *unjudged* rather than guessing; the summary line counts
  them.
- **Occlusion**: edges covered by Steam's sticky category bar or a hover panel are recorded at
  capture time and skipped. Five points are probed along each edge, not just its midpoint, because
  a hover panel can cover one end of a card and leave the centre clear.
- **Gain, per line**: a tone counts only by how much more of it the active crop holds than the same
  *line* of the twin. Comparing the band's best line in one against the band's best line in the
  other compared two different rows, and a ring drawn two rows out scored zero against Steam's own
  panel fill three rows in.
- **Neighbours**: a highlighted card butted against an edge bleeds its ring into our crop, so that
  edge is unjudged — but only when the neighbour's treatment actually paints the side facing us. Two
  stacked `panel`/`axis: y` cards paint nothing along the edge they share.

## Reading the result

`checked N cards, F failures (P paired with an un-highlighted twin, U edges unjudged for want of one)`

A failure prints `FAIL <file>: edge <name> expected <colour> got <fraction>`. Open that crop: the
file name says what it should have been. Rising `U` means captures are drifting (more rotating
content); raise `SRO_STOPS` or capture calmer pages if it matters.

## Trusting the checker itself

`tests/unit/border-check.test.ts`, `tests/unit/segment-cards.test.ts` and `tests/unit/falsify.test.ts`
cover the pure logic on synthetic images. To re-prove the gate end to end on real pixels, run
`npm run visual:selftest -- <cropDir>`: it rewrites the manifest into five deliberate lies (wrong
tone, a ring invented on a parked card, a panel's wings flipped to the other axis, a panel claimed
as an all-four-edges ring, and a real highlight claimed absent), re-runs the gate over the *same*
pixels, and requires each lie to be caught on at least 90% of the cards it was told about. Exit 1
otherwise. A truthful manifest reporting zero failures only means something when this passes.

Run it after any change to the matcher, the band geometry or the treatments. It found two real
blind spots on its first run: edges expected to be clean were only swept in the card's own geometry,
so a parked card that wrongly gained the outside glow went unseen (38% caught), and the tone loop
could throw away its only measurement and report a ring that was plainly there as missing.

## Reading the result

`checked N cards, F failures (P paired with an un-highlighted twin, U edges unjudged for want of
one; B labels-state crops read as baselines)`

The labels-state crops exist only to be the baseline for their active twin, so they are counted
separately and not as checked cards. A failure prints `FAIL <file>: edge <name> expected <colour>
got <fraction>`. Open that crop: the file name says what it should have been. An edge goes unjudged
when it has no baseline twin, when the page paints over it, when a highlighted neighbour is butted
against it, or when it is shorter than the corner skip at both ends. Rising `U` means captures are
drifting (more rotating content); raise `SRO_STOPS` or capture calmer pages if it matters.

## Checking that a label never changes a card's size

`npm run visual:sizes -- <url...>` loads each page twice in one run, once with the extension and once
without, and compares every box Steam draws. Boxes are keyed by the product they link to plus the
kind of element holding it, because a store page can feature the same game as a big header capsule on
one load and a small tile on the next; comparing those two would report a size change nobody made.
Hashed CSS-module class names are dropped from the key since they change whenever Steam rebuilds.
Exit 1 if any box differs by more than a pixel.

`SRO_SIZE_SELFTEST=1` is its positive control: after the badges are placed it forces each one to a
block of its own, which genuinely does grow its card, and the check must then report it.

This replaced a check inside the harness that compared sibling capsules to each other. That could
never tell our effect from Steam's own layout — its hero carousel has uneven slides by design — so it
flagged the same pages every round and never found anything.

## Trusting the mechanical checks

`npm run visual:harness-selftest` loads a live page and runs four controls over the checks in
`scripts/visual-pass.mjs`: both must be silent on an untouched page, a badge dragged onto a title's
glyphs must raise `badge-overlaps-text`, and a plain single-line badge beside a genuine Steam summary
must raise `plain-badge-beside-native`. Exit 1 on any failure. Run it after touching those checks.

Both checks spent several rounds crying wolf, and every flag had to be verified by hand:

- `badge-overlaps-text` measured each text element's whole box. A block element is routinely far
  wider than the words in it, so boxes touched where nothing visibly overlapped. It now measures the
  glyph rectangles from each text node's range, the same thing the extension's placement logic
  measures, and ignores text painted in a fully transparent colour. On a category page, all ten
  flags proved false before the change and none remained after.
- `plain-badge-beside-native` read the card's own review column to decide whether Steam was already
  showing a summary. On search rows our badge sits *inside* that column, so the check was reading our
  own label back and flagging every row: 26 of 26 on a search page, none genuine. It now strips our
  badges before reading that text.

The checks stay independent evidence: they measure the rendered page rather than reading our CSS.
The fix was to measure the right thing, not to trust the extension.

## Accepted behaviour, do not report as defects

Each of these was investigated from the pixels and the DOM and found correct. They recur every
round, so check them against this list before writing them up.

- **A badge over lettering baked into a tile's artwork.** The "Recent & Upcoming Events" tiles often
  use key art whose own logo text fills the frame. The badge has to sit on the art somewhere and
  nothing in the DOM says where the painted lettering is. Only DOM text counts as an obstacle.
- **A badge lifted above a tile's date line instead of sitting in the bottom-right corner.** The
  corner is tried first and given up only when the date's text rect leaves less than the badge's
  width plus a 4px gap. Measured on the VR page's VTOL VR tile: a 303px tile, a 147px date starting
  28px in, and a 125px badge, so the badge misses fitting beside the date by one pixel and is lifted
  into the clear gap above it. Neighbouring tiles with shorter dates keep the corner, which makes
  the row look inconsistent; the alternative is a badge that touches the date.
- **A badge on a dimmed card.** The label sits above the dim overlay on purpose (`src/content.css`,
  `[data-sro-filtered="dim"] .sro-badge`): it is the reason the card is dimmed, so it must stay
  readable. A badge darkened to 0.25x with the rest of the card is a regression, usually a stacking
  context in Steam's markup that traps an inline label below the overlay.
- **A bundle row with no label whose neighbours all have one.** A bundle page lists packages
  alongside games. A package row carries several appids in `data-ds-appid` and a `Sub_N` item key,
  and has no single review score to show: on `/bundle/232/` the Counter-Strike: Condition Zero and
  Half-Life 1: Source rows are packages (`Sub_7`, `Sub_38`, appids `10,80` and `280,360`) while the
  other fourteen rows are single apps. Guessing one of the two appids would put another game's score
  on the row.
- **A highlighted card whose badge's second line reads Mostly Positive.** The two-line badge is
  🇺🇸 your-language over 🌐 all-languages, shown only when the two differ. The harness's `active`
  state judges by the your-language score (`source: 'local'`), so the treatment follows the FIRST
  line. Read both lines before concluding a card is wrongly highlighted.

