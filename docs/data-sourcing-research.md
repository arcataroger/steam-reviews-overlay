# Data sourcing research: review summaries with less Steam traffic

Date: 2026-09-10. All requests below were run with `curl` from a normal home IP with no cookies and no API key unless stated.

## TL;DR

1. **Batch endpoint exists and needs no key:** `GET https://api.steampowered.com/IStoreBrowseService/GetItems/v1/` with `data_request.include_reviews=true` returns `review_score`, `review_score_label`, `percent_positive`, `review_count` for many appids in one call. Verified 300 ids/request with JSON input, **980 ids/request with protobuf input** (`input_protobuf_encoded` + `format=json`). The only limit hit was an Akamai URL length cap (~8 KB → HTTP 414/400). Responses are `cache-control: public, max-age=120`.
2. **Two store surfaces already embed the summary, no fetch needed:** search results (`.search_review_summary[data-tooltip-html]`) and the homepage (146 featured appids with `review_summary_filtered` JSON in the HTML).
3. **Recommended:** page-scrape first → protobuf `GetItems` batch for the rest → 7-day TTL with stale-while-revalidate. This alone cuts per-page requests from N to ≤1 and total traffic by >95%. A shared signed snapshot on a zero-egress CDN is a good second phase (~0.7 MB gzip for 100k apps). P2P is not a good fit.

---

## 1. Steam-side data sources

### 1a. `IStoreBrowseService/GetItems/v1` (batch, no key) — the winner

Verified request (JSON input):

```
curl -s 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=%7B%22ids%22%3A%5B%7B%22appid%22%3A570%7D%2C%7B%22appid%22%3A730%7D%5D%2C%22context%22%3A%7B%22language%22%3A%22english%22%2C%22country_code%22%3A%22US%22%7D%2C%22data_request%22%3A%7B%22include_reviews%22%3Atrue%7D%7D'
```

Decoded `input_json`:

```json
{"ids":[{"appid":570},{"appid":730}],
 "context":{"language":"english","country_code":"US"},
 "data_request":{"include_reviews":true}}
```

Relevant part of the response (HTTP 200, `x-eresult: 1`, `cache-control: public, max-age=120`):

```json
{"response":{"store_items":[
 {"id":570,"success":1,"visible":true,"name":"Dota 2","appid":570,
  "reviews":{
    "summary_filtered":{"review_count":2776772,"percent_positive":80,"review_score":8,"review_score_label":"Very Positive"},
    "summary_language_specific":{"review_count":838334,"percent_positive":87,"review_score":8,"review_score_label":"Very Positive"}}},
 {"id":730,"success":1,"name":"Counter-Strike 2","appid":730,
  "reviews":{
    "summary_filtered":{"review_count":9852188,"percent_positive":85,"review_score":8,"review_score_label":"Very Positive"},
    "summary_language_specific":{"review_count":2612384,"percent_positive":86,"review_score":8,"review_score_label":"Very Positive"}}}]}}
```

- `summary_filtered` = all languages, with Steam's off-topic-review filtering applied. It matches what `/appreviews/570?language=all` returns (`total_reviews: 2775935`, `review_score: 8`, `review_score_desc: "Very Positive"`) to within 0.03%. This is the field the extension should use.
- `summary_language_specific` = reviews in `context.language` only.
- Unknown / unreleased / delisted appids come back as `{"success":2}` entries with no `reviews`, so misses are explicit.
- Field list (from https://steamapi.xpaw.me/IStoreBrowseService and the `.proto` at https://raw.githubusercontent.com/SteamDatabase/Protobufs/master/webui/common.proto): `StoreBrowseItemDataRequest` has `include_reviews` (field 9), `include_ratings`, `include_basic_info`, `apply_user_filters` (16), etc. `StoreBrowseContext` has `language` (1), `country_code` (3). `StoreItemID` has `appid` (1).

Facts verified by probing:

| Probe | Result |
|---|---|
| API key | **Not required.** xpaw's page lists `key` as required, but every call above succeeded without one (the proto marks it `eWebAPIKeyRequirement=1`). |
| HTTP method | GET only. POST returns `405 "This API must be called with a HTTP GET request"`. |
| `context` | Required. Empty context → `{"response":{}}`. `{"country_code":"US"}` alone is enough; `language` alone is not. |
| Batch size, JSON input | 10/100/150/200/250/300 ids → 200 OK. 280 six-digit ids (URL 8359 B) → **414**; 300+ → **400 Bad Request** from Akamai edge (`errors.edgesuite.net`). The limit is URL length (~8190 bytes), not id count. ~250 six-digit ids or ~300 short ids per request. |
| Batch size, protobuf input | `input_protobuf_encoded=<base64>&format=json`: 500, 800, 900, 950, **980 six-digit ids → 200 OK JSON** (URL 8021 B). 1000 → 414. 900 seven-digit ids (URL 8629 B) → 414. Rule of thumb: **~800 mixed-size appids per request**. |
| Response size | ~150 bytes/app JSON (980 ids → 146 KB). |
| Rate limit | 20 back-to-back requests → all 200. No 429 observed. Valve's general Web API terms cap keyed use at 100,000 calls/day (https://steamcommunity.com/dev/apiterms); keyless per-IP limits are undocumented. Reports since June 2025 describe ~25 req/s burst locks on other keyless endpoints (https://www.steamwebapi.com/blog/429-too-many-requests-for-getplayersummaries), so keep it to a few requests per page load. |
| CORS | With `Origin: https://store.steampowered.com` the response carries `access-control-allow-origin: https://store.steampowered.com` (this is the endpoint the storefront's own React code uses). With `Origin: chrome-extension://...` there is **no** ACAO header. Therefore: fetch from the **extension service worker** with `host_permissions` for `https://api.steampowered.com/*` (Chrome: "A script executing in an extension service worker or foreground tab can talk to remote servers outside of its origin, as long as the extension requests host permissions" — https://developer.chrome.com/docs/extensions/develop/concepts/network-requests). A content script is subject to the page's CORS, but since the page origin *is* `store.steampowered.com` a content-script fetch also works on store pages. |

Protobuf encoding is trivial (no library needed). Python reference that produced the 980-id request:

```python
def varint(n):
    out=b''
    while True:
        b=n&0x7f; n>>=7
        if n: out+=bytes([b|0x80])
        else: return out+bytes([b])
def field(num, wt, payload): return varint((num<<3)|wt)+payload
def ld(num, b): return field(num,2,varint(len(b))+b)
body  = b''.join(ld(1, field(1,0,varint(i))) for i in ids)  # ids[]: StoreItemID{appid=1}
body += ld(2, ld(3, b'US'))                                   # context{country_code=3}
body += ld(3, field(9,0,varint(1)))                           # data_request{include_reviews=9}
url = ".../GetItems/v1/?format=json&input_protobuf_encoded=" + urlquote(base64(body))
```

Each appid costs 4–6 bytes of protobuf (~7 bytes after base64+urlencode) versus ~27 bytes as `{"appid":1234567},` in JSON.

### 1b. `store.steampowered.com/appreviews/<appid>?json=1` (current approach)

```
{"success":1,"query_summary":{"num_reviews":0,"review_score":8,"review_score_desc":"Very Positive",
 "total_positive":2234877,"total_negative":541058,"total_reviews":2775935},"reviews":[],"cursor":"*"}
```

- One appid per call. `Cache-Control: private, max-age=600`, no CORS header at all (works only because the page origin is the store).
- 30 back-to-back calls → all 200; no limit hit, but it is the least efficient option: N requests per page.
- Docs: https://partner.steamgames.com/doc/store/getreviews

### 1c. `store.steampowered.com/api/appdetails`

- `?appids=440&filters=recommendations,metacritic` → `{"440":{"success":true,"data":{"metacritic":{"score":92,...},"recommendations":{"total":47839}}}}`. **No review score/label**; `recommendations.total` is a positive-review count only.
- `?appids=570,730` with no filter → gzip garbage / effectively unsupported (multi-appid was removed in 2015; https://github.com/burkanbogaz/steamworks-api). `?appids=570,730,440&filters=price_overview` → 200 with `"data":[]` for each (batching only works for `price_overview`, and only for paid apps).
- `Cache-Control: public,max-age=3600`, CORS restricted to `store.steampowered.com`. Community-reported limit ≈200 requests / 5 min per IP (https://blog.kartones.net/post/steam-web-api-introduction/). **Not useful for reviews.**

### 1d. `apphoverpublic` / `apphover`

`GET https://store.steampowered.com/apphoverpublic/440?l=english` returns HTML with:

```html
<div class="hover_review_summary"><div class="title">English Reviews:</div>
<span class="game_review_summary positive">Very Positive</span>(742,176 reviews)</div>
```

One appid per call, language-specific count, no numeric score. Only worth reading passively if the user hovers a card (the store fires this request itself; the extension could observe the injected DOM instead of refetching). Not a batch source.

### 1e. `search/results/?json=1` and other pages that already embed the summary

- `GET https://store.steampowered.com/search/results/?query=&start=0&count=50&infinite=1&json=1` returns `results_html` whose rows contain the full summary already:

  ```html
  <span class="search_review_summary positive" data-tooltip-html="Very Positive&lt;br&gt;86% of the 2,613,161 user reviews for this game are positive.&lt;br&gt;..."
  ```

  The same markup is server-rendered on `/search/` pages and infinite-scroll pages. Label + percent + count are all there; `review_score` (0–9) can be derived from the label (Steam's public label→score mapping is fixed: e.g. Overwhelmingly Positive=9, Very Positive=8, Positive=7, Mostly Positive=6, Mixed=5, Mostly Negative=4, Negative=3, Very Negative=2, Overwhelmingly Negative=1, no reviews=0).
- **Homepage** (`/`): the server-rendered HTML contains 149 `"review_summary_filtered":{...}` JSON blobs for **146 distinct appids** (featured/recommended capsules), each with `reviewScore`, `reviewSummaryDesc`, `cReviews`, `cRecommendationsPositive`, `cRecommendationsNegative`, `sReviewScoreTooltip`. Example: `"appid":275850 ... "review_summary_filtered":{"cReviews":184045,"cRecommendationsPositive":150893,"cRecommendationsNegative":33152,"reviewScore":8,"reviewSummaryDesc":"Very Positive","sReviewScoreTooltip":"81% of the 184,045 user reviews for this game are positive."}`. Parse this once per page load and seed the cache.
- **Category/genre/sale pages** (`/category/action/` etc.) are React-rendered client-side; the initial HTML has no review data. The page's own JS fetches `IStoreBrowseService/GetItems` from `api.steampowered.com` (that is why that endpoint has ACAO for the store origin). Those responses are HTTP-cached (`public, max-age=120`), so an extension request for the same ids within 2 minutes may be served from the browser cache, but the URL must be byte-identical to the store's, which is not practical to guarantee.
- `dynamicstore/userdata` is only the user's wishlist/owned/cart state, no review data.

### 1f. Steam's label thresholds (for deriving labels from raw counts)

Public and stable for years: needs ≥10 reviews; 95–100% positive & ≥500 reviews = Overwhelmingly Positive; 80–100% & ≥50 = Very Positive; 80–100% & 10–49 = Positive; 70–79% = Mostly Positive; 40–69% = Mixed; 20–39% = Mostly Negative; 0–19% & 10–49 = Negative; 0–19% & ≥50 = Very Negative; 0–19% & ≥500 = Overwhelmingly Negative. Useful only for third-party count data; Steam's own `summary_filtered` already applies off-topic filtering that raw counts miss.

---

## 2. Third-party datasets / APIs

| Source | Batch? | Review fields | Freshness / limits | Verdict |
|---|---|---|---|---|
| **SteamSpy** `https://steamspy.com/api.php?request=all&page=N` (https://steamspy.com/api.php) | Yes: 1000 apps/page, pages 0–~86 (page 85 = 1000 rows, page 90 = empty ⇒ ~86–90k apps). ~355 KB/page. | `positive`, `negative` counts only (no label/score; derive via 1f). | Stated limit: 1 req/s, **1 req/60 s for `all`**. Cloudflare-cached `max-age=86400`. **Stale:** page 0 still names 730 "Counter-Strike: Global Offensive" with 7.64M positive / 1.17M negative (8.8M total) vs Steam's live 9.85M. Ownership data is known to be months behind. | OK for a coarse bootstrap snapshot, not as the live source. Terms: none published; attribution expected. |
| **SteamDB** | No public API. | — | FAQ (https://steamdb.info/faq/): "we do not currently offer a public API"; scraping "there's a chance you'll get automatically banned"; they point you at Steam's own APIs. | Do not use. |
| **IsThereAnyDeal** (https://docs.isthereanydeal.com/) | `/games/info/v2` is single-game; only `/games/prices/v3` batches (200 ids). | `reviews:[{"source":"Steam","score":86,"count":84184}]` | API key required; 1000 req / 5 min. Commercial use allowed if app is public; attribution required. | Worse than Steam's own batch endpoint; adds a key and a third party. |
| **Kaggle / GitHub dumps** — e.g. "Steam Games Dataset All Games 136K+ (daily updates)" https://www.kaggle.com/datasets/hubertsidorowicz/steam-games-dataset-daily-updates ; vintagedon/steam-dataset-2025 https://github.com/vintagedon/steam-dataset-2025 ; woctezuma/steam-store-snapshots https://github.com/woctezuma/steam-store-snapshots (app lists only, no reviews) | Bulk files | Varies; most are one-off scrapes of `appreviews`. | Not machine-fetchable from an extension (Kaggle needs login); licences vary (CC0 / CC BY / unspecified). | Only useful as a seed you re-host yourself. |
| npm "steam-reviews"/scrapers | — | wrap `appreviews` per app | — | Nothing that publishes a maintained score feed. |

**No third party publishes a fresh, licensed, batch feed of Steam's own review labels.** The best "third party" is a snapshot you build from `GetItems` yourself.

### Snapshot size (measured from real `GetItems` data, 86 apps)

Format `{"<appid>":[score,pct,count],...}`: **18.7 bytes/app JSON, 6.9 bytes/app gzipped.**

| Apps | JSON | gzip |
|---|---|---|
| 20k (everything with ≥10 reviews that people actually see) | 0.37 MB | 0.14 MB |
| 50k | 0.93 MB | 0.34 MB |
| 100k | 1.87 MB | 0.69 MB |
| 150k (whole catalogue) | 2.80 MB | 1.03 MB |

A fixed binary record (u32 appid, u8 score, u8 pct, u32 count = 10 B) is 1.0 MB raw for 100k, ~0.5 MB with delta-varint appids. Building the snapshot costs ~125 `GetItems` calls (800 ids each) per refresh — trivial.

Hosting: Cloudflare R2 has $0 egress and 10 GB free storage (https://r2drop.com/blog/cloudflare-r2-free-tier-guide); GitHub Pages has a 100 GB/month soft cap (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) — 0.7 MB × 100k installs × 1 refresh/week ≈ 280 GB/month, so use R2/Cloudflare Pages, not GitHub Pages, if installs grow.

---

## 3. Peer-to-peer options for an MV3 extension

Common constraints first:

- **MV3 service workers cannot hold `RTCPeerConnection`**; they are killed after ~30 s idle. WebRTC must live in a content script or an **offscreen document** (`chrome.offscreen`, Chrome ≥109) that the SW creates and keeps alive by messaging (https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3, https://cwskit.khanakia.com/blog/webrtc-in-chrome-extensions). Firefox has no offscreen API; you'd use a content script or an extension page.
- **Every browser P2P scheme still needs a rendezvous/signaling server** (tracker, relay, Nostr relay, MQTT broker, WebSocket) plus STUN/TURN for NAT traversal. "Serverless" means "someone else's server".
- **Trust:** any peer can serve fake scores. The only sound mitigation is that peers exchange **author-signed snapshots** (Ed25519 signature over the whole file, public key baked into the extension). Once you sign a central snapshot, P2P only saves you egress, which R2 already gives away for free.

| Option | Works in MV3? | Needs server anyway? | Notes |
|---|---|---|---|
| **Trystero** (https://github.com/dmotz/trystero) | Yes, in offscreen doc / content script (browser-only, WebRTC). | Yes: BitTorrent trackers, Nostr relays, MQTT brokers, or Supabase/Firebase for signaling. | Simplest API; data is E2E-encrypted per room. Public tracker/relay operators may throttle or block. |
| **WebTorrent** | Yes (offscreen doc). | Yes: WSS trackers (public ones are rate-limited/unreliable). | Could seed the snapshot as a torrent; needs a web seed (HTTP) as fallback → you are back to a CDN. |
| **libp2p (js-libp2p + @libp2p/webrtc)** (https://libp2p.io/docs/webrtc-browser-connectivity/) | Yes, but heavy (~1 MB) and needs the DOM context. | Yes: circuit-relay + bootstrap nodes you operate. | Overkill. |
| **Helia / IPFS in-browser** | IPFS Companion runs on MV3, but Helia in an extension is large and slow to bootstrap. | Yes: delegated routing/relays/gateways. | Fetching via a public IPFS **gateway** is just HTTP to someone else's CDN; no benefit over R2. |
| **Hyperswarm / Holepunch** | No native browser support (issue #62); `hyperswarm-web` is 4 years unmaintained and requires a WS proxy. | Yes. | Not viable. |
| **Gun.js / OrbitDB / y-webrtc (Yjs)** (https://github.com/yjs/y-webrtc) | Yes (offscreen doc). | Yes: relay peers / signaling server. | CRDT sync is the wrong shape for an immutable, author-published dataset; Gun's SEA signing is per-write, so you'd need to sign every record anyway. |
| **PeerJS** | Yes. | Yes: PeerServer (public one is best-effort). | Hub-and-spoke; no discovery. |

**Honest assessment:** P2P does not fit. The dataset is small (≤1 MB), changes slowly, has one trusted author, and the cost of serving it centrally is ~$0 (R2 zero egress). P2P adds a signaling dependency, an offscreen-document lifecycle, NAT-traversal failures, privacy questions (peers learn each other's IPs — a Chrome Web Store review concern for an extension that just shows review scores), and a tamper surface. A signed snapshot on a CDN gives all the "be a good netizen" benefit with none of that.

---

## 4. Recommended tiered architecture

Ranked by traffic reduction per unit of effort. Tiers stack.

| Tier | What | Steam requests per store page | Effort |
|---|---|---|---|
| **A. Reuse what's on the page** | Parse `.search_review_summary[data-tooltip-html]` on search/infinite-scroll pages; parse the `"review_summary_filtered"` JSON blobs on the homepage (146 appids). Seed cache from them, never fetch those ids. | 0 for search pages and most of the homepage | Small |
| **B. Batch the rest via `GetItems`** | Collect all uncached appids on the page (debounce ~250 ms, dedupe with in-flight set), send **one** protobuf-encoded `GetItems` request (≤800 ids, `format=json`, `context.country_code` only, `include_reviews` only). Fetch from the SW (or content script — same origin as store). Use `summary_filtered`. Record `success!=1` ids as negative-cache entries (24 h) so they are not re-asked. | ≤1 (vs N today) | Small. Encoder is ~15 lines; JSON input is fine if you cap at ~250 ids. |
| **C. Longer TTL + stale-while-revalidate** | Review labels change slowly. TTL 7 days for apps with ≥1000 reviews, 3 days for 100–999, 24 h under 100 (small counts move fastest). Serve stale immediately, refresh in a background batch only if stale > TTL and the id is actually visible (IntersectionObserver), and only ~1 refresh batch per hour per user. Keep the cache in `chrome.storage.local` (5 MB by default; 100k entries × ~20 B = 2 MB, or request `unlimitedStorage`). | Amortised ≪1 | Small |
| **D. Shared signed snapshot + delta** | A scheduled job (GitHub Actions cron, ~125 `GetItems` calls) builds `{appid:[score,pct,count]}` for all apps with ≥10 reviews, gzips it (~0.7 MB), signs it (Ed25519, key in the extension), uploads to Cloudflare R2/Pages. Extension downloads it once a week (ETag/If-None-Match), verifies the signature, uses it as the L2 cache; only ids missing from the snapshot (new releases) go to `GetItems` (tier B). Optionally publish daily deltas (a few KB). | ~0 to Steam; ~0.7 MB/week/user from your CDN at $0 egress | Medium: one cron job, one bucket, one signature check. Also removes Steam from the hot path entirely and makes the extension work if Valve changes the endpoint. |
| **E. P2P distribution of the snapshot** | Trystero/WebTorrent in an offscreen document sharing tier-D's signed file. | Same as D | High, and the win over D is zero because R2 egress is already free. **Not recommended.** |

Suggested order: implement **A + B + C now** (a day's work, >95% reduction: a 50-card page goes from 50 `appreviews` calls to at most one `GetItems` call, and with a week-long TTL most page loads make none). Add **D** once installs make the ~125 daily upstream calls of a snapshot job cheaper than users' misses, or as soon as you want resilience against endpoint changes. Skip E.

Practical notes for tier B:

- Send `Accept-Encoding: gzip` (the browser does); a 980-id response is 146 KB uncompressed.
- Keep one request in flight per tab; coalesce across tabs in the service worker.
- Back off on any non-200 (exponential, 30 s → 10 min) and never retry a 4xx.
- Set an identifying `User-Agent` is not possible from an extension, but a `?origin=` query param or an extension name in a harmless header is a courteous fingerprint if Valve ever needs to contact you.
- Language: use `summary_filtered` for parity with the store's default display; the store's per-language toggle maps to `summary_language_specific` with `context.language` set.

## Sources

- https://steamapi.xpaw.me/IStoreBrowseService
- https://raw.githubusercontent.com/SteamDatabase/Protobufs/master/webui/service_storebrowse.proto
- https://raw.githubusercontent.com/SteamDatabase/Protobufs/master/webui/common.proto
- https://partner.steamgames.com/doc/store/getreviews
- https://partner.steamgames.com/doc/webapi_overview
- https://steamcommunity.com/dev/apiterms
- https://blog.kartones.net/post/steam-web-api-introduction/
- https://github.com/burkanbogaz/steamworks-api
- https://www.steamwebapi.com/blog/429-too-many-requests-for-getplayersummaries
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3
- https://cwskit.khanakia.com/blog/webrtc-in-chrome-extensions
- https://steamspy.com/api.php
- https://github.com/woctezuma/steamspypi
- https://steamdb.info/faq/
- https://docs.isthereanydeal.com/
- https://www.kaggle.com/datasets/hubertsidorowicz/steam-games-dataset-daily-updates
- https://github.com/vintagedon/steam-dataset-2025
- https://github.com/woctezuma/steam-store-snapshots
- https://github.com/dmotz/trystero
- https://libp2p.io/docs/webrtc-browser-connectivity/
- https://github.com/holepunchto/hyperswarm/issues/62
- https://github.com/yjs/y-webrtc
- https://blog.ipfs.tech/2023-ipfs-companion-mv3-update/
- https://r2drop.com/blog/cloudflare-r2-free-tier-guide
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
