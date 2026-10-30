import { createHash } from 'node:crypto'
import { get, run, transaction } from '@/db'
import { ApiError } from '@/lib/api'
import { getSetting, setSettings, upyunStatus, saveUpyun } from '@/lib/settings'
import {
  ensureSiteConfig,
  siteConfigData,
  saveThemeConfig,
} from '@/server/blog/site'
import {
  settingsSections,
  type SettingsSection,
  type SettingsSnapshot,
  type SettingsValues,
} from '@/lib/admin-settings'
import { navigationArticleIds, saveNavigationArticles } from '@/server/blog/navigation'
import { typographySettings } from '@/server/typography'
import { fontSettingKeys, fontSettingOptions } from '@/lib/typography'

function version(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function manageSettingsSnapshot(userId: number): SettingsSnapshot {
  const config = siteConfigData(ensureSiteConfig(userId))
  const owner = get<{ name: string }>(
    'SELECT name FROM users WHERE id = ?',
    userId,
  )!
  const values: SettingsValues = {
    general: {
      siteName: getSetting('site_name', 'Wind Blog'),
      displayName: owner.name,
      faviconUrl: getSetting('favicon_url'),
      icpNumber: getSetting('icp_number'),
    },
    appearance: {
      colorScheme: config.colorScheme,
      subtitle: config.subtitle,
      ...typographySettings(),
    },
    content: navigationArticleIds(userId),
    social: { socialLinks: config.socialLinks },
    interaction: {
      commentsEnabled: getSetting('comments_enabled', '1') === '1',
      likesEnabled: getSetting('likes_enabled', '1') === '1',
    },
    storage: { ...upyunStatus(), password: '' },
  }
  return Object.fromEntries(
    settingsSections.map((section) => [
      section,
      {
        values: values[section],
        version: version(
          section === 'storage'
            ? [values[section], getSetting('upyun_password')]
            : values[section],
        ),
      },
    ]),
  ) as SettingsSnapshot
}
function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== 'string')
    throw new ApiError(`${label}格式不正确`, 1, 400)
  const result = value.trim()
  if ((required && !result) || result.length > max)
    throw new ApiError(
      `${label}${required ? '不能为空，且' : ''}不能超过 ${max} 字`,
      1,
      400,
    )
  return result
}
function address(
  value: unknown,
  label: string,
  optional = true,
  sitePath = false,
) {
  const result = text(value, label, 1024, !optional)
  if (!result && optional) return ''
  if (sitePath && /^\/(?!\/)/.test(result) && !/[\\\x00-\x20]/.test(result))
    return result
  try {
    const url = new URL(result)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      /[\x00-\x20]/.test(result)
    )
      throw new Error()
    return result
  } catch {
    throw new ApiError(
      `${label}需为有效的 http(s) 地址${sitePath ? '或站内路径' : ''}`,
      1,
      400,
    )
  }
}
export function saveManageSettings(
  userId: number,
  section: unknown,
  input: unknown,
  expectedVersion: unknown,
) {
  if (!settingsSections.includes(section as SettingsSection))
    throw new ApiError('设置模块不存在', 1, 400)
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ApiError('设置格式不正确', 1, 400)
  const key = section as SettingsSection,
    value = input as Record<string, unknown>
  return transaction(() => {
    const current = manageSettingsSnapshot(userId)[key]
    if (
      typeof expectedVersion !== 'string' ||
      current.version !== expectedVersion
    )
      throw new ApiError('设置已在其他页面更新，请重新加载后再保存', 1, 409)
    if (key === 'general') {
      const siteName = text(value.siteName, '站点名称', 64, true)
      const displayName = text(value.displayName, '站长昵称', 64, true)
      const faviconUrl = address(value.faviconUrl, '站点图标', true, true)
      const icpNumber = text(value.icpNumber, '备案号', 64)
      setSettings({
        site_name: siteName,
        favicon_url: faviconUrl,
        icp_number: icpNumber,
      })
      run(
        "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?",
        displayName,
        userId,
      )
    } else if (key === 'appearance') {
      if (!['light', 'dark', 'system'].includes(String(value.colorScheme)))
        throw new ApiError('请选择有效的明暗模式', 1, 400)
      if (value.wenkaiEnabled !== undefined && typeof value.wenkaiEnabled !== 'boolean')
        throw new ApiError('中文字体开关格式不正确', 1, 400)
      const fonts: Record<string, string> = {}
      for (const field of Object.keys(fontSettingKeys) as (keyof typeof fontSettingKeys)[]) {
        if (value[field] === undefined) continue
        if (!fontSettingOptions[field].some(option => option.value === value[field]))
          throw new ApiError('请选择有效的字体', 1, 400)
        fonts[fontSettingKeys[field]] = value[field] as string
      }
      saveThemeConfig(userId, {
        themeId: 'mizuki',
        colorScheme: String(value.colorScheme),
        subtitle: text(value.subtitle, '博客简介', 200),
      })
      if (value.wenkaiEnabled !== undefined)
        setSettings({ wenkai_enabled: value.wenkaiEnabled ? '1' : '0' })
      setSettings(fonts)
    } else if (key === 'content') {
      saveNavigationArticles(userId, value)
    } else if (key === 'social') {
      if (!Array.isArray(value.socialLinks) || value.socialLinks.length > 20)
        throw new ApiError('最多添加 20 个社交链接', 1, 400)
      const links = value.socialLinks.map((entry: unknown) => {
        if (!entry || typeof entry !== 'object')
          throw new ApiError('社交链接格式不正确', 1, 400)
        const item = entry as Record<string, unknown>
        const type = text(item.type, '链接类型', 32, true).toLowerCase(),
          label = text(item.label || '', '显示名称', 64)
        const url = text(item.url, '链接地址', 1024, true)
        if (
          !/^(?:https?:\/\/|mailto:|tel:)/i.test(url) ||
          /[\x00-\x20]/.test(url)
        )
          throw new ApiError(
            '社交链接需使用 http(s)、mailto 或 tel 地址',
            1,
            400,
          )
        if (/^https?:/i.test(url)) address(url, '社交链接', false)
        return { type, label, url }
      })
      saveThemeConfig(userId, { socialLinks: links })
    } else if (key === 'interaction') {
      if (
        typeof value.commentsEnabled !== 'boolean' ||
        typeof value.likesEnabled !== 'boolean'
      )
        throw new ApiError('互动开关格式不正确', 1, 400)
      setSettings({
        comments_enabled: value.commentsEnabled ? '1' : '0',
        likes_enabled: value.likesEnabled ? '1' : '0',
      })
    } else {
      const bucket = text(value.bucket, '存储空间', 128, true),
        operator = text(value.operator, '操作员', 128, true)
      const domain = text(value.domain, 'CDN 域名', 1024, true)
      const scheme = value.scheme === 'http' ? 'http' : 'https'
      address(
        /^https?:\/\//i.test(domain) ? domain : `${scheme}://${domain}`,
        'CDN 域名',
        false,
      )
      const apiHost = address(value.apiHost || '', 'API 地址')
      const password = text(value.password || '', '操作员密码', 512)
      if (!password && !upyunStatus().hasPassword)
        throw new ApiError('请填写操作员密码', 1, 400)
      const uploadDir = text(value.uploadDir, '上传目录', 256, true)
      if (
        uploadDir.split(/[\\/]+/).some((part) => part === '..' || part === '.')
      )
        throw new ApiError('上传目录不能包含 . 或 ..', 1, 400)
      saveUpyun({
        bucket,
        operator,
        domain,
        scheme,
        apiHost,
        password,
        uploadDir,
      })
    }
    return manageSettingsSnapshot(userId)[key]
  })
}
