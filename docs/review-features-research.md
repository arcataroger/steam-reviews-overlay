# Review-Focused Feature Research: Steam Reviews Overlay

Date: 2026-09-10. Scope: reviews and ratings only (no prices, wishlist tooling, or tag filters unless tied to reviews).

## 0. Summary of what the extension has today

- Steam review summary label (`review_score_desc`) on every game card/row across the store, colored in Steam's own review colors, no hover needed.
- Popup slider to dim or hide games below a chosen review tier.
- Data per game from `store.steampowered.com/appreviews/{appid}?json=1`: `review_score` (0-9), `review_score_desc`, `total_reviews`, `total_positive`, `total_negative`.

## 1. How other listings present ratings (conventions worth copying)

| Site | List-view convention | Takeaway for the extension |
|---|---|---|
| Amazon | Stars + count on every card; on the product page a 5-bar "% of ratings" histogram; "Verified Purchase" badge; ratings weighted by recency and verified status via ML, not a raw mean. Unverified ratings without text do not count. ([aboutamazon.com](https://www.aboutamazon.com/news/retail/amazon-customer-reviews-star-ratings), [Amazon help](https://www.amazon.com/gp/help/customer/display.html?nodeId=G8UYX7LALQC8V9KA)) | Score + count together is the baseline. A "verified" split maps to Steam's `purchase_type=steam`. |
| Google Play | Rating + count on cards. Total ratings only shown once an app has 5+ ratings. Displayed rating weights recent versions, not lifetime average. ([Play Console help](https://support.google.com/googleplay/android-developer/answer/138230?hl=en)) | Minimum-count threshold before showing a score; recency-weighted score. |
| Apple App Store | Rating + count on cards; histogram and "current version" vs "all versions" on product page. | Same recent-vs-all idea as Steam's Recent/All. |
| IMDb | Top 250 uses a Bayesian weighted rating `WR = v/(v+m)*R + m/(v+m)*C` with a minimum vote count `m` (25,000 for the film list). ([IMDb help](https://www.imdb.com/help/show_leaf?votestopfaq=)) | Prior art for a confidence-adjusted score option. |
| Letterboxd | Rating histogram is the primary visual; ratings skew high (4-star mode). ([Datawrapper](https://www.datawrapper.de/blog/movie-reviews-rating-scales)) | Distribution beats a single number when the scale is skewed, which Steam's is (median 84% positive). |
| Rotten Tomatoes | Critic vs audience split; "Verified" audience score only from ticket buyers; "Verified Hot" badge at 90%+. ([RT editorial](https://editorial.rottentomatoes.com/article/audience-score-update/)) | Two-population display (all vs Steam-purchasers, or all vs your language) is a known pattern users understand. |
| Airbnb / Yelp / TripAdvisor | Rating + count on every card; "New" badge instead of a score for listings with few reviews; Guest Favorite badge needs 5+ reviews; Yelp only counts "recommended" reviews. ([Hostfully](https://www.hostfully.com/blog/airbnb-review-policy/), [Yelp support](https://www.yelp-support.com/article/Do-reviews-that-arent-currently-recommended-impact-the-businesss-star-rating?l=en_US)) | "New / too few reviews" state should be a first-class visual, not blank. |
| Epic Games Store | No user reviews. Random polls of players with 2h+ playtime produce a 5-star aggregate and tags. Criticized as opaque, no "why", forced prompts, guilt-biased toward 5 stars. ([PC Gamer](https://www.pcgamer.com/epic-games-store-introduces-rating-system-designed-to-stop-review-bombing/), [ResetEra](https://www.resetera.com/threads/the-epic-games-store-%E2%80%9Cratings-and-polls%E2%80%9D-update.597198/)) | Users want the count and the reasons, not just a number. |
| PlayStation Store | 5-star ratings from owners only (since 2023); written reviews rolling out 2025. Still review-bombed (the PS app on Play dropped to 3.4). ([Push Square](https://www.pushsquare.com/news/2023/09/ps-store-adds-a-new-five-star-rating-system-to-score-your-ps5-ps4-games), [GameRiv](https://gameriv.com/playstation-app-reportedly-review-bombed-over-sony-killing-physical-games/)) | Ownership gating does not stop bombing; trend detection still matters. |
| Xbox / Microsoft Store | Star rating + count; "Best-rated" lists require 500+ ratings. ([Microsoft Store](https://www.microsoft.com/en-us/store/best-rated/games/xbox)) | Same 500 threshold Steam uses for "Overwhelmingly". |
| Nintendo eShop | No user reviews at all; briefly added and pulled in 2018. ([Kotaku](https://kotaku.com/nintendo-adds-user-reviews-immediately-pulls-them-1823391672), [Screen Rant](https://screenrant.com/nintendo-eshop-user-review-players-upset/)) | n/a |
| GOG | Stars + (formerly) count on cards; users complain the count disappeared. ([GOG forum](https://www.gog.com/forum/general_archive/where_is_the_number_of_ratings_shown)) | Count next to score is expected. |
| itch.io | Star rating + count only in a "More information" box; users ask for ratings on browse lists. ([itch.io thread](https://itch.io/t/1157108/a-way-to-show-ratings-on-a-games-page)) | Confirms the extension's core premise. |

Cross-site conventions to adopt:

1. Show count next to score, always.
2. Do not show a score below a minimum count; show a "new / few reviews" state instead.
3. Provide a distribution (histogram) on demand.
4. Distinguish recent from all-time.
5. Distinguish "verified" (Steam purchase) from all.
6. Rankings use a confidence-adjusted score (Bayesian or Wilson), never a raw percent.

## 2. Steam specifics

### 2.1 What Steam shows vs. hides

- Search rows: a small thumbs icon (`span.search_review_summary.positive|mixed|negative`) whose tooltip reads `Very Positive<br>94% of the 435,088 user reviews for this game are positive.<br><br>The review score for this product is calculated from reviews written in your language based on your preferences.` (probed 2026-09-10). Nothing visible without hover.
- Front page capsules, carousels, sale pages, category pages: nothing.
- Wishlist: shows a review label and can sort by review score, but users report the sort order is unexplained ([complaint thread](https://steamcommunity.com/discussions/forum/0/1747891643726223176/)).
- App page: Recent (30-day) + All summaries, percent + count, histogram with off-topic periods shaded, language filter, "Steam purchasers only" checkbox, off-topic review activity exclusion toggle.
- Label thresholds ([Steam Page Analyzer](https://www.steampageanalyzer.com/blog/steam-review-score-thresholds)): no label below 10 reviews; Positive = 80%+ at 10-49; Very Positive = 80%+ at 50-499 or 80-94% at 500+; Overwhelmingly Positive = 95%+ at 500+; Mostly Positive 70-79%; Mixed 40-69%; Mostly Negative 20-39%; Negative/Very Negative/Overwhelmingly Negative = 0-19% at the same count tiers. Recent label needs the game to be 45+ days old with enough 30-day reviews.
- Language-specific scores (August 2025): for games with 2,000+ reviews and 200+ in a language, Steam now defaults to a score computed only from the viewer's language; users can switch back in store preferences. Example: Hollow Knight: Silksong "Overwhelmingly Positive" in English but "Mixed"/"Mostly Negative" in Simplified Chinese. ([Alpha Games](https://games.alphacrc.com/investigating-steams-new-language-specific-review-scores/), [heise](https://www.heise.de/en/news/Steam-differentiates-between-user-reviews-by-language-10544783.html), [Kotaku](https://kotaku.com/steam-reviews-wuchang-fallen-feather-china-language-filter-2000618249))
- Key activations: since Sept 2016 the headline score excludes reviews by users who activated via key; Valve found 160+ titles with inflated key-activated scores. ([Steam news](https://store.steampowered.com/oldnews/24155), [GameSpot](https://www.gamespot.com/articles/steam-updates-reviews-system-will-ban-developers-w/1100-6443509/))
- Off-topic review bombs (2019): Valve flags anomalous periods, shades them on the histogram, and excludes them from the score; a user preference can re-include them. ([Variety](https://variety.com/2019/gaming/news/steam-off-topic-review-bombing-1203164639/), [Game Developer](https://www.gamedeveloper.com/business/steam-user-reviews-will-no-longer-count-off-topic-review-bombs-))

Important consequence for the extension: the label Steam itself shows in search is now language-filtered by default, while the extension's `language=all` query returns the global label. For games like Silksong the two disagree. The extension should either query with the user's language (`language=<steam lang>`) for games over the 2,000/200 threshold, or show both.

### 2.2 What the public endpoints actually return (probed 2026-09-10)

`GET https://store.steampowered.com/appreviews/{appid}?json=1&num_per_page=0&language=all&purchase_type=all`

- `query_summary`: `num_reviews, review_score, review_score_desc, total_positive, total_negative, total_reviews`.
- `language=english|schinese|...` and `purchase_type=steam|non_steam_purchase|all` DO change the summary. Elden Ring: all = 1,154,086 reviews / 93.0%; Steam purchases only = 830,519 / 93.2%; English = 571,513 / 93.9%; Simplified Chinese = 250,119 / 90.7%.
- `filter=recent&day_range=30` and `filter=all&day_range=30` do NOT change the summary (still all-time totals). The summary ignores the date window. So a 30-day score cannot come from this endpoint.
- `review_type=negative` (or positive) returns only `num_reviews` in the summary, but the review objects carry `voted_up, votes_up, weighted_vote_score, steam_purchase, received_for_free, refunded, written_during_early_access, primarily_steam_deck, author.playtime_forever, author.playtime_at_review, language, review`.
- `filter_offtopic_activity=0` is accepted; for Helldivers 2 it did not change totals (no active off-topic period).

`GET https://store.steampowered.com/appreviewhistogram/{appid}?l=english`

- `results.start_date, end_date, rollup_type ("month"|"week"), rollups[] {date, recommendations_up, recommendations_down}, recent[] {date, recommendations_up, recommendations_down}` where `recent` is 30 daily buckets.
- This is the only public JSON source for the Recent (30-day) score, the 30-day review count, velocity, and a histogram. Off-topic periods are NOT included in this JSON (only drawn on the app page). ([Steam-Review-Graph](https://github.com/fboulegue/Steam-Review-Graph), [SteamApis docs](https://docs.steamapis.com/apps/reviews))

`appdetails` (`/api/appdetails?appids=`) has `recommendations.total` and `metacritic.score` but no percent; not useful for reviews beyond Metacritic.

### 2.3 Adjusted-score formulas in the wild

- SteamDB rating (public domain, [blog](https://steamdb.info/blog/steamdb-rating/), [issue #793](https://github.com/SteamDatabase/steamdb.info-issues/issues/793)):
  `rating = p - (p - 0.5) * 2^(-log10(n + 1))` where `p = positive/total`, `n = total`; multiply by 100. Example: 90% with 100 reviews -> 80.0. Shrinks toward 50% with a log decay. Criticized on the SteamDB tracker for lacking statistical basis, and by an independent analysis for a "significant negative bias even after 1000 ratings"; that analysis found empirical Bayes (shrink toward the ~85% global mean) most accurate and recommended simply hiding low-count games from top lists instead. ([Kirkegaard](https://www.emilkirkegaard.com/p/penalization-for-small-n-problems))
- Steam 250: Wilson score lower bound with a tuned weighting; 22 algorithm/weight combos trialled; daily scrape of positive/negative totals. Hidden Gems list = near-100% approval with a penalty for review count, so games "sink off the list" as they get popular (top entries have 300-1,200 reviews at 100%). ([about](https://steam250.com/about), [hidden gems](https://steam250.com/hidden_gems))
- Lars Doucet, "Fixing Steam's User Rating Charts": Steam's "sort by user reviews" sorts by label bucket then count, so a 99%/32k game ranks below a 95%/38k game and "Mostly Positive" titles start on page 141; proposes Evan Miller's Wilson lower bound and an "under judgment" filter for new releases. ([Fortress of Doors](https://www.fortressofdoors.com/fixing-steams-user-rating-charts/))
- Distribution facts: mean 80%, median 84%, top 20% is 93%+; "Very Positive" spans the median, so the label is weak evidence on its own. ([M Baas](https://rf5.github.io/2020/12/13/steam-reviews.html)) Early reviews run about 4 points more positive than the eventual score; all shrinkage methods converge past ~1,000 reviews (Kirkegaard).

### 2.4 What power users ask for

- Minimum review-count filter in search ("a slider: 1000, 3000, 8000") and an "Insufficient reviews" filter category; thread open for 7 years then locked unresolved. ([1](https://steamcommunity.com/discussions/forum/10/1746720717342913492/), [2](https://steamcommunity.com/discussions/forum/10/1697175413670318567/))
- Complaints that "Very Positive" on the capsule becomes "Mostly Positive" in the detail, and that Positive vs Mostly Positive have overlapping meanings; common suggestion: "just show the percentage". ([Stalker 2 thread](https://steamcommunity.com/app/1643320/discussions/0/4626980894528274996/), [which is better](https://steamcommunity.com/discussions/forum/0/592911760736002271/))
- Bundles displaying an 87% "Very Positive" while containing a 43% game. ([thread](https://steamcommunity.com/discussions/forum/0/3839927819746609411/))
- Confusion when language-filtered scores rolled out ("Steam changes review score silently"). ([thread](https://steamcommunity.com/discussions/forum/0/524225948489557625))
- Why mixed/negative games are featured on the front page at all. ([thread](https://steamcommunity.com/discussions/forum/0/458604254436696793))
- Recent vs All divergence is how players detect patches that fixed a game or a bombing in progress. ([Game Rant](https://gamerant.com/steam-review-ratings-explained-mostly-negative-overwhelmingly-positive/))
- Augmented Steam already offers: search filter by review score threshold and review count range, hide Early Access, review sort options, OpenCritic on app pages. It does not overlay labels on capsules. ([Firefox add-on](https://addons.mozilla.org/en-US/firefox/addon/augmented-steam/), [PC Gamer](https://www.pcgamer.com/i-cant-use-steam-without-this-browser-extension-anymore/), [changelog](https://github.com/IsThereAnyDeal/AugmentedSteam/blob/develop/changelog.yml))
- Steam filters (lorenzostanco) tool: show only games with 5/10/20/50/100/500 reviews, overall or last 30 days. ([changelog](https://www.lorenzostanco.com/lab/steam/changelog))
- Steam Labs: Deep Dive's "similar gems" (little-known but well-loved) was shelved; Community Recommendations (helpful reviews on the home page) shipped. ([Game Developer](https://www.gamedeveloper.com/business/what-did-and-didn-t-work-for-the-first-year-of-valve-s-steam-labs-experiments), [PC Gamer](https://www.pcgamer.com/steam-gets-a-new-deep-dive-discovery-tool-and-community-recommendations/))
- Review velocity 5-10x normal is the standard bombing signal used by dev-facing tools. ([Steam Page Analyzer](https://www.steampageanalyzer.com/blog/steam-review-bombing-guide), [VaporLens](https://vaporlens.app/changelog/review-stats))

## 3. Prioritized feature backlog (reviews only)

Effort: S = under a day, M = a few days, L = a week or more. "Requests" = extra network calls per game beyond the one `appreviews` call already made.

### P0 - ship next

**1. Percent + count next to the label ("Very Positive 93% · 1.2M")**
- Problem: labels are ambiguous (Mixed = 40-69%; Positive vs Very Positive differ only by count) and count is the strongest credibility signal on every other storefront.
- Feature: render `round(total_positive/total_reviews*100)%` and an abbreviated count after the label; option to show percent only, label only, or both. Compact mode for small capsules (e.g. "93% · 1.2M").
- Data: already fetched. Effort: S. Risk: clutter on small capsules; needs a density setting.

**2. "Show percent instead of label" mode and label-band tooltip**
- Problem: users repeatedly ask Steam to "just show the percentage".
- Feature: replace the label with "Mixed 58%" style text; tooltip explains the band ("Mixed = 40-69% positive; 10+ reviews").
- Data: already fetched. Effort: S. Risk: none.

**3. Low-count confidence state ("Few reviews (23)" / "Too new")**
- Problem: 80% at 12 reviews and 80% at 12,000 look identical; Airbnb/Google Play hide the score below a floor; early scores run ~4 points high.
- Feature: below a user-set floor (default 50, matching Steam's Very Positive gate) show a muted "n reviews" chip instead of a colored label, or a hollow/outlined badge. Slider option to hide games with fewer than N reviews (the 7-year-old Steam request).
- Data: already fetched. Effort: S. Risk: none.

**4. Match Steam's language-filtered score (and show "global vs your language" when they diverge)**
- Problem: since Aug 2025 Steam's own label is computed from the viewer's language for big games; the extension's `language=all` label can contradict the icon next to it.
- Feature: read the store language cookie, request `language=<lang>` when `total_reviews >= 2000` (and per-language count >= 200), fall back to all. If the language and global labels differ by a band, show both ("EN 92% / All 84%").
- Data: `appreviews?language=<lang>` (works, verified). Effort: M. Risk: one extra request per game only for large games where the summary is needed twice; cacheable.

### P1 - high value, needs the histogram endpoint

**5. Recent-vs-All trend indicator**
- Problem: the app page's Recent/All contrast is the single most useful review signal (patches fixed it vs bombing in progress) and is absent from every list view.
- Feature: compute 30-day percent and count from `appreviewhistogram.results.recent`; show an arrow or a second chip when the recent band differs from all-time ("Very Positive ↓ Mixed recently (1,240)"). Popup option to filter by recent score instead of all-time.
- Data: `appreviewhistogram/{appid}` (public, unauthenticated, no off-topic exclusion). Effort: M. Risk: one extra request per game; fetch lazily (on hover or viewport) and cache for hours. Note the appreviews `day_range` param does not affect the summary, so the histogram endpoint is the only route.

**6. Inline mini histogram on hover**
- Problem: a single number hides bombing cliffs, launch-fix recoveries, and slow decline.
- Feature: hover card with a small up/down bar chart from `rollups` (monthly) plus the 30-day daily series; annotate the biggest spike.
- Data: same call as #5. Effort: M. Risk: none beyond #5.

**7. Review-bomb / anomaly flag**
- Problem: users cannot tell from a list that a negative wave is happening now.
- Feature: heuristic on `recent`: if the last 7-day rate is 5x the 30-day baseline and the 7-day positive share is more than 20 points below all-time, tag "Review surge". Show as a small warning glyph; never call it "bombing" (off-topic determination is Valve's).
- Data: same call as #5. Off-topic periods are not in the public JSON; the only source is the app page graph. Effort: M. Risk: false positives on launches and sales; suppress within 45 days of release.

**8. Adjusted score option (Wilson lower bound or SteamDB formula) and re-sort search results by it**
- Problem: Steam's "sort by user reviews" is bucket-then-count; 100% with 3 reviews outranks 97% with 30k.
- Feature: popup selector: Raw %, Wilson 95% lower bound, SteamDB (`p - (p - 0.5) * 2^(-log10(n+1))`), or empirical Bayes toward 0.85 (e.g. `(pos + 0.85k)/(n + k)`, k=30). Show the adjusted number as the sort key and optionally as the displayed score. Client-side re-sort of the current search page (and infinite-scroll batches).
- Data: already fetched. Effort: M (re-sorting Steam's DOM safely is the work). Risk: users may confuse adjusted with raw; label it clearly; re-sort only applies within a loaded page.

### P2 - differentiation

**9. Hidden-gem highlight**
- Problem: Steam Labs' "similar gems" was shelved; Steam 250's Hidden Gems is a separate site.
- Feature: badge games with percent >= 95, 50 <= count < ~2,000 (both tunable), optional "gems only" view of any list.
- Data: already fetched. Effort: S. Risk: clutter; make it opt-in.

**10. "Steam purchasers only" toggle**
- Problem: key-activated reviews were found inflated on 160+ titles; Amazon "verified" is the analog.
- Feature: popup toggle to compute label from `purchase_type=steam`; show a delta glyph when the two labels differ by a band.
- Data: `appreviews?purchase_type=steam` (works, verified: Elden Ring 830k vs 1.15M). Effort: S-M. Risk: doubles requests when on; cache; note Steam's headline score already excludes key activations, so this is mostly for detection of the gap.

**11. Per-language comparison chip**
- Problem: localization quality differs by language (Silksong: 90%+ EN vs 42-50% zh-CN).
- Feature: on hover, list the top 3-5 languages by count with percent each; flag when any language with 200+ reviews is 20+ points below global.
- Data: `appreviews?language=X` per language (one request each). Effort: M. Risk: 3-5 extra requests per game; only on hover for games over 2,000 reviews.

**12. Top negative complaint snippet on hover**
- Problem: users want the "why", not just a number (a key Epic criticism).
- Feature: on hover, fetch `filter=all&review_type=negative&num_per_page=3&language=<lang>` and show the first 140 chars of the most-helpful negative review plus its `weighted_vote_score`, playtime at review, and `steam_purchase`. Optionally one positive too.
- Data: `appreviews` review objects (verified fields). Effort: M. Risk: review text is user content (sanitize, no HTML); one extra request on hover only; heavy for MV3 content scripts if prefetched.

**13. 30-day review count and velocity ("+1,240 reviews / 30d")**
- Problem: count alone hides whether a game is alive; velocity is also the raw input to #7.
- Feature: show recent count from histogram `recent` sum; small sparkline optional.
- Data: same call as #5. Effort: S once #5 exists.

**14. Coverage: wishlist, library web views, community hub, Steam client (CEF) pages**
- Problem: wishlist sort by score is opaque; wishlist rows show a label but not percent/count; community pages show nothing.
- Feature: apply the same overlay and adjusted-score sort to `/wishlist/`, `/explore/`, `/curator/`, `/bundle/` (show per-item scores, since bundle labels mislead), and `steamcommunity.com` game lists. The Steam desktop client's store is a web view; content scripts do not run there, so document that limitation.
- Data: same. Effort: M per surface. Risk: DOM differs per page; more selectors to maintain.

**15. Card-tone styling (border/tint by band) and "hide forever" per game**
- Feature: optional 2px left border or tint using Steam's colors; one-click hide with a local blocklist; export/import settings and blocklist as JSON.
- Data: none. Effort: S each. Risk: tint fights Steam's own sale styling; keep subtle.

### P3 - deprioritized

**16. Metacritic / OpenCritic next to the Steam score**
- `appdetails.metacritic.score` is public and free; OpenCritic needs its API. Not Steam reviews; Augmented Steam already does OpenCritic. Only add if users ask.

**17. Reviews-by-playtime or "written during Early Access" split**
- Possible from review objects (`author.playtime_at_review`, `written_during_early_access`) but needs paging many reviews per game; too expensive for list views.

## 4. Data-source notes for engineering

- One `appreviews` call gives the all-time label, percent, and count. Adding `language=<user lang>` aligns with Steam's default label; `purchase_type=steam` gives the verified subset. Each variant is a separate request.
- `appreviewhistogram` is the only public JSON for the 30-day score, 30-day count, velocity, and histogram; it carries no off-topic exclusion and no label, so compute the band with the thresholds in 2.1.
- The `appreviews` summary ignores `day_range`, `filter`, and `review_type` (except `num_reviews`), so do not try to derive "recent" from it.
- Per-language summaries only matter above Steam's 2,000/200 thresholds; below that Steam itself shows the global score.
- Suggested request budget: 1 request per visible game by default (as today); histogram and variants only for games in the viewport or on hover; cache summaries for hours since Steam's own labels move slowly.

## 5. Sources

- https://steamdb.info/blog/steamdb-rating/
- https://github.com/SteamDatabase/steamdb.info-issues/issues/793
- https://github.com/woctezuma/Steam-Bayesian-Average
- https://www.emilkirkegaard.com/p/penalization-for-small-n-problems
- https://steam250.com/about
- https://steam250.com/hidden_gems
- https://www.fortressofdoors.com/fixing-steams-user-rating-charts/
- https://rf5.github.io/2020/12/13/steam-reviews.html
- https://www.steampageanalyzer.com/blog/steam-review-score-thresholds
- https://www.steampageanalyzer.com/blog/steam-review-bombing-guide
- https://games.alphacrc.com/investigating-steams-new-language-specific-review-scores/
- https://www.heise.de/en/news/Steam-differentiates-between-user-reviews-by-language-10544783.html
- https://kotaku.com/steam-reviews-wuchang-fallen-feather-china-language-filter-2000618249
- https://store.steampowered.com/news/app/593110/view/500579345320904529
- https://store.steampowered.com/oldnews/24155
- https://www.gamespot.com/articles/steam-updates-reviews-system-will-ban-developers-w/1100-6443509/
- https://variety.com/2019/gaming/news/steam-off-topic-review-bombing-1203164639/
- https://www.gamedeveloper.com/business/steam-user-reviews-will-no-longer-count-off-topic-review-bombs-
- https://www.gamedeveloper.com/business/what-did-and-didn-t-work-for-the-first-year-of-valve-s-steam-labs-experiments
- https://www.pcgamer.com/steam-gets-a-new-deep-dive-discovery-tool-and-community-recommendations/
- https://addons.mozilla.org/en-US/firefox/addon/augmented-steam/
- https://www.pcgamer.com/i-cant-use-steam-without-this-browser-extension-anymore/
- https://github.com/IsThereAnyDeal/AugmentedSteam/blob/develop/changelog.yml
- https://www.lorenzostanco.com/lab/steam/changelog
- https://steamcommunity.com/discussions/forum/10/1746720717342913492/
- https://steamcommunity.com/discussions/forum/10/1697175413670318567/
- https://steamcommunity.com/discussions/forum/0/1747891643726223176/
- https://steamcommunity.com/discussions/forum/0/458604254436696793
- https://steamcommunity.com/discussions/forum/0/524225948489557625
- https://steamcommunity.com/discussions/forum/0/3839927819746609411/
- https://steamcommunity.com/app/1643320/discussions/0/4626980894528274996/
- https://gamerant.com/steam-review-ratings-explained-mostly-negative-overwhelmingly-positive/
- https://github.com/fboulegue/Steam-Review-Graph
- https://docs.steamapis.com/apps/reviews
- https://www.playerintellabs.com/blog/steam-review-api-getappreviews-guide
- https://newsletter.gamediscover.co/p/what-steam-review-count-tells-us
- https://vaporlens.app/changelog/review-stats
- https://www.aboutamazon.com/news/retail/amazon-customer-reviews-star-ratings
- https://support.google.com/googleplay/android-developer/answer/138230?hl=en
- https://www.imdb.com/help/show_leaf?votestopfaq=
- https://www.datawrapper.de/blog/movie-reviews-rating-scales
- https://editorial.rottentomatoes.com/article/audience-score-update/
- https://www.hostfully.com/blog/airbnb-review-policy/
- https://www.yelp-support.com/article/Do-reviews-that-arent-currently-recommended-impact-the-businesss-star-rating?l=en_US
- https://www.pcgamer.com/epic-games-store-introduces-rating-system-designed-to-stop-review-bombing/
- https://www.resetera.com/threads/the-epic-games-store-%E2%80%9Cratings-and-polls%E2%80%9D-update.597198/
- https://www.pushsquare.com/news/2023/09/ps-store-adds-a-new-five-star-rating-system-to-score-your-ps5-ps4-games
- https://gameriv.com/playstation-app-reportedly-review-bombed-over-sony-killing-physical-games/
- https://www.microsoft.com/en-us/store/best-rated/games/xbox
- https://kotaku.com/nintendo-adds-user-reviews-immediately-pulls-them-1823391672
- https://www.gog.com/forum/general_archive/where_is_the_number_of_ratings_shown
- https://itch.io/t/1157108/a-way-to-show-ratings-on-a-games-page
