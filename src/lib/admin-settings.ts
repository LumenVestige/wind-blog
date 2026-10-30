export interface SettingsValues {
  general: {
    siteName: string
    displayName: string
    faviconUrl: string
    icpNumber: string
  }
  appearance: { colorScheme: 'system' | 'light' | 'dark'; subtitle: string; wenkaiEnabled: boolean }
  content: { homeIntroMd: string; aboutMd: string; friendsMd: string }
  social: { socialLinks: { type: string; url: string; label?: string }[] }
  interaction: { commentsEnabled: boolean; likesEnabled: boolean }
  storage: {
    bucket: string
    operator: string
    domain: string
    scheme: 'https' | 'http'
    apiHost: string
    uploadDir: string
    hasPassword: boolean
    password: string
    configured: boolean
    publicBaseUrl: string
  }
}
export type SettingsSection = keyof SettingsValues
export type SettingsSnapshot = {
  [S in SettingsSection]: { values: SettingsValues[S]; version: string }
}
export const settingsSections = [
  'general',
  'appearance',
  'content',
  'social',
  'interaction',
  'storage',
] as const
