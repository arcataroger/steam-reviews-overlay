import { describe, it, expect } from 'vitest'
import { encodeGetItemsRequest, decodeFields, decodeGetItemsResponse, requestIncludesReviews } from '../../src/proto'

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, 'base64'))
}
// helpers to build a fake response body
const varint = (n: number): number[] => {
  const out: number[] = []
  while (true) {
    const b = n & 0x7f
    n = Math.floor(n / 128)
    if (n) out.push(b | 0x80)
    else return (out.push(b), out)
  }
}
const field = (num: number, wt: number, payload: number[]) => [...varint((num << 3) | wt), ...payload]
const ld = (num: number, bytes: number[]) => field(num, 2, [...varint(bytes.length), ...bytes])
const str = (s: string) => [...Buffer.from(s, 'utf8')]

describe('GetItems request encoding', () => {
  it('encodes ids, context and include_reviews the way Steam expects', () => {
    const enc = encodeGetItemsRequest([570, 1245620], { country: 'US', language: 'english' })
    const f = decodeFields(b64ToBytes(enc))
    const ids = f.filter((e) => e.f === 1).map((e) => decodeFields(e.v as Uint8Array)[0].v)
    expect(ids).toEqual([570, 1245620])
    const ctx = decodeFields(f.find((e) => e.f === 2)!.v as Uint8Array)
    expect(Buffer.from(ctx.find((e) => e.f === 1)!.v as Uint8Array).toString()).toBe('english')
    expect(Buffer.from(ctx.find((e) => e.f === 3)!.v as Uint8Array).toString()).toBe('US')
    const dr = decodeFields(f.find((e) => e.f === 3)!.v as Uint8Array)
    expect(dr.find((e) => e.f === 9)?.v).toBe(1)
  })

  it('detects whether a request URL asked for reviews', () => {
    const withReviews =
      'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_protobuf_encoded=' +
      encodeURIComponent(encodeGetItemsRequest([570]))
    expect(requestIncludesReviews(withReviews)).toBe(true)
    const noReviews = Buffer.from([...ld(1, field(1, 0, varint(570))), ...ld(3, field(1, 0, varint(1)))]).toString('base64')
    expect(requestIncludesReviews('https://x/?input_protobuf_encoded=' + encodeURIComponent(noReviews))).toBe(false)
    expect(requestIncludesReviews('https://x/?input_json=' + encodeURIComponent('{"data_request":{"include_reviews":true}}'))).toBe(true)
  })
})

describe('GetItems response decoding', () => {
  it('extracts both summaries per item', () => {
    const summary = (count: number, pct: number, score: number, label: string) =>
      [...field(1, 0, varint(count)), ...field(2, 0, varint(pct)), ...field(3, 0, varint(score)), ...ld(4, str(label))]
    const reviews = [...ld(1, summary(676997, 87, 8, 'Very Positive')), ...ld(3, summary(301095, 91, 8, 'Very Positive'))]
    const item = [
      ...field(1, 0, varint(0)), // item_type app
      ...field(2, 0, varint(230410)),
      ...field(3, 0, varint(1)),
      ...ld(6, str('Warframe')),
      ...field(9, 0, varint(230410)),
      ...ld(23, reviews),
    ]
    const body = Uint8Array.from([...ld(1, item), ...ld(1, [...field(2, 0, varint(999)), ...field(3, 0, varint(15))])])
    const items = decodeGetItemsResponse(body)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ id: 230410, appid: 230410, success: 1, item_type: 0 })
    expect(items[0].summary_filtered).toEqual({ review_count: 676997, percent_positive: 87, review_score: 8, review_score_label: 'Very Positive' })
    expect(items[0].summary_language_specific?.percent_positive).toBe(91)
    expect(items[1]).toMatchObject({ id: 999, success: 15 })
    expect(items[1].summary_filtered).toBeUndefined()
  })
})
