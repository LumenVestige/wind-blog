import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { ApiError } from './api'

const CLIENT_HASH_RE = /^[a-f0-9]{64}$/i

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

export function isClientPasswordHash(s: unknown): s is string {
  return typeof s === 'string' && CLIENT_HASH_RE.test(s)
}

/** Login password: store bcrypt(lowercase(clientSHA256(password))). */
export function hashClientPassword(clientHash: string): string {
  if (!isClientPasswordHash(clientHash)) {
    throw new Error('invalid client password hash')
  }
  return bcrypt.hashSync(clientHash.toLowerCase(), 10)
}

export function verifyClientPassword(stored: string, supplied: unknown): boolean {
  if (!isClientPasswordHash(supplied)) return false
  const lowered = supplied.toLowerCase()
  // Legacy/plain hash fallback (constant-ish comparison)
  if (isClientPasswordHash(stored)) {
    return crypto.timingSafeEqual(
      Buffer.from(stored.toLowerCase()),
      Buffer.from(lowered),
    )
  }
  try {
    return bcrypt.compareSync(lowered, stored)
  } catch {
    return false
  }
}

/** Article access password: bcrypt(plain text). */
export function hashAccessPassword(plain: string): string {
  if (!plain.trim() || Buffer.byteLength(plain, 'utf8') > 72) throw new ApiError('文章密码需为 1 至 72 字节', 1, 400)
  return bcrypt.hashSync(plain, 10)
}

export function verifyAccessPassword(hash: string, plain: string): boolean {
  if (!hash || !plain || Buffer.byteLength(plain, 'utf8') > 72) return false
  try {
    return bcrypt.compareSync(plain, hash)
  } catch {
    return false
  }
}

/** Public password checks yield between bcrypt rounds to keep requests responsive. */
export async function verifyClientPasswordAsync(stored: string, supplied: unknown): Promise<boolean> {
  if (!isClientPasswordHash(supplied)) return false
  if (isClientPasswordHash(stored)) return verifyClientPassword(stored, supplied)
  try { return await bcrypt.compare(supplied.toLowerCase(), stored) } catch { return false }
}

export async function verifyAccessPasswordAsync(hash: string, plain: string): Promise<boolean> {
  if (!hash || !plain || Buffer.byteLength(plain, 'utf8') > 72) return false
  try { return await bcrypt.compare(plain, hash) } catch { return false }
}
