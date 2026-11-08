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

describe('frame swatches are notches on the hue slider', async () => {
  const t = await import('../../src/tonecolor')

  it('runs red, orange, yellow, green, blue, indigo, violet, pink, with Steam blue and orange as named', () => {
    expect(t.FRAME_NOTCHES.map((n) => n.name)).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'pink'])
    expect(t.FRAME_NOTCHES[4].color).toBe(t.POSITIVE)
  })

  it('gives every swatch its own notch, and a drag onto it the exact swatch color', () => {
    for (const [i, n] of t.FRAME_NOTCHES.entries()) {
      expect(t.colorToSlider(n.color)).toBe(i * t.NOTCH_SPAN)
      for (const d of [-4, 0, 4]) {
        const v = i * t.NOTCH_SPAN + d
        if (v >= 0 && v <= t.SLIDER_MAX) expect(t.sliderToColor(v)).toBe(n.color)
      }
    }
    expect(t.SLIDER_MAX).toBe(7 * t.NOTCH_SPAN) // pink closes the slider, one span past violet
  })

  it('leaves the notches for colors between them, in hue order', () => {
    expect(t.notchAt(150)).toBeUndefined()
    expect(t.FRAME_NOTCHES.some((n) => n.color === t.sliderToColor(150))).toBe(false)
    let last = -1
    for (let v = 0; v < t.SLIDER_MAX; v += 10) {
      const h = t.sliderToHue(v)
      expect(h).toBeGreaterThan(last)
      last = h
      expect(Math.abs(t.hueToSlider(h) - v)).toBeLessThanOrEqual(1)
    }
  })

  it('tells the slider colors from a custom pick', () => {
    for (let v = 0; v <= t.SLIDER_MAX; v += 7) expect(t.onSlider(t.sliderToColor(v))).toBe(true)
    expect(t.onSlider('#ff0000')).toBe(false)
    expect(t.onSlider('#ffffff')).toBe(false)
    expect(t.onSlider('#f6556a')).toBe(false) // past pink, toward red
  })

  it('puts an off-notch color back where the slider made it', () => {
    const c = t.sliderToColor(640)
    expect(Math.abs(t.colorToSlider(c) - 640)).toBeLessThanOrEqual(3)
  })
})
