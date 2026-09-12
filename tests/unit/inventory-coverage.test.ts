// @vitest-environment node
// The inventory's coverage verdict decides what a crawl reports as a gap. Deliberate exceptions are
// recorded with a budget so they stop being re-reported; the budget only helps if going over it
// brings the kind back. These tests pin both halves of that.
import { describe, it, expect } from 'vitest'
// @ts-expect-error - plain JS script, no declaration file
import { verdict } from '../../scripts/inventory-merge.mjs'

const kind = (over: Record<string, unknown> = {}) => ({
  key: 'a.sale_capsule',
  count: 100,
  ours: { 'same|shape=card|badge=sro-badge sro-corner': 100 },
  sizes: { '340x200': 100 },
  features: { img: { true: 100 } },
  noBadgeNonNative: 0,
  ...over,
})

const expectations = { 'a.sale_capsule': { reason: 'package capsules share these shelves', unclaimed: 6 } }

describe('coverage verdict', () => {
  it('is covered when every card is claimed on its own element with a label', () => {
    expect(verdict(kind(), {}).status).toBe('covered')
  })

  it('is partial when some cards are unclaimed and nothing explains it', () => {
    const v = verdict(kind({ ours: { 'same|shape=card|badge=sro-badge sro-corner': 97, 'unclaimed|shape=null|badge=null': 3 } }), {})
    expect(v.status).toBe('partial')
    expect(v.notes.join(' ')).toContain('3/100 unclaimed')
  })

  it('is by-design when the unclaimed count is within the recorded budget', () => {
    const v = verdict(kind({ ours: { 'same|shape=card|badge=sro-badge sro-corner': 97, 'unclaimed|shape=null|badge=null': 3 } }), expectations)
    expect(v.status).toBe('by-design')
    expect(v.notes.join(' ')).toContain('package capsules share these shelves')
  })

  it('goes back to partial when the budget is exceeded, so a regression cannot hide behind it', () => {
    const v = verdict(kind({ ours: { 'same|shape=card|badge=sro-badge sro-corner': 60, 'unclaimed|shape=null|badge=null': 40 } }), expectations)
    expect(v.status).toBe('partial')
    expect(v.notes.join(' ')).toContain('expected at most 6')
  })

  it('never excuses a card claimed on a different element, however generous the budget', () => {
    // Climbing onto a container is a rendering bug, not a deliberate omission.
    const v = verdict(kind({ ours: { 'same|shape=card|badge=sro-badge sro-corner': 97, 'other:div.shelf|shape=row|badge=none': 3 } }), expectations)
    expect(v.status).toBe('partial')
    expect(v.notes.join(' ')).toContain('claimed on a different element')
  })

  it('is a gap when nothing in the kind is claimed and no exception is recorded', () => {
    expect(verdict(kind({ ours: { 'unclaimed|shape=null|badge=null': 100 } }), {}).status).toBe('gap')
  })
})
