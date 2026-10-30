import { beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { wenkaiStylesheet, wenkaiMonoStylesheet, wenkaiMonoLatinStylesheet } from '@/lib/font-assets'

const root = path.resolve(__dirname, '..')
const source = (url: string) => path.join(root, 'public', url)
const sheet = (url: string) => readFileSync(source(url), 'utf8')

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/prepare-fonts.mjs'], { cwd: root })
})

describe('generated font subsets', () => {
  it('provides complete ASCII coverage without Chinese in the English Mono alias', () => {
    const css = sheet(wenkaiMonoLatinStylesheet)
    expect(css).toContain("font-family: 'LXGW WenKai Mono Latin'")
    const ascii = new Set<number>()
    for (const [, ranges] of css.matchAll(/unicode-range:\s*([^;}]+)/g)) {
      for (const range of ranges.split(',')) {
        const [start, end = start] = range.trim().slice(2).split('-').map(value => parseInt(value, 16))
        expect(end).toBeLessThan(0x3000)
        for (let code = start; code <= Math.min(end, 126); code++) ascii.add(code)
      }
    }
    for (let code = 32; code <= 126; code++) expect(ascii.has(code), `ASCII ${code}`).toBe(true)
  })
  it('retains the full Mono face for Chinese code comments and regular/bold weights', () => {
    const css = sheet(wenkaiMonoStylesheet)
    expect(css).toContain("font-family: 'LXGW WenKai Mono'")
    expect(css).toMatch(/U\+4e[0-9a-f]/)
    expect(css).toContain('font-weight: 400')
    expect(css).toContain('font-weight: 700')
  })
  it('ships valid font files and swap declarations for every generated face', () => {
    for (const url of [wenkaiStylesheet, wenkaiMonoStylesheet, wenkaiMonoLatinStylesheet]) {
      const css = sheet(url)
      const faceCount = (css.match(/@font-face/g) || []).length
      expect(faceCount).toBeGreaterThan(0)
      expect((css.match(/font-display: swap/g) || []).length).toBe(faceCount)
      expect((css.match(/\{/g) || []).length).toBe(faceCount)
      expect((css.match(/\}/g) || []).length).toBe(faceCount)
      for (const [, file] of css.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g)) {
        const bytes = readFileSync(path.join(path.dirname(source(url)), file))
        expect(bytes.subarray(0, 4).toString()).toBe('wOF2')
      }
    }
  })
})
