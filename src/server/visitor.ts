import crypto from 'node:crypto'
import { signingSecret } from '@/lib/jwt'
import { cookieName, readCookie, secureCookie } from './http'
import { rateLimit } from './rate-limit'
function signature(id: string) { return crypto.createHmac('sha256', signingSecret()).update('visitor:' + id).digest('hex') }
export function visitorIdentity(req: Request) {
  const token = readCookie(req, cookieName('wind_visitor'))
  const [id, sig] = token.split('.')
  if (/^[a-f0-9]{32}$/.test(id || '') && /^[a-f0-9]{64}$/.test(sig || '') && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature(id)))) return { key: id, token, fresh: false }
  const key = crypto.randomBytes(16).toString('hex')
  return { key, token: `${key}.${signature(key)}`, fresh: true }
}
export function visitorCookie(res: Response, req: Request, identity: ReturnType<typeof visitorIdentity>) {
  if (identity.fresh) res.headers.append('Set-Cookie', `${cookieName('wind_visitor')}=${identity.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secureCookie(req)}`)
  return res
}
export function limitVisitor(req: Request, key: string, action: string) {
  // The trusted proxy must overwrite X-Forwarded-For. Also enforce an instance-wide ceiling.
  const address = process.env.TRUST_PROXY === '1' ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'direct' : 'direct'
  const digest = crypto.createHmac('sha256', signingSecret()).update(address).digest('hex')
  rateLimit(`visitor:${action}:global`, 3000)
  rateLimit(`visitor:${action}:address:${digest}`, 300)
  rateLimit(`visitor:${action}:actor:${key}`, 100)
}
