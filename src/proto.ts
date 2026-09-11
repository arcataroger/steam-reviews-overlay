/**
 * Minimal protobuf encoder for IStoreBrowseService/GetItems requests.
 * No library: only varints and length-delimited fields are needed.
 *
 *   CStoreBrowse_GetItems_Request {
 *     repeated StoreItemID ids = 1;            // StoreItemID { uint32 appid = 1; }
 *     StoreBrowseContext context = 2;          // { string language = 1; string country_code = 3; }
 *     StoreBrowseItemDataRequest data_request = 3; // { bool include_reviews = 9; }
 *   }
 */

function varint(n: number): number[] {
  const out: number[] = []
  while (true) {
    const b = n & 0x7f
    n = Math.floor(n / 128)
    if (n) out.push(b | 0x80)
    else {
      out.push(b)
      return out
    }
  }
}
const field = (num: number, wt: number, payload: number[]) => [...varint((num << 3) | wt), ...payload]
const ld = (num: number, bytes: number[]) => field(num, 2, [...varint(bytes.length), ...bytes])
const str = (s: string) => [...new TextEncoder().encode(s)]

export function encodeGetItemsRequest(appids: number[], opts: { country?: string; language?: string } = {}): string {
  const body: number[] = []
  for (const id of appids) body.push(...ld(1, field(1, 0, varint(id))))
  const ctx: number[] = []
  if (opts.language) ctx.push(...ld(1, str(opts.language)))
  ctx.push(...ld(3, str(opts.country ?? 'US')))
  body.push(...ld(2, ctx))
  body.push(...ld(3, field(9, 0, varint(1)))) // include_reviews = true
  let bin = ''
  for (const b of body) bin += String.fromCharCode(b)
  return btoa(bin)
}

/* ---------------- decoding ---------------- */

/** Query marker on our own batch URLs so the background's webRequest listener ignores them. */
export const OWN_MARKER = 'sro=1'

export type Field = { f: number; wt: number; v: number | Uint8Array }

/** Generic wire-format walk of one message. */
export function decodeFields(buf: Uint8Array): Field[] {
  const out: Field[] = []
  let i = 0
  // Values above 2^53 lose precision; nothing we decode gets near that.
  const varint = (): number => {
    let n = 0
    let shift = 1
    while (true) {
      if (i >= buf.length) throw new Error('truncated varint')
      const b = buf[i++]
      n += (b & 0x7f) * shift
      if (!(b & 0x80)) return n
      shift *= 128
    }
  }
  while (i < buf.length) {
    const key = varint()
    const f = key >>> 3
    const wt = key & 7
    if (wt === 0) out.push({ f, wt, v: varint() })
    else if (wt === 2) {
      const len = varint()
      if (i + len > buf.length) throw new Error('truncated field')
      out.push({ f, wt, v: buf.subarray(i, i + len) })
      i += len
    } else if (wt === 5) i += 4
    else if (wt === 1) i += 8
    else throw new Error(`unsupported wire type ${wt}`)
  }
  return out
}

const num = (fields: Field[], f: number): number | undefined => {
  const x = fields.find((e) => e.f === f && e.wt === 0)
  return x ? (x.v as number) : undefined
}
const bytes = (fields: Field[], f: number): Uint8Array | undefined => {
  const x = fields.find((e) => e.f === f && e.wt === 2)
  return x ? (x.v as Uint8Array) : undefined
}
const text = (fields: Field[], f: number): string | undefined => {
  const b = bytes(fields, f)
  return b ? new TextDecoder().decode(b) : undefined
}

export interface RawSummary {
  review_count?: number
  percent_positive?: number
  review_score?: number
  review_score_label?: string
}
export interface DecodedItem {
  id: number
  success: number
  appid?: number
  item_type?: number
  summary_filtered?: RawSummary
  summary_language_specific?: RawSummary
}

function decodeSummary(buf: Uint8Array | undefined): RawSummary | undefined {
  if (!buf) return undefined
  const f = decodeFields(buf)
  return { review_count: num(f, 1), percent_positive: num(f, 2), review_score: num(f, 3), review_score_label: text(f, 4) }
}

/**
 * CStoreBrowse_GetItems_Response { repeated StoreItem store_items = 1; }
 * StoreItem { item_type = 1; id = 2; success = 3; appid = 9; StoreItem_Reviews reviews = 23; }
 * StoreItem_Reviews { summary_filtered = 1; summary_unfiltered = 2; summary_language_specific = 3; }
 * StoreReviewSummary { review_count = 1; percent_positive = 2; review_score = 3; review_score_label = 4; }
 */
export function decodeGetItemsResponse(buf: Uint8Array): DecodedItem[] {
  const items: DecodedItem[] = []
  for (const e of decodeFields(buf)) {
    if (e.f !== 1 || e.wt !== 2) continue
    const it = decodeFields(e.v as Uint8Array)
    const reviews = bytes(it, 23)
    const rf = reviews ? decodeFields(reviews) : []
    items.push({
      id: num(it, 2) ?? 0,
      success: num(it, 3) ?? 0,
      appid: num(it, 9),
      item_type: num(it, 1),
      summary_filtered: decodeSummary(bytes(rf, 1)),
      summary_language_specific: decodeSummary(bytes(rf, 3)),
    })
  }
  return items
}

/** Does this GetItems request URL ask for reviews (data_request.include_reviews = field 9)? */
export function requestIncludesReviews(url: string): boolean {
  try {
    const q = new URL(url).searchParams
    const ip = q.get('input_protobuf_encoded')
    if (ip) {
      const bin = atob(ip)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      const dr = bytes(decodeFields(buf), 3)
      return !!dr && num(decodeFields(dr), 9) === 1
    }
    const ij = q.get('input_json')
    if (ij) return !!JSON.parse(ij)?.data_request?.include_reviews
  } catch {
    /* ignore */
  }
  return false
}
