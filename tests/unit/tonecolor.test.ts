import { describe, it, expect } from 'vitest'
import { toneColorAt, NEGATIVE, MIXED, POSITIVE, hueToHex, hexToHue } from '../../src/tonecolor'

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

describe('hue slider colors', () => {
  it('lands the primaries on their hues', () => {
    expect(hexToHue('#ff0000')).toBe(0)
    expect(hexToHue('#00ff00')).toBe(120)
    expect(hexToHue('#0000ff')).toBe(240)
    expect(hexToHue('#808080')).toBe(0)
  })

  it('round-trips, so the slider stays put under a color it set', () => {
    for (let h = 0; h < 360; h += 7) expect(Math.abs(hexToHue(hueToHex(h)) - h)).toBeLessThanOrEqual(1)
  })
})
