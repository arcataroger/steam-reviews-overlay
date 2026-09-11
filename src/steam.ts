/**
 * Review summaries, Steam's own numbers only.
 *
 * Sources, in order of preference:
 *   1. Whatever the page already rendered (search rows, homepage JSON) — seeded, zero requests.
 *   2. One batched IStoreBrowseService/GetItems request per page (protobuf-encoded ids, up to
 *      MAX_BATCH per request). Returns Steam's `summary_filtered`: label, 0-9 score, integer
 *      percent, count.
 *
 * Caching is stale-while-revalidate with a short window: entries are "fresh" for FRESH_MS (matched
 * to the max-age Steam itself puts on this endpoint), shown-but-revalidated until STALE_MS, and
 * ignored after that. The persisted copy only exists to survive reloads and back/forward navigation.
 */

import { encodeGetItemsRequest } from './proto'

export type ReviewTone = 'positive' | 'mixed' | 'negative' | 'none'

export interface ReviewSummary {
  appid: number
  /** Steam's label verbatim: "Very Positive", "Mixed", "No user reviews", "3 user reviews", ... */
  label: string
  /** Steam's 0-9 score. 0 = Steam shows no score (fewer than 10 reviews). */
  score: number
  /** Steam's integer percent positive, or null when Steam gives none. */
  pct: number | null
  count: number
  tone: ReviewTone
  ts: number
}

const ext: typeof chrome = (globalThis as any).browser ?? chrome

export const FRESH_MS = 120_000 // Steam serves GetItems with cache-control: max-age=120
export const STALE_MS = 15 * 60_000
const NEG_MS = 10 * 60_000 // remember "Steam has no such item" for a while
const MAX_BATCH = 400
const DEBOUNCE_MS = 300
const CACHE_KEY = 'sro:cache:v2'

export function toneFor(score: number): ReviewTone {
  if (score >= 6) return 'positive' // Mostly Positive and up (Positive=7 sits between)
  if (score === 5) return 'mixed'
  if (score >= 1) return 'negative'
  return 'none'
}

export const LABEL_TO_SCORE: Record<string, number> = {
  'overwhelmingly positive': 9,
  'very positive': 8,
  positive: 7,
  'mostly positive': 6,
  mixed: 5,
  'mostly negative': 4,
  negative: 3,
  'very negative': 2,
  'overwhelmingly negative': 1,
}

/* ---------------- cache ---------------- */

const mem = new Map<number, ReviewSummary>()
const negative = new Map<number, number>() // appid -> ts
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

/** Seed from data the page already rendered. Never overrides a fresher entry. */
export function seed(s: Omit<ReviewSummary, 'ts' | 'tone'>, ts = Date.now()) {
  const cur = mem.get(s.appid)
  if (cur && cur.ts >= ts) return
  put({ ...s, tone: toneFor(s.score), ts })
}

/* ---------------- subscriptions + batching ---------------- */

type Listener = (s: ReviewSummary) => void
const listeners = new Map<number, Set<Listener>>()
const pending = new Set<number>()
const inflight = new Set<number>()
let flushTimer: number | undefined
let draining = false

/**
 * Ask for a summary. `cb` fires immediately with cached data (fresh or stale) if any, and again
 * whenever a newer summary arrives. Returns an unsubscribe function.
 */
export function subscribe(appid: number, cb: Listener): () => void {
  let set = listeners.get(appid)
  if (!set) listeners.set(appid, (set = new Set()))
  set.add(cb)
  void loadPersisted().then(() => {
    const cur = mem.get(appid)
    const age = cur ? Date.now() - cur.ts : Infinity
    if (cur && age < STALE_MS) cb(cur)
    if (age >= FRESH_MS) enqueue(appid)
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

async function fetchBatch(appids: number[]) {
  const wait = backoffUntil - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  const enc = encodeGetItemsRequest(appids, { country: 'US' })
  const url =
    'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?format=json&input_protobuf_encoded=' +
    encodeURIComponent(enc)
  const res = await fetch(url, { credentials: 'omit' })
  if (res.status === 429 || res.status >= 500) {
    backoffUntil = Date.now() + 10_000
    for (const id of appids) pending.add(id) // retry on next drain
    if (!flushTimer) flushTimer = window.setTimeout(() => void drain(), 10_000)
    return
  }
  if (!res.ok) return
  const json = (await res.json()) as {
    response?: {
      store_items?: {
        id?: number
        success?: number
        reviews?: {
          summary_filtered?: {
            review_count?: number
            percent_positive?: number
            review_score?: number
            review_score_label?: string
          }
        }
      }[]
    }
  }
  const now = Date.now()
  const seen = new Set<number>()
  for (const item of json.response?.store_items ?? []) {
    if (!item.id) continue
    seen.add(item.id)
    const sf = item.reviews?.summary_filtered
    if (item.success !== 1 || !sf) {
      negative.set(item.id, now)
      continue
    }
    const score = sf.review_score ?? 0
    put({
      appid: item.id,
      label: sf.review_score_label || (sf.review_count ? `${sf.review_count} user reviews` : 'No user reviews'),
      score,
      pct: score > 0 ? (sf.percent_positive ?? null) : null,
      count: sf.review_count ?? 0,
      tone: toneFor(score),
      ts: now,
    })
  }
  for (const id of appids) if (!seen.has(id)) negative.set(id, now)
}

export function formatTooltip(s: ReviewSummary): string {
  if (s.pct === null || !s.count) return s.label
  return `${s.label} — ${s.pct}% of the ${s.count.toLocaleString()} user reviews are positive`
}
