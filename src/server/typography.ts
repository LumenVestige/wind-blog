import { getSetting } from '@/lib/settings'
import { fontSettingKeys, fontSettingOptions, type TypographySettings } from '@/lib/typography'

export function typographySettings(): TypographySettings {
  const fonts: TypographySettings = {
    wenkaiEnabled: getSetting('wenkai_enabled', '0') === '1',
    uiFont: 'inherit',
    englishFont: 'maple',
    codeFont: 'maple',
  }
  for (const key of Object.keys(fontSettingKeys) as (keyof typeof fontSettingKeys)[]) {
    const stored = getSetting(fontSettingKeys[key])
    if (fontSettingOptions[key].some(option => option.value === stored))
      Object.assign(fonts, { [key]: stored })
  }
  return fonts
}
