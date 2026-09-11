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
