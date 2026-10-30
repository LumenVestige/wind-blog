export const uiFontOptions = [
  { value: 'inherit', label: '遵循正文' },
  { value: 'system', label: '系统字体' },
  { value: 'wenkai', label: '霞鹜文楷' },
] as const
export const englishFontOptions = [
  { value: 'maple', label: 'Maple Mono' },
  { value: 'wenkai-mono', label: '霞鹜文楷 Mono' },
  { value: 'inherit', label: '遵循正文（不额外替换）' },
] as const
export const codeFontOptions = [
  { value: 'maple', label: 'Maple Mono' },
  { value: 'wenkai-mono', label: '霞鹜文楷 Mono' },
  { value: 'system', label: '系统等宽字体' },
  { value: 'inherit', label: '遵循正文' },
] as const

export interface TypographySettings {
  wenkaiEnabled: boolean
  uiFont: typeof uiFontOptions[number]['value']
  englishFont: typeof englishFontOptions[number]['value']
  codeFont: typeof codeFontOptions[number]['value']
}

export const fontSettingOptions = { uiFont: uiFontOptions, englishFont: englishFontOptions, codeFont: codeFontOptions }
export const fontSettingKeys = { uiFont: 'ui_font', englishFont: 'english_font', codeFont: 'code_font' } as const
const systemFont = "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
const systemMono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

/** English overrides only prepend Latin families; UI and prose retain their own CJK face. */
export function typographyStyles(settings: TypographySettings) {
  const bodyBase = settings.wenkaiEnabled ? `'LXGW WenKai', ${systemFont}` : systemFont
  const uiBase = settings.uiFont === 'inherit' ? bodyBase
    : settings.uiFont === 'wenkai' ? `'LXGW WenKai', ${systemFont}` : systemFont
  const english = settings.englishFont === 'maple' ? "'Maple Mono', "
    : settings.englishFont === 'wenkai-mono' ? "'LXGW WenKai Mono Latin', " : ''
  const body = english + bodyBase
  const code = settings.codeFont === 'inherit' ? body
    : settings.codeFont === 'system' ? systemMono
    : settings.codeFont === 'wenkai-mono' ? `'LXGW WenKai Mono', ${systemMono}`
    : `'Maple Mono', ${bodyBase}`
  return { '--font-body': body, '--font-ui': english + uiBase, '--font-code': code }
}
