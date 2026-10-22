import crypto from 'node:crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const ISSUER = 'wind-blog'
const AUDIENCE = 'wind-blog-web'
const TTL = '7d'

export interface AuthUser {
  id: number
  username: string
  isAdmin: boolean
  passwordTag?: string
}

let developmentSecret: Uint8Array | undefined

export function signingSecret(): Uint8Array {
  const configured = process.env.JWT_SECRET
  if (configured) {
    if (configured.length < 32 || (configured.startsWith('change-me-') || configured.startsWith('wind-blog-insecure-'))) {
      throw new Error('JWT_SECRET must be a random secret of at least 32 characters')
    }
    return new TextEncoder().encode(configured)
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }
  // Development without configuration must never use a publicly known key.
  return developmentSecret ??= crypto.randomBytes(32)
}

export function passwordTag(passwordHash: string): string {
  return crypto.createHmac('sha256', signingSecret()).update(passwordHash).digest('hex')
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ username: user.username, isAdmin: user.isAdmin, passwordTag: user.passwordTag })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(signingSecret())
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, signingSecret(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    return payloadToUser(payload)
  } catch {
    return null
  }
}

export function payloadToUser(payload: JWTPayload): AuthUser | null {
  const id = Number(payload.sub)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return {
    id,
    username: String(payload.username || ''),
    isAdmin: payload.isAdmin === true,
    ...(typeof payload.passwordTag === 'string' ? { passwordTag: payload.passwordTag } : {}),
  }
}
