import crypto from 'node:crypto'

const DEFAULT_API_HOST = 'https://v0.api.upyun.com'

export interface UpyunConfig {
  bucket: string
  operator: string
  password: string
  /** Public CDN host, e.g. zhiyuansofts.cn or https://cdn.example.com */
  domain: string
  scheme: 'http' | 'https'
  /** Optional REST API host override */
  apiHost?: string
}

export class UpyunClient {
  constructor(private cfg: UpyunConfig) {}

  get raw(): UpyunConfig {
    return this.cfg
  }

  configured(): boolean {
    return (
      !!this.cfg.bucket.trim() &&
      !!this.cfg.operator.trim() &&
      !!this.cfg.password.trim()
    )
  }

  publicBaseUrl(): string {
    const domain = (this.cfg.domain || '').trim()
    if (!domain) return ''
    if (/^https?:\/\//i.test(domain)) return domain.replace(/\/+$/, '')
    const scheme = this.cfg.scheme === 'http' ? 'http' : 'https'
    return `${scheme}://${domain.replace(/^\/+|\/+$/g, '')}`
  }

  publicUrl(objectKey: string): string {
    const base = this.publicBaseUrl()
    const key = '/' + (objectKey || '').replace(/^\/+/, '')
    return base ? base + key : key
  }

  private sign(method: string, uri: string, date: string): string {
    const passMd5 = crypto
      .createHash('md5')
      .update(this.cfg.password)
      .digest('hex')
    const msg = `${method.toUpperCase()}&${uri}&${date}`
    const sig = crypto
      .createHmac('sha1', passMd5)
      .update(msg)
      .digest('base64')
    return `UPYUN ${this.cfg.operator}:${sig}`
  }

  private uri(objectKey: string): string {
    const key = '/' + (objectKey || '').replace(/^\/+/, '')
    return `/${encodeURIComponent(this.cfg.bucket.replace(/^\/+|\/+$/g, ''))}${key.split('/').map(encodeURIComponent).join('/')}`
  }

  private host(): string {
    return (this.cfg.apiHost || DEFAULT_API_HOST).replace(/\/+$/, '')
  }

  async put(
    objectKey: string,
    data: Uint8Array,
    contentType = '',
  ): Promise<void> {
    if (!this.configured()) throw new Error('upyun not configured')
    const uri = this.uri(objectKey)
    const date = new Date().toUTCString()
    const headers: Record<string, string> = {
      Date: date,
      Authorization: this.sign('PUT', uri, date),
    }
    if (contentType) headers['Content-Type'] = contentType
    const res = await fetch(this.host() + uri, {
      method: 'PUT',
      redirect: 'error',
      headers,
      body: Buffer.from(data),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`upyun put ${objectKey}: ${res.status} ${body}`)
    }
  }

  async exists(objectKey: string): Promise<boolean> {
    if (!this.configured()) throw new Error('upyun not configured')
    const uri = this.uri(objectKey)
    const date = new Date().toUTCString()
    const res = await fetch(this.host() + uri, {
      method: 'HEAD',
      redirect: 'error',
      headers: { Date: date, Authorization: this.sign('HEAD', uri, date) },
      signal: AbortSignal.timeout(30000),
    })
    if (res.status === 404) return false
    if (!res.ok) throw new Error(`upyun head ${objectKey}: ${res.status}`)
    return true
  }

  async delete(objectKey: string): Promise<void> {
    if (!this.configured()) throw new Error('upyun not configured')
    const uri = this.uri(objectKey)
    const date = new Date().toUTCString()
    const res = await fetch(this.host() + uri, {
      method: 'DELETE',
      redirect: 'error',
      headers: { Date: date, Authorization: this.sign('DELETE', uri, date) },
      signal: AbortSignal.timeout(30000),
    })
    if (res.status === 404) return
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`upyun delete ${objectKey}: ${res.status} ${body}`)
    }
  }
}

export function sha256Hex(data: Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}
