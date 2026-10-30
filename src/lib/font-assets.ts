import maple from '@fontsource/maple-mono/package.json'
import wenkai from 'lxgw-wenkai-webfont/package.json'
import type { TypographySettings } from './typography'

export const mapleFontBase = `/fonts/maple-mono/${maple.version}`
export const wenkaiStylesheet = `/fonts/lxgw-wenkai/${wenkai.version}/style.css`
export const wenkaiMonoStylesheet = `/fonts/lxgw-wenkai/${wenkai.version}/mono.css`
export const wenkaiMonoLatinStylesheet = `/fonts/lxgw-wenkai/${wenkai.version}/mono-latin.css`

export interface DeferredFontAsset { href: string; selector?: string }

export function typographyAssets(settings: TypographySettings) {
  const deferred: DeferredFontAsset[] = []
  const criticalMaple = settings.englishFont === 'maple'
  if (settings.wenkaiEnabled || settings.uiFont === 'wenkai')
    deferred.push({ href: wenkaiStylesheet })
  if (settings.englishFont === 'wenkai-mono')
    deferred.push({ href: wenkaiMonoLatinStylesheet })
  if (settings.codeFont === 'maple' && !criticalMaple)
    deferred.push({ href: `${mapleFontBase}/style.css`, selector: 'pre, .font-mono' })
  if (settings.codeFont === 'wenkai-mono')
    deferred.push({ href: wenkaiMonoStylesheet, selector: 'pre, .font-mono' })
  return {
    stylesheet: criticalMaple ? `${mapleFontBase}/style.css` : null,
    preload: criticalMaple ? `${mapleFontBase}/files/maple-mono-latin-400-normal.woff2` : null,
    deferred,
  }
}
