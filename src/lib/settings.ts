import { all, run, transaction } from '@/db'
import { UpyunClient, type UpyunConfig } from './upyun'

export interface SettingRow {
  key: string
  value: string
}

export function getSettings(): Record<string, string> {
  const rows = all<SettingRow>('SELECT key, value FROM site_settings')
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export function getSetting(key: string, fallback = ''): string {
  const rows = all<{ value: string }>(
    'SELECT value FROM site_settings WHERE key = ?',
    key,
  )
  return rows.length ? rows[0].value : fallback
}

export function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key,
    value,
  )
}

export function setSettings(values: Record<string, string>): void {
  transaction(() => {
    for (const [k, v] of Object.entries(values)) setSetting(k, v)
  })
}

export function getUpyunConfig(): UpyunConfig {
  const s = getSettings()
  return {
    bucket: s.upyun_bucket || '',
    operator: s.upyun_operator || '',
    password: s.upyun_password || '',
    domain: s.upyun_domain || '',
    scheme: s.upyun_scheme === 'http' ? 'http' : 'https',
    apiHost: s.upyun_api_host || '',
  }
}

export function getUpyunClient(): UpyunClient {
  return new UpyunClient(getUpyunConfig())
}

export function isUpyunConfigured(): boolean {
  return getUpyunClient().configured()
}

/** Public view of the CDN settings. The operator password is never returned. */
export function upyunStatus() {
  const cfg = getUpyunConfig()
  const client = getUpyunClient()
  return {
    configured: client.configured(),
    bucket: cfg.bucket,
    operator: cfg.operator,
    domain: cfg.domain,
    scheme: cfg.scheme,
    apiHost: cfg.apiHost || '',
    uploadDir: upyunUploadDir(),
    hasPassword: !!cfg.password.trim(),
    publicBaseUrl: client.publicBaseUrl(),
  }
}

/** Directory on the CDN bucket for new image uploads. No leading or trailing slash. */
export function upyunUploadDir(): string {
  const raw = getSetting('upyun_upload_dir', 'blog')
  const parts = raw
    .split(/[/\\]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
  return parts.join('/') || 'blog'
}

export function saveUpyun(input: {
  bucket: string
  operator: string
  password?: string
  domain: string
  scheme: string
  apiHost?: string
  uploadDir?: string
}): ReturnType<typeof upyunStatus> {
  const current = getUpyunConfig()
  const password = (input.password || '').trim() || current.password
  const uploadDir = (input.uploadDir ?? '')
    .split(/[/\\]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')
  setSettings({
    upyun_bucket: input.bucket.trim(),
    upyun_operator: input.operator.trim(),
    upyun_password: password,
    upyun_domain: input.domain.trim().replace(/\/+$/, ''),
    upyun_scheme: input.scheme === 'http' ? 'http' : 'https',
    upyun_api_host: (input.apiHost || '').trim().replace(/\/+$/, ''),
    upyun_upload_dir: uploadDir || 'blog',
    image_upload_default_enabled: '1',
  })
  return upyunStatus()
}

export function getPluginDownloadBase(): string {
  return getSetting('plugin_download_base', '')
}

export function pluginPublishToken(): string {
  return getSetting('obsidian_publish_token', '')
}
