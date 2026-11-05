// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { thumbsFor, thumbIcons } from '../../src/thumb'

describe('thumbs for a review score', () => {
  it('counts up from Positive and down from Negative', () => {
    expect(thumbsFor(9)).toEqual({ dir: 'up', count: 3 })
    expect(thumbsFor(8)).toEqual({ dir: 'up', count: 2 })
    expect(thumbsFor(7)).toEqual({ dir: 'up', count: 1 })
    expect(thumbsFor(3)).toEqual({ dir: 'down', count: 1 })
    expect(thumbsFor(2)).toEqual({ dir: 'down', count: 2 })
    expect(thumbsFor(1)).toEqual({ dir: 'down', count: 3 })
  })

  it('gives the Mostly tiers one thumb, and Mixed its own mark', () => {
    expect(thumbsFor(6)).toEqual({ dir: 'up', count: 1 })
    expect(thumbsFor(4)).toEqual({ dir: 'down', count: 1 })
    expect(thumbsFor(5).dir).toBe('mixed')
  })

  it('draws one icon per thumb, and a lone tilde for Mixed', () => {
    expect(thumbIcons(9)).toHaveLength(3)
    const [mixed] = thumbIcons(5)
    expect(mixed.querySelectorAll('g')).toHaveLength(0)
    expect(mixed.querySelector('.sro-thumb-tilde')).not.toBeNull()
  })

  it('flips a thumb down, leaving a thumb up as drawn', () => {
    expect(thumbIcons(1)[0].querySelector('g')?.getAttribute('transform')).toContain('scale(1 -1)')
    expect(thumbIcons(9)[0].querySelector('g')?.getAttribute('transform')).toBe('')
  })
})
