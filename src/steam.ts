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

import { encodeGetItemsRequest } from './proto'

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
const MAX_BATCH = 400
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
const negative = new Map<number, number>()
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
    const obj: Record<string, ReviewSummary> = {}
    for (const [k, v] of mem) if (now - v.ts < STALE_MS) obj[k] = v
    try {
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
  void loadPersisted().then(() => {
    const cur = mem.get(appid)
    const now = Date.now()
    if (cur && now - cur.ts < STALE_MS) cb(cur)
    const complete = !!(cur && cur.global && cur.local)
    if (!cur || !complete || cur.expires <= now) enqueue(appid)
  })
  return () => {
    set!.delete(cb)
    if (!set!.size) listeners.delete(appid)
  }
}

function enqueue(appid: number) {
  if (inflight.has(appid)) return
  const neg = negative.get(appid)
  if (neg && Date.now() - neg < NEG_MS) return
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

interface RawSummary {
  review_count?: number
  percent_positive?: number
  review_score?: number
  review_score_label?: string
}

function toScore(sf: RawSummary): Score {
  const score = sf.review_score ?? 0
  const count = sf.review_count ?? 0
  return {
    label: sf.review_score_label || (count ? `${count} user reviews` : 'No user reviews'),
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
    'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?format=json&input_protobuf_encoded=' +
    encodeURIComponent(enc)
  const res = await fetch(url, { credentials: 'omit' })
  if (res.status === 429 || res.status >= 500) {
    backoffUntil = Date.now() + 10_000
    for (const id of appids) pending.add(id)
    if (!flushTimer) flushTimer = window.setTimeout(() => void drain(), 10_000)
    return
  }
  if (!res.ok) return
  const fresh = freshnessFrom(res)
  const json = (await res.json()) as {
    response?: {
      store_items?: {
        id?: number
        success?: number
        reviews?: { summary_filtered?: RawSummary; summary_language_specific?: RawSummary }
      }[]
    }
  }
  const now = Date.now()
  const seen = new Set<number>()
  for (const item of json.response?.store_items ?? []) {
    if (!item.id) continue
    seen.add(item.id)
    const g = item.reviews?.summary_filtered
    if (item.success !== 1 || !g) {
      negative.set(item.id, now)
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
  for (const id of appids) if (!seen.has(id)) negative.set(id, now)
}

export function formatTooltip(s: Score, scope: string): string {
  if (s.pct === null || !s.count) return `${scope}: ${s.label}`
  return `${scope}: ${s.label} — ${s.pct}% of the ${s.count.toLocaleString()} user reviews are positive`
}
