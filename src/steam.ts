/**
 * Fetches review summaries from Steam's public (no key) endpoint:
 *   https://store.steampowered.com/appreviews/<appid>?json=1&language=all&purchase_type=all&num_per_page=0
 * Results are cached in extension storage with a TTL, and requests are
 * throttled so a page full of cards doesn't hammer Steam.
 */

export type ReviewTone = 'positive' | 'mixed' | 'negative' | 'none'

export interface ReviewSummary {
  appid: number
  /** e.g. "Very Positive", "Mixed", "No user reviews", "3 user reviews" */
  desc: string
  /** Steam's 0-9 score (9 = Overwhelmingly Positive, 5 = Mixed, 1 = Overwhelmingly Negative, 0 = none) */
  score: number
  total: number
  positive: number
  negative: number
  tone: ReviewTone
  /** fetch timestamp, ms */
  ts: number
}

const ext: typeof chrome = (globalThis as any).browser ?? chrome

const CACHE_KEY = 'sro:cache:v1'
const TTL_MS = 24 * 60 * 60 * 1000
const CONCURRENCY = 4
const MIN_GAP_MS = 120 // between request starts, per worker

let memCache: Map<number, ReviewSummary> | null = null
let loadPromise: Promise<Map<number, ReviewSummary>> | null = null
let dirty = false
let persistTimer: number | undefined

async function loadCache(): Promise<Map<number, ReviewSummary>> {
  if (memCache) return memCache
  if (!loadPromise) {
    loadPromise = (async () => {
      const map = new Map<number, ReviewSummary>()
      try {
        const res = await ext.storage.local.get(CACHE_KEY)
        const stored = res?.[CACHE_KEY] as Record<string, ReviewSummary> | undefined
        const now = Date.now()
        if (stored) {
          for (const [k, v] of Object.entries(stored)) {
            if (v && now - v.ts < TTL_MS) map.set(Number(k), v)
          }
        }
      } catch (e) {
        console.warn('[SRO] cache load failed', e)
      }
      memCache = map
      return map
    })()
  }
  return loadPromise
}

function schedulePersist() {
  dirty = true
  if (persistTimer) return
  persistTimer = window.setTimeout(async () => {
    persistTimer = undefined
    if (!dirty || !memCache) return
    dirty = false
    const obj: Record<string, ReviewSummary> = {}
    for (const [k, v] of memCache) obj[k] = v
    try {
      await ext.storage.local.set({ [CACHE_KEY]: obj })
    } catch (e) {
      console.warn('[SRO] cache persist failed', e)
    }
  }, 1500)
}

export function toneFor(desc: string, score: number): ReviewTone {
  const d = desc.toLowerCase()
  if (d.includes('positive')) return 'positive'
  if (d.includes('mixed')) return 'mixed'
  if (d.includes('negative')) return 'negative'
  if (score >= 6) return 'positive'
  if (score === 5) return 'mixed'
  if (score >= 1) return 'negative'
  return 'none'
}

interface QueueItem {
  appid: number
  resolve: (s: ReviewSummary | null) => void
}

const queue: QueueItem[] = []
const inflight = new Map<number, Promise<ReviewSummary | null>>()
let activeWorkers = 0
let backoffUntil = 0

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchOne(appid: number): Promise<ReviewSummary | null> {
  const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all&num_per_page=0`
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = backoffUntil - Date.now()
    if (wait > 0) await sleep(wait)
    let res: Response
    try {
      res = await fetch(url, { credentials: 'omit' })
    } catch (e) {
      await sleep(1000 * (attempt + 1))
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      backoffUntil = Date.now() + 5000 * (attempt + 1)
      continue
    }
    if (!res.ok) return null
    const json = (await res.json()) as {
      success?: number
      query_summary?: {
        review_score?: number
        review_score_desc?: string
        total_positive?: number
        total_negative?: number
        total_reviews?: number
      }
    }
    if (!json || json.success !== 1 || !json.query_summary) return null
    const q = json.query_summary
    const desc = q.review_score_desc ?? 'No user reviews'
    const score = q.review_score ?? 0
    return {
      appid,
      desc,
      score,
      total: q.total_reviews ?? 0,
      positive: q.total_positive ?? 0,
      negative: q.total_negative ?? 0,
      tone: toneFor(desc, score),
      ts: Date.now(),
    }
  }
  return null
}

async function worker() {
  activeWorkers++
  try {
    while (queue.length) {
      // LIFO-ish: most recently requested (likely just scrolled into view) first
      const item = queue.pop()!
      const summary = await fetchOne(item.appid)
      if (summary && memCache) {
        memCache.set(item.appid, summary)
        schedulePersist()
      }
      item.resolve(summary)
      await sleep(MIN_GAP_MS)
    }
  } finally {
    activeWorkers--
  }
}

/** Get a summary, from cache if fresh, otherwise via the throttled queue. */
export async function getReviewSummary(appid: number): Promise<ReviewSummary | null> {
  const cache = await loadCache()
  const hit = cache.get(appid)
  if (hit) return hit
  const existing = inflight.get(appid)
  if (existing) return existing
  const p = new Promise<ReviewSummary | null>((resolve) => {
    queue.push({ appid, resolve })
    while (activeWorkers < CONCURRENCY && activeWorkers < queue.length) void worker()
  }).finally(() => inflight.delete(appid))
  inflight.set(appid, p)
  return p
}

/** Synchronous cache peek (only useful after the cache has loaded once). */
export function peekCached(appid: number): ReviewSummary | undefined {
  return memCache?.get(appid)
}

export function formatTooltip(s: ReviewSummary): string {
  if (!s.total) return s.desc
  const pct = Math.round((s.positive / s.total) * 100)
  return `${s.desc} — ${pct}% of ${s.total.toLocaleString()} user reviews are positive`
}
