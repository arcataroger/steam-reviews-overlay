import { describe, it, expect } from 'vitest'
import { toneColorAt, NEGATIVE, MIXED, POSITIVE } from '../../src/tonecolor'

describe('lever gradient', () => {
  it("lands exactly on Steam's colors at the tier centers", () => {
    expect(toneColorAt(1)).toBe(NEGATIVE)
    expect(toneColorAt(4)).toBe(NEGATIVE)
    expect(toneColorAt(5)).toBe(MIXED)
    expect(toneColorAt(6)).toBe(POSITIVE)
    expect(toneColorAt(9)).toBe(POSITIVE)
  })
  it('blends between neighbouring tiers', () => {
    const mid = toneColorAt(4.5)
    expect(mid).not.toBe(NEGATIVE)
    expect(mid).not.toBe(MIXED)
    expect(mid).toMatch(/^#[0-9a-f]{6}$/)
  })
})
