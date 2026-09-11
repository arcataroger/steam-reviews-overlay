/**
 * Review summaries, Steam's own numbers only, two flavours per game:
 *   global — Steam's `summary_filtered` (all languages, off-topic activity excluded)
 *   local  — Steam's `summary_language_specific` for the user's Steam language
 *
 * Sources: whatever the page already rendered (seeded, zero requests), then one batched
 * protobuf-encoded IStoreBrowseService/GetItems request per page for the rest.
 *
 * Freshness: each batch response carries Steam's own `Cache-Control: max-age=N`, which counts
 * down as Steam's CDN copy ages. We expire our entry at exactly that moment, so the
 * next fetch is guaranteed to hit a refreshed copy rather than the same cached one. Entries are
 * still shown while revalidating for up to STALE_MS, then dropped. Persistence exists only to
 * survive reloads and back/forward navigation.
 */

import { encodeGetItemsRequest, decodeGetItemsResponse, requestIncludesReviews, OWN_MARKER, type RawSummary } from './proto'
import { t } from './i18n'

/* ---------------- status (surfaced in the popup) ---------------- */

export type StatusKind = 'ok' | 'offline' | 'rate' | 'steam'
export interface Status {
  kind: StatusKind
  ts: number
  /** last time a fetch or replay succeeded */
  lastOk: number
}
export const STATUS_KEY = 'sro:status:v1'
let lastOk = 0
let lastKind: StatusKind | null = null

let lastOkWrite = 0
function reportStatus(kind: StatusKind) {
  const now = Date.now()
  if (kind === 'ok') {
    lastOk = now
    // an "ok" only needs persisting when it clears an error or every 30 s
    if (lastKind === 'ok' && now - lastOkWrite < 30_000) return
    lastOkWrite = now
  } else if (kind === lastKind) return
  lastKind = kind
  const st: Status = { kind, ts: now, lastOk }
  ext.storage.local.set({ [STATUS_KEY]: st }).catch(() => {})
}

export type ReviewTone = 'positive' | 'mixed' | 'negative' | 'none'

export interface Score {
  /** Steam's label verbatim: "Very Positive", "Mixed", "No user reviews", "3 user reviews", ... */
  label: string
  /** Steam's 0-9 score. 0 = Steam shows no score (fewer than 10 reviews). */
  score: number
  /** Steam's integer percent positive, or null when Steam gives none. */
  pct: number | null
  count: number
}

export interface ReviewSummary {
  appid: number
  global: Score | null
  local: Score | null
  /** when fetched/seeded */
  ts: number
  /** when Steam's own cached copy expires; refetch after this */
  expires: number
}

const ext: typeof chrome = (globalThis as any).browser ?? chrome

export const FALLBACK_FRESH_MS = 60_000 // only if Steam sends no usable max-age
export const STALE_MS = 15 * 60_000
const NEG_MS = 10 * 60_000
/** Items Steam told us are not games (hardware, videos, its own news app) stay that way: keep them
 *  out of the batch for a day rather than re-asking every ten minutes for as long as a tab lives. */
const NON_GAME_MS = 24 * 60 * 60_000
/** EStoreAppType values that are not something a review label belongs on: movie 3, video 7, series 8,
 *  episode 9, hardware 10, advertising 14 (Steam's own news/event app), config 15, shortcut 17,
 *  depot-only 18, comics 19/20. Games, demos, mods, DLC, software, music and tools keep their label. */
const NON_GAME_TYPES = new Set([3, 7, 8, 9, 10, 14, 15, 17, 18, 19, 20])
export const isNonGameType = (type: number | undefined) => type !== undefined && NON_GAME_TYPES.has(type)
const MAX_BATCH = 400 // conservative vs the ~8 KB URL cap Steam's edge enforces (≈800 ids fit); see docs/data-sourcing-research.md
const DEBOUNCE_MS = 300
const CACHE_KEY = 'sro:cache:v3'

let language = 'english'
export function setLanguage(l: string) {
  language = l
}

export function toneFor(score: number): ReviewTone {
  if (score >= 6) return 'positive'
  if (score === 5) return 'mixed'
  if (score >= 1) return 'negative'
  return 'none'
}

export const LABEL_TO_SCORE: Record<string, number> = {
  'overwhelmingly positive': 9, 'very positive': 8, positive: 7, 'mostly positive': 6, mixed: 5,
  'mostly negative': 4, negative: 3, 'very negative': 2, 'overwhelmingly negative': 1,
}

/* ---------------- cache ---------------- */

const mem = new Map<number, ReviewSummary>()
const negative = new Map<number, number>() // appid → expiry time
let loaded: Promise<void> | null = null
let persistTimer: number | undefined

function loadPersisted(): Promise<void> {
  if (loaded) return loaded
  loaded = (async () => {
    try {
      const res = await ext.storage.local.get(CACHE_KEY)
      const stored = res?.[CACHE_KEY] as Record<string, ReviewSummary> | undefined
      const now = Date.now()
      for (const v of Object.values(stored ?? {})) {
        if (v && now - v.ts < STALE_MS && !mem.has(v.appid)) mem.set(v.appid, v)
      }
    } catch (e) {
      console.warn('[SRO] cache load failed', e)
    }
  })()
  return loaded
}

function schedulePersist() {
  if (persistTimer) return
  persistTimer = window.setTimeout(async () => {
    persistTimer = undefined
    const now = Date.now()
    try {
      // Merge with what other tabs wrote so tabs don't clobber each other's entries
      const res = await ext.storage.local.get(CACHE_KEY)
      const obj: Record<string, ReviewSummary> = {}
      for (const v of Object.values((res?.[CACHE_KEY] as Record<string, ReviewSummary>) ?? {})) if (v && now - v.ts < STALE_MS) obj[v.appid] = v
      for (const [k, v] of mem) if (now - v.ts < STALE_MS && !(obj[k] && obj[k].ts > v.ts)) obj[k] = v
      await ext.storage.local.set({ [CACHE_KEY]: obj })
    } catch (e) {
      console.warn('[SRO] cache persist failed', e)
    }
  }, 2000)
}

function put(s: ReviewSummary) {
  mem.set(s.appid, s)
  negative.delete(s.appid)
  schedulePersist()
  const subs = listeners.get(s.appid)
  if (subs) for (const cb of subs) cb(s)
}

export function peekCached(appid: number): ReviewSummary | undefined {
  const s = mem.get(appid)
  return s && Date.now() - s.ts < STALE_MS ? s : undefined
}

/**
 * Seed one side from data the page already rendered. Fills the missing side of an existing
 * entry, never replaces a side that is still within Steam's own freshness window.
 */
export function seed(appid: number, side: 'global' | 'local', score: Score) {
  const now = Date.now()
  const cur = mem.get(appid)
  if (cur && cur[side] && cur.expires > now) return
  const have = cur?.[side]
  if (have && have.label === score.label && have.pct === score.pct && have.count === score.count) return // nothing new
  put({
    appid,
    global: side === 'global' ? score : (cur?.global ?? null),
    local: side === 'local' ? score : (cur?.local ?? null),
    ts: now,
    // Page data was rendered from Steam's cache too; give it a short life so both sides get fetched.
    expires: cur?.expires && cur.expires > now ? cur.expires : now + FALLBACK_FRESH_MS,
  })
}

/* ---------------- subscriptions + batching ---------------- */

type Listener = (s: ReviewSummary) => void
const listeners = new Map<number, Set<Listener>>()
const pending = new Set<number>()
const inflight = new Set<number>()
let flushTimer: number | undefined
let draining = false

/** `cb` fires immediately with any cached data (fresh or stale), and again whenever newer data arrives. */
export function subscribe(appid: number, cb: Listener): () => void {
  let set = listeners.get(appid)
  if (!set) listeners.set(appid, (set = new Set()))
  set.add(cb)
  let live = true
  void loadPersisted().then(() => {
    if (!live) return
    const cur = mem.get(appid)
    const now = Date.now()
    if (cur && now - cur.ts < STALE_MS) cb(cur)
    const complete = !!(cur && cur.global && cur.local)
    if (!cur || !complete || cur.expires <= now) enqueue(appid)
  })
  startRevalidation()
  return () => {
    live = false
    set!.delete(cb)
    if (!set!.size) listeners.delete(appid)
  }
}

/** Long-lived tabs: re-fetch ids that still have listeners once Steam's copy has expired. */
let revalidateTimer: number | undefined
/** Stop the background work (another instance of the content script took over the page). */
export function stopSteam() {
  if (revalidateTimer) clearInterval(revalidateTimer)
  revalidateTimer = undefined
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = undefined
  pending.clear()
  listeners.clear()
}

function startRevalidation() {
  if (revalidateTimer) return
  revalidateTimer = window.setInterval(() => {
    const now = Date.now()
    for (const appid of listeners.keys()) {
      const cur = mem.get(appid)
      if (!cur || cur.expires <= now) enqueue(appid)
    }
  }, 60_000)
}

function enqueue(appid: number) {
  if (inflight.has(appid)) return
  const neg = negative.get(appid)
  if (neg && Date.now() < neg) return
  pending.add(appid)
  if (!flushTimer) flushTimer = window.setTimeout(() => void drain(), DEBOUNCE_MS)
}

async function drain() {
  flushTimer = undefined
  if (draining) return
  draining = true
  try {
    while (pending.size) {
      const batch = [...pending].slice(0, MAX_BATCH)
      for (const id of batch) {
        pending.delete(id)
        inflight.add(id)
      }
      try {
        await fetchBatch(batch)
      } catch (e) {
        console.warn('[SRO] batch failed', e)
      } finally {
        for (const id of batch) inflight.delete(id)
      }
    }
  } finally {
    draining = false
  }
}

let backoffUntil = 0
let retries = 0
const MAX_RETRIES = 8

/**
 * Put a failed batch back on the queue with exponential backoff (jittered, capped at 10 min).
 * After MAX_RETRIES the ids are negative-cached so a broken Steam doesn't get hammered forever.
 */
function retryLater(appids: number[], baseMs: number) {
  if (retries >= MAX_RETRIES) {
    const now = Date.now()
    for (const id of appids) negative.set(id, now + NEG_MS)
    return
  }
  const delay = Math.min(10 * 60_000, baseMs * 2 ** retries) + Math.random() * 1000
  retries++
  backoffUntil = Date.now() + delay
  for (const id of appids) pending.add(id) // drain() is still looping; fetchBatch waits out backoffUntil
}

function toScore(sf: RawSummary): Score {
  const score = sf.review_score ?? 0
  const count = sf.review_count ?? 0
  return {
    label: sf.review_score_label ?? '', // empty → renderer shows the localized "Not enough reviews"

    score,
    pct: score > 0 ? (sf.percent_positive ?? null) : null,
    count,
  }
}

/** Remaining lifetime of Steam's cached copy, from its own Cache-Control header. */
function freshnessFrom(res: Response): number {
  const cc = res.headers.get('cache-control') ?? ''
  const m = cc.match(/max-age=(\d+)/)
  if (!m) return FALLBACK_FRESH_MS
  const age = Number(res.headers.get('age') ?? 0)
  return Math.max(0, Number(m[1]) - age) * 1000
}

async function fetchBatch(appids: number[]) {
  const wait = backoffUntil - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  const enc = encodeGetItemsRequest(appids, { country: 'US', language })
  const url =
    `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?${OWN_MARKER}&format=json&input_protobuf_encoded=` +
    encodeURIComponent(enc)
  let res: Response
  try {
    res = await fetch(url, { credentials: 'omit' })
  } catch {
    reportStatus('offline')
    retryLater(appids, 15_000)
    return
  }
  if (res.status === 429) {
    reportStatus('rate')
    retryLater(appids, 20_000)
    return
  }
  if (res.status >= 500) {
    reportStatus('steam')
    retryLater(appids, 10_000)
    return
  }
  if (!res.ok) {
    // 4xx (e.g. URL too long): don't keep asking for these ids this session
    reportStatus('steam')
    const now = Date.now()
    for (const id of appids) negative.set(id, now + NEG_MS)
    return
  }
  const fresh = freshnessFrom(res)
  let json: {
    response?: {
      store_items?: {
        id?: number
        success?: number
        type?: number
        reviews?: { summary_filtered?: RawSummary; summary_language_specific?: RawSummary }
      }[]
    }
  }
  try {
    json = await res.json()
  } catch {
    reportStatus('steam')
    retryLater(appids, 10_000) // an HTML error page with 200: transient, try again later
    return
  }
  reportStatus('ok')
  retries = 0
  const now = Date.now()
  const seen = new Set<number>()
  for (const item of json.response?.store_items ?? []) {
    if (!item.id) continue
    seen.add(item.id)
    const g = item.reviews?.summary_filtered
    if (item.success !== 1 || !g || isNonGameType(item.type)) {
      negative.set(item.id, now + (isNonGameType(item.type) ? NON_GAME_MS : NEG_MS))
      continue
    }
    const l = item.reviews?.summary_language_specific
    put({
      appid: item.id,
      global: toScore(g),
      local: l ? toScore(l) : null,
      ts: now,
      expires: now + fresh,
    })
  }
  for (const id of appids) if (!seen.has(id)) negative.set(id, now + NEG_MS)
}

/* ---------------- piggyback on Steam's own calls ---------------- */

const ingested = new Set<string>()

/**
 * Steam's frontend just finished a GetItems call that included reviews. Replay the identical
 * URL: it comes straight out of the HTTP cache (verified: fromDiskCache, ~5 ms), so this costs
 * no network. Decode the protobuf body and fill the cache before the cards even render.
 */
export async function ingestSteamRequest(url: string): Promise<number> {
  // Only ever replay Steam's GetItems endpoint, whatever the message said
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 0
  }
  if (u.origin !== 'https://api.steampowered.com' || !u.pathname.startsWith('/IStoreBrowseService/GetItems/')) return 0
  // Same URL again within the minute is the same cached response; later it's a fresh one worth reading
  const key = `${url}#${Math.floor(Date.now() / 60_000)}`
  if (ingested.has(key)) return 0
  ingested.add(key)
  if (ingested.size > 500) ingested.delete(ingested.values().next().value!)
  if (!requestIncludesReviews(url)) return 0
  let res: Response
  try {
    res = await fetch(url, { credentials: 'omit', cache: 'force-cache' })
  } catch {
    return 0 // the page's own request already succeeded; our replay failing is not user-facing
  }
  if (!res.ok || !/octet-stream|protobuf/i.test(res.headers.get('content-type') ?? '')) return 0
  reportStatus('ok')
  const fresh = freshnessFrom(res)
  const buf = new Uint8Array(await res.arrayBuffer())
  let items
  try {
    items = decodeGetItemsResponse(buf)
  } catch (e) {
    console.warn('[SRO] could not decode Steam response', e)
    return 0
  }
  const now = Date.now()
  let n = 0
  for (const it of items) {
    if (it.success !== 1 || it.item_type !== 0 || !it.appid || !it.summary_filtered) continue
    if (isNonGameType(it.type)) {
      negative.set(it.appid, now + NON_GAME_MS) // hardware, Steam's own news app, videos: never a label
      continue
    }
    // Cancel any pending fetch of ours for this id: Steam just handed it to us.
    pending.delete(it.appid)
    put({
      appid: it.appid,
      global: toScore(it.summary_filtered),
      local: it.summary_language_specific ? toScore(it.summary_language_specific) : null,
      ts: now,
      expires: now + fresh,
    })
    n++
  }
  return n
}

export function formatTooltip(s: Score, scope: string): string {
  const label = s.label || t('notEnoughReviews')
  if (s.pct === null || !s.count) return t('tooltipNoPct', scope, label)
  return t('tooltip', scope, label, s.pct, s.count.toLocaleString())
}
