import { describe, expect, it } from 'vitest'
import { paginationItems, parsePage, parsePageSize } from '@/lib/pagination'

describe('pagination navigation', () => {
  it('matches the reference first-page and middle-page windows', () => {
    expect(paginationItems(1, 337)).toEqual([1, 2, 3, 4, 5, 6, 'end-gap', 337])
    expect(paginationItems(6, 337)).toEqual([
      1,
      'start-gap',
      4,
      5,
      6,
      7,
      8,
      'end-gap',
      337,
    ])
    expect(paginationItems(337, 337)).toEqual([
      1,
      'start-gap',
      332,
      333,
      334,
      335,
      336,
      337,
    ])
  })
  it('keeps current and boundary pages reachable with no duplicates or single-page gaps', () => {
    for (let pages = 1; pages <= 100; pages++) {
      for (let page = 1; page <= pages; page++) {
        const items = paginationItems(page, pages)
        const numbers = items.filter(
          (value): value is number => typeof value === 'number',
        )
        expect(numbers[0]).toBe(1)
        expect(numbers.at(-1)).toBe(pages)
        expect(numbers).toContain(page)
        expect(new Set(numbers).size).toBe(numbers.length)
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
        expect(items.length).toBeLessThanOrEqual(9)
        for (let i = 1; i < numbers.length; i++)
          expect(numbers[i] - numbers[i - 1]).not.toBe(2)
      }
    }
  })
  it('rejects invalid URL values and only accepts supported page sizes', () => {
    for (const value of [null, '', -1, 0, 1.5, 'abc', Infinity, '1e99'])
      expect(parsePage(value)).toBe(1)
    expect(parsePage('337')).toBe(337)
    for (const value of [null, '', -1, 1.5, 999999, 'abc'])
      expect(parsePageSize(value)).toBe(10)
    for (const size of [10, 20, 50, 100])
      expect(parsePageSize(String(size))).toBe(size)
  })
})
