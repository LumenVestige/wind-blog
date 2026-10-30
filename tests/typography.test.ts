import { describe, expect, it } from 'vitest'
import { typographyStyles, type TypographySettings } from '@/lib/typography'
import { typographyAssets, mapleFontBase, wenkaiStylesheet, wenkaiMonoStylesheet, wenkaiMonoLatinStylesheet } from '@/lib/font-assets'

const defaults: TypographySettings = { wenkaiEnabled: false, uiFont: 'inherit', englishFont: 'maple', codeFont: 'maple' }

describe('independent typography', () => {
  it('keeps WenKai prose, system UI and code independent when English follows the text', () => {
    const style = typographyStyles({ ...defaults, wenkaiEnabled: true, uiFont: 'system', englishFont: 'inherit', codeFont: 'wenkai-mono' })
    expect(style['--font-body']).toContain("'LXGW WenKai'")
    expect(style['--font-ui']).not.toContain('WenKai')
    expect(style['--font-code']).toContain("'LXGW WenKai Mono'")
    expect(Object.values(style).join(' ')).not.toContain('Maple')
  })
  it('allows WenKai UI with system prose and restricts the English override to its Latin alias', () => {
    const style = typographyStyles({ ...defaults, uiFont: 'wenkai', englishFont: 'wenkai-mono', codeFont: 'system' })
    expect(style['--font-body']).toContain("'LXGW WenKai Mono Latin'")
    expect(style['--font-body']).not.toContain("'LXGW WenKai',")
    expect(style['--font-ui']).toContain("'LXGW WenKai',")
    expect(style['--font-code']).toMatch(/^ui-monospace/)
    expect(style['--font-code']).not.toContain('WenKai')
  })
  it('inherits the final prose stack only when explicitly selected', () => {
    const style = typographyStyles({ ...defaults, wenkaiEnabled: true, codeFont: 'inherit' })
    expect(style['--font-body']).toBe(style['--font-ui'])
    expect(style['--font-code']).toBe(style['--font-body'])
  })
})

describe('font resource planning', () => {
  it('does not request or preload any custom fonts when all choices use the system', () => {
    expect(typographyAssets({ ...defaults, uiFont: 'system', englishFont: 'inherit', codeFont: 'system' }))
      .toEqual({ stylesheet: null, preload: null, deferred: [] })
  })
  it('preloads only the regular Maple face when used outside code', () => {
    const assets = typographyAssets(defaults)
    expect(assets.preload).toBe(`${mapleFontBase}/files/maple-mono-latin-400-normal.woff2`)
    expect(assets.stylesheet).toBe(`${mapleFontBase}/style.css`)
    expect(assets.deferred).toEqual([])
  })
  it('defers code-only fonts until a code block or source editor approaches the viewport', () => {
    const maple = typographyAssets({ ...defaults, englishFont: 'inherit' })
    expect(maple.preload).toBeNull()
    expect(maple.stylesheet).toBeNull()
    expect(maple.deferred).toEqual([{ href: `${mapleFontBase}/style.css`, selector: 'pre, .font-mono' }])
    const mono = typographyAssets({ ...defaults, englishFont: 'inherit', codeFont: 'wenkai-mono' })
    expect(mono.deferred).toEqual([{ href: wenkaiMonoStylesheet, selector: 'pre, .font-mono' }])
  })
  it('loads proportional WenKai and the English Mono alias separately and without duplicates', () => {
    const assets = typographyAssets({ ...defaults, wenkaiEnabled: true, uiFont: 'wenkai', englishFont: 'wenkai-mono', codeFont: 'wenkai-mono' })
    expect(assets.preload).toBeNull()
    expect(assets.deferred).toEqual([
      { href: wenkaiStylesheet }, { href: wenkaiMonoLatinStylesheet },
      { href: wenkaiMonoStylesheet, selector: 'pre, .font-mono' },
    ])
  })
})
