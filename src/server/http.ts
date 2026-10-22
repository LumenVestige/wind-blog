/** Set INSTANCE_ID when serving independent instances on the same host. */
export function cookieName(base: string): string {
  const instance = (process.env.INSTANCE_ID || '').replace(/[^a-zA-Z0-9_-]/g, '')
  return instance ? `${base}_${instance}` : base
}
export function readCookie(req: Request, name: string): string {
  const match = (req.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))
  try { return match ? decodeURIComponent(match.slice(name.length + 1)) : '' } catch { return '' }
}
export function requestOrigin(req: Request): string {
  const legacyKey = 'NEXT_PUBLIC_SITE_URL'
  const configured = process.env.PUBLIC_SITE_URL || process.env[legacyKey]
  if (configured) return new URL(configured).origin
  if (process.env.TRUST_PROXY === '1') {
    const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim()
    if (host && (proto === 'http' || proto === 'https')) return new URL(`${proto}://${host}`).origin
  }
  return new URL(req.url).origin
}
export function secureCookie(req: Request): string {
  return requestOrigin(req).startsWith('https:') ? '; Secure' : ''
}
