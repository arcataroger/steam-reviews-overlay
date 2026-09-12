// @vitest-environment node
// The gate's self-test is only worth running if its lies are real lies. These check each
// falsification changes the claim it is meant to change and leaves cards it cannot lie about alone.
import { describe, it, expect } from 'vitest'
// @ts-expect-error - plain JS script, no declaration file
import { wrongTone, inventHighlight, flipAxis, panelToRow, dropHighlight, falsifyManifest, FALSIFICATIONS } from '../../scripts/lib/falsify.mjs'

const highlighted = { file: 'a.png', state: 'active', shape: 'row', axis: null, highlight: 'positive', color: '#66c0f4' }
const parked = { file: 'b.png', state: 'active', shape: null, axis: null, highlight: null, color: null }
const panel = { file: 'c.png', state: 'active', shape: 'panel', axis: 'x', highlight: 'positive', color: '#66c0f4' }

describe('each falsification lies about exactly one thing', () => {
  it('wrongTone swaps the colour and nothing else', () => {
    expect(wrongTone(highlighted)).toEqual({ ...highlighted, color: '#c85e2d' })
    expect(wrongTone(parked)).toBeNull() // nothing to lie about
  })
  it('inventHighlight claims a ring on a parked card only', () => {
    expect(inventHighlight(parked)).toMatchObject({ shape: 'row', highlight: 'positive', color: '#66c0f4' })
    expect(inventHighlight(highlighted)).toBeNull()
  })
  it('flipAxis turns side wings into top/bottom wings and back', () => {
    expect(flipAxis(panel).axis).toBe('y')
    expect(flipAxis({ ...panel, axis: 'y' }).axis).toBe('x')
    expect(flipAxis(highlighted)).toBeNull()
  })
  it('panelToRow claims four edges where two are drawn', () => {
    expect(panelToRow(panel)).toMatchObject({ shape: 'row', axis: null })
    expect(panelToRow(parked)).toBeNull()
  })
  it('dropHighlight claims a highlighted card is parked', () => {
    expect(dropHighlight(highlighted)).toMatchObject({ shape: null, highlight: null, color: null })
    expect(dropHighlight(parked)).toBeNull()
  })
})

describe('falsifyManifest', () => {
  const manifest = { pad: 12, cards: [highlighted, parked, panel, { ...highlighted, file: 'd.png', state: 'labels' }] }

  it('reports exactly the files it lied about', () => {
    const { falsified } = falsifyManifest(manifest, 'wrong-tone')
    expect(falsified).toEqual(['a.png', 'c.png'])
  })

  it('never touches the labels-state baselines, which are the reference the gate compares against', () => {
    const { manifest: lied } = falsifyManifest(manifest, 'drop-highlight')
    expect(lied.cards.find((c: { file: string }) => c.file === 'd.png')).toEqual(manifest.cards[3])
  })

  it('rejects an unknown falsification rather than silently testing nothing', () => {
    expect(() => falsifyManifest(manifest, 'nonsense')).toThrow(/unknown falsification/)
    expect(Object.keys(FALSIFICATIONS).length).toBe(5)
  })
})
