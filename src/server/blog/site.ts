import { get, parseJson, run, toBool } from '@/db'
import { ApiError } from '@/lib/api'
import { isoToUnix } from '@/lib/utils'
import { getSetting, setSetting } from '@/lib/settings'
import { expandUrl } from '../images'

export type ThemeId = 'mizuki' | 'chirpy' | 'simple'
export type ColorScheme = 'light' | 'dark' | 'system'

export interface SocialLink {
  type: string
  url: string
  label?: string
}

export interface SiteConfigRow {
  id: number
  user_id: number
  theme_id: string
  color_scheme: string
  subtitle: string
  social_links: string
  about_md: string
  home_intro_md: string
  friends_md: string
  activated_at: string | null
  agreement_version: string
  agreement_accepted_at: string | null
  image_upload_enabled: number
  email_notify_enabled: number
  email_notify_strategy: string
  created_at: string
  updated_at: string
}

const THEMES: ThemeId[] = ['mizuki', 'chirpy', 'simple']

function normalizeTheme(v: unknown, fallback: ThemeId = 'mizuki'): ThemeId {
  const s = String(v || '')
  return (THEMES as string[]).includes(s) ? (s as ThemeId) : fallback
}

function normalizeScheme(v: unknown, fallback: ColorScheme = 'system'): ColorScheme {
  const s = String(v || '')
  return s === 'light' || s === 'dark' || s === 'system' ? s : fallback
}

function normalizeSocialLinks(v: unknown): SocialLink[] {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item || {}) as Record<string, unknown>
      return {
        type: String(o.type || '').trim(),
        url: String(o.url || '').trim(),
        label: o.label ? String(o.label) : undefined,
      }
    })
    .filter((s) => s.type && /^(https?:\/\/|mailto:|tel:)/i.test(s.url) && !/[\x00-\x20]/.test(s.url)).slice(0, 50)
}

export function ensureSiteConfig(userId: number): SiteConfigRow {
  const existing = get<SiteConfigRow>(
    'SELECT * FROM blog_site_configs WHERE user_id = ?',
    userId,
  )
  if (existing) return existing
  run('INSERT OR IGNORE INTO blog_site_configs (user_id) VALUES (?)', userId)
  return get<SiteConfigRow>(
    'SELECT * FROM blog_site_configs WHERE user_id = ?',
    userId,
  )!
}

export function siteConfigData(row: SiteConfigRow) {
  return {
    themeId: row.theme_id as ThemeId,
    colorScheme: row.color_scheme as ColorScheme,
    subtitle: row.subtitle,
    socialLinks: normalizeSocialLinks(parseJson(row.social_links, [])),
    aboutMd: row.about_md,
    homeIntroMd: row.home_intro_md,
    friendsMd: row.friends_md,
    activated: !!row.activated_at,
    activatedAt: isoToUnix(row.activated_at),
    agreementVersion: row.agreement_version,
    agreementAcceptedAt: isoToUnix(row.agreement_accepted_at),
    imageUploadEnabled: toBool(row.image_upload_enabled),
    emailNotifyEnabled: toBool(row.email_notify_enabled),
    emailNotifyStrategy: row.email_notify_strategy,
  }
}

export function themeStatus(username?: string, viewerId = 0) {
  let userId = viewerId
  if (username) {
    const u = get<{ id: number }>(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
      username,
    )
    if (!u) throw new ApiError('用户不存在', 1, 404)
    userId = u.id
  }
  if (!userId) throw new ApiError('缺少用户', 1, 400)
  const row = ensureSiteConfig(userId)
  return {
    enabled: !!row.activated_at,
    ...siteConfigData(row),
  }
}

export interface ThemeConfigReq {
  themeId?: string
  colorScheme?: string
  subtitle?: string
  socialLinks?: unknown
  aboutMd?: string | null
  homeIntroMd?: string | null
  friendsMd?: string | null
}

export function saveThemeConfig(userId: number, req: ThemeConfigReq) {
  const row = ensureSiteConfig(userId)
  if (!row.activated_at) throw new ApiError('请先开通博客', 1, 403)
  const themeId = req.themeId !== undefined ? normalizeTheme(req.themeId) : normalizeTheme(row.theme_id)
  const colorScheme =
    req.colorScheme !== undefined ? normalizeScheme(req.colorScheme) : normalizeScheme(row.color_scheme)
  const subtitle = req.subtitle !== undefined ? String(req.subtitle).slice(0, 200) : row.subtitle
  const socialLinks =
    req.socialLinks !== undefined
      ? normalizeSocialLinks(req.socialLinks)
      : normalizeSocialLinks(parseJson(row.social_links, []))
  // null/undefined = keep; '' = clear
  const aboutMd = req.aboutMd === undefined || req.aboutMd === null ? row.about_md : String(req.aboutMd)
  const homeIntroMd =
    req.homeIntroMd === undefined || req.homeIntroMd === null ? row.home_intro_md : String(req.homeIntroMd)
  const friendsMd =
    req.friendsMd === undefined || req.friendsMd === null ? row.friends_md : String(req.friendsMd)
  run(
    `UPDATE blog_site_configs SET theme_id = ?, color_scheme = ?, subtitle = ?, social_links = ?,
       about_md = ?, home_intro_md = ?, friends_md = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
    themeId,
    colorScheme,
    subtitle,
    JSON.stringify(socialLinks),
    aboutMd,
    homeIntroMd,
    friendsMd,
    userId,
  )
  return siteConfigData(ensureSiteConfig(userId))
}

export function activationStatus(userId: number) {
  const row = ensureSiteConfig(userId)
  return {
    activated: !!row.activated_at,
    agreementVersion: row.agreement_version || getSetting('agreement_version'),
    needAgreement: !row.agreement_accepted_at,
    emailNotifyEnabled: toBool(row.email_notify_enabled),
    emailNotifyStrategy: row.email_notify_strategy,
    signedAgreementVersion: row.agreement_version,
    agreementAcceptedAt: isoToUnix(row.agreement_accepted_at),
    activatedAt: isoToUnix(row.activated_at),
    themeId: row.theme_id,
    subtitle: row.subtitle,
    imageUploadEnabled: toBool(row.image_upload_enabled),
  }
}

export function agreementGet(userId: number) {
  const status = activationStatus(userId)
  return {
    ...status,
    title: getSetting('agreement_title', 'Wind Blog 开通协议'),
    content: getSetting('agreement_content', ''),
  }
}

export function activate(
  userId: number,
  opt: {
    accept: boolean
    agreementVersion?: string
    emailNotifyEnabled?: boolean
    emailNotifyStrategy?: string
  },
) {
  if (!opt.accept) throw new ApiError('不同意协议无法开通', 1, 400)
  const row = ensureSiteConfig(userId)
  const version = opt.agreementVersion || getSetting('agreement_version') || 'v1-cn-2026'
  const notifyEnabled =
    opt.emailNotifyEnabled === undefined ? toBool(row.email_notify_enabled) : !!opt.emailNotifyEnabled
  const notifyStrategy =
    opt.emailNotifyStrategy || row.email_notify_strategy || 'off'
  run(
    `UPDATE blog_site_configs SET
       activated_at = COALESCE(activated_at, datetime('now')),
       agreement_version = ?, agreement_accepted_at = datetime('now'),
       email_notify_enabled = ?, email_notify_strategy = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
    version,
    notifyEnabled ? 1 : 0,
    notifyStrategy,
    userId,
  )
  return activationStatus(userId)
}

export function notifyPref(
  userId: number,
  opt: { emailNotifyEnabled?: boolean; emailNotifyStrategy?: string },
) {
  const row = ensureSiteConfig(userId)
  const enabled =
    opt.emailNotifyEnabled === undefined ? toBool(row.email_notify_enabled) : !!opt.emailNotifyEnabled
  const strategy = opt.emailNotifyStrategy || row.email_notify_strategy || 'off'
  run(
    'UPDATE blog_site_configs SET email_notify_enabled = ?, email_notify_strategy = ?, updated_at = datetime(\'now\') WHERE user_id = ?',
    enabled ? 1 : 0,
    strategy,
    userId,
  )
  return { emailNotifyEnabled: enabled, emailNotifyStrategy: strategy }
}

export function setImageUploadEnabled(userId: number, enabled: boolean) {
  ensureSiteConfig(userId)
  run(
    "UPDATE blog_site_configs SET image_upload_enabled = ?, updated_at = datetime('now') WHERE user_id = ?",
    enabled ? 1 : 0,
    userId,
  )
}

export { setSetting }
