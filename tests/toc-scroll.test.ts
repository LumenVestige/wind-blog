import { describe, expect, it, vi } from 'vitest'
import { readingHeadingIds, scrollTocItemIntoView } from '@/lib/toc-scroll'

function outline({
  height = 200,
  scrollHeight = 800,
  top = 80,
  scrollTop = 100,
} = {}) {
  return {
    clientHeight: height,
    scrollHeight,
    clientTop: 1,
    scrollTop,
    getBoundingClientRect: () => ({ top }),
    scrollIntoView: vi.fn(() => {
      throw new Error('Must not scroll the page')
    }),
  } as unknown as HTMLElement
}

const entry = (top: number, bottom: number) =>
  ({
    getBoundingClientRect: () => ({ top, bottom }),
    scrollIntoView: vi.fn(() => {
      throw new Error('Must not scroll ancestors')
    }),
  }) as unknown as HTMLElement

describe('outline scroll isolation', () => {
  it('does not move a short outline even when its active link is off screen', () => {
    const card = outline({ scrollHeight: 200, top: -500 })
    scrollTocItemIntoView(card, entry(-450, -420))
    expect(card.scrollTop).toBe(100)
  })

  it('centers an entry below the visible area by scrolling only the outline', () => {
    const card = outline()
    scrollTocItemIntoView(card, entry(300, 330))
    expect(card.scrollTop).toBe(234)
  })

  it('reveals an entry above the visible area', () => {
    const card = outline()
    scrollTocItemIntoView(card, entry(40, 70))
    expect(card.scrollTop).toBe(0)
  })

  it('recenters before a visible entry reaches either edge', () => {
    const card = outline({ scrollTop: 300 })
    scrollTocItemIntoView(card, entry(100, 130))
    expect(card.scrollTop).toBe(234)
    const lower = outline({ scrollTop: 300 })
    scrollTocItemIntoView(lower, entry(240, 270))
    expect(lower.scrollTop).toBe(374)
  })

  it('clamps to the scroll limits at the beginning and end', () => {
    const first = outline({ scrollTop: 0 })
    scrollTocItemIntoView(first, entry(100, 130))
    expect(first.scrollTop).toBe(0)
    const last = outline({ scrollTop: 600 })
    scrollTocItemIntoView(last, entry(240, 270))
    expect(last.scrollTop).toBe(600)
  })

  it('leaves central entries and hidden mobile outlines alone', () => {
    const card = outline()
    scrollTocItemIntoView(card, entry(170, 200))
    expect(card.scrollTop).toBe(100)
    const hidden = outline({ height: 0 })
    scrollTocItemIntoView(hidden, entry(300, 330))
    expect(hidden.scrollTop).toBe(100)
  })
})

describe('visible reading range', () => {
  const headings = [
    { id: 'a', top: -300 },
    { id: 'b', top: 40 },
    { id: 'c', top: 240 },
    { id: 'd', top: 500 },
    { id: 'e', top: 950 },
  ]

  it('groups the section crossing the navigation line with visible headings', () => {
    expect(readingHeadingIds(headings, 80, 900)).toEqual({
      activeId: 'b',
      ids: ['b', 'c', 'd'],
    })
  })

  it('keeps the current section highlighted when no new heading is visible', () => {
    expect(
      readingHeadingIds(
        [
          { id: 'a', top: -200 },
          { id: 'b', top: 1200 },
        ],
        80,
        900,
      ),
    ).toEqual({ activeId: 'a', ids: ['a'] })
  })

  it('handles the start, end, and articles without headings', () => {
    expect(readingHeadingIds([{ id: 'a', top: 300 }], 80, 900)).toEqual({
      activeId: 'a',
      ids: ['a'],
    })
    expect(readingHeadingIds(headings, 80, 900, true)?.activeId).toBe('e')
    expect(readingHeadingIds([], 80, 900)).toBeNull()
  })
})
