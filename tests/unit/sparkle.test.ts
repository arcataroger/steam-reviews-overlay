import { describe, it, expect } from 'vitest'
import { orbitPieces, LAP_SECONDS } from '../../src/sparkle'

const delays = (w: number, h: number) => orbitPieces(w, h).map((p) => Number(p.delay.slice(0, -1)))

describe('sparkle pieces', () => {
  it('spaces two lights half a lap apart', () => {
    const d = delays(400, 200)
    expect(d[0]).toBeCloseTo(0)
    expect(d[d.length / 2]).toBeCloseTo(-LAP_SECONDS / 2)
  })

  it('only ever uses negative delays, so no piece waits to appear', () => {
    for (const d of delays(946, 64)) {
      expect(d).toBeLessThanOrEqual(0)
      expect(d).toBeGreaterThan(-LAP_SECONDS)
    }
  })

  it('keeps a tail short of the next light on a small frame', () => {
    const pieces = orbitPieces(100, 60)
    const perLight = pieces.length / 2
    const tail = parseFloat(pieces[0].width) - 1
    expect(tail * perLight).toBeLessThan(320 / 2)
  })

  it('holds the tail at its full length on a large frame', () => {
    const pieces = orbitPieces(1200, 500)
    expect((parseFloat(pieces[0].width) - 1) * (pieces.length / 2)).toBeCloseTo(1000)
  })

  it('caps the pieces whatever the frame size', () => {
    expect(orbitPieces(3000, 2000)).toHaveLength(48)
  })

  it('starts the head white and ends the tail clear', () => {
    const pieces = orbitPieces(1200, 500)
    expect(pieces[0].background).toContain('#fff 100.0%')
    expect(pieces[pieces.length / 2 - 1].background).toContain(' 0.0%, transparent')
  })
})
