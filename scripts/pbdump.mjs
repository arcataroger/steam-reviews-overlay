// Tiny protobuf wire decoder for dumping GetItems request bodies
export function decode(buf, depth = 0) {
  const out = []; let i = 0
  const varint = () => { let n = 0n, s = 0n; while (true) { const b = buf[i++]; n |= BigInt(b & 0x7f) << s; if (!(b & 0x80)) return n; s += 7n } }
  while (i < buf.length) {
    const key = Number(varint()); const f = key >> 3, wt = key & 7
    if (wt === 0) out.push([f, 'v', Number(varint())])
    else if (wt === 2) { const len = Number(varint()); const sub = buf.subarray(i, i + len); i += len
      let nested = null; try { if (len && !/[\x80-\xff]/.test(sub.toString('latin1').slice(0,1)) ) nested = decode(sub, depth+1) } catch {}
      out.push([f, 'ld', nested && nested.length ? nested : sub.toString('utf8')]) }
    else if (wt === 5) { out.push([f, 'f32']); i += 4 } else if (wt === 1) { out.push([f, 'f64']); i += 8 } else throw new Error('wt ' + wt)
  }
  return out
}
