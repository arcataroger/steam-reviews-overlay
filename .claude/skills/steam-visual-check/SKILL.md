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
  capture time and skipped.

## Reading the result

`checked N cards, F failures (P paired with an un-highlighted twin, U edges unjudged for want of one)`

A failure prints `FAIL <file>: edge <name> expected <colour> got <fraction>`. Open that crop: the
file name says what it should have been. Rising `U` means captures are drifting (more rotating
content); raise `SRO_STOPS` or capture calmer pages if it matters.

## Trusting the checker itself

`tests/unit/border-check.test.ts` and `tests/unit/segment-cards.test.ts` cover the pure logic on
synthetic images (141 tests). To re-prove it end to end, take a real crop dir and rewrite its
manifest into deliberate lies — claim every card has a `row` ring, claim none is highlighted, claim
the wrong tone colour — and confirm each control produces failures where the truth produces none.
