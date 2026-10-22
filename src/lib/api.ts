import { cookieName, readCookie } from '@/server/http'
import type { NextRequest } from 'next/server'
import { passwordTag, verifyToken, type AuthUser } from './jwt'
import { get } from '@/db'

export class ApiError extends Error {
  code: number
  status: number
  constructor(message: string, code = 1, status = 200) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function ok<T>(data: T, message = 'ok'): Response {
  return Response.json({ code: 0, message, data }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export function okRaw(body: Record<string, unknown>): Response {
  return Response.json({ code: 0, message: 'ok', ...body }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export function fail(message: string, code = 1, status = 200): Response {
  return Response.json({ code, message, data: null }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function readJson(
  req: Request | NextRequest,
): Promise<Record<string, unknown>> {
  const bytes = await readBody(req, 2 * 1024 * 1024)
  try {
    const j: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('object required')
    return j as Record<string, unknown>
  } catch {
    throw new ApiError('请求需为 JSON 对象', 1, 400)
  }
}

async function readBody(req: Request, limit: number): Promise<Uint8Array> {
  if (Number(req.headers.get('content-length')) > limit) throw new ApiError('请求体过大', 413, 413)
  const reader = req.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new ApiError('请求体过大', 413, 413)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

export async function readForm(req: Request, limit: number): Promise<FormData> {
  const bytes = await readBody(req, limit)
  try {
    return await new Request(req.url, { method: 'POST', headers: req.headers, body: Buffer.from(bytes) }).formData()
  } catch { throw new ApiError('请求格式错误', 1, 400) }
}

export function getQuery(req: Request | NextRequest): URLSearchParams {
  return new URL(req.url).searchParams
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  return String(v)
}

export function bool(v: unknown, fallback = false): boolean {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'boolean') return v
  return v === 1 || v === '1' || v === 'true'
}

export async function currentUser(
  req: Request | NextRequest,
): Promise<AuthUser | null> {
  let token = ''
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim()
  if (!token) {
    token = readCookie(req, cookieName('wind_token'))
  }
  if (!token) return null
  const user = await verifyToken(token)
  if (!user) return null
  // Ensure the account still exists (and load fresh admin flag)
  const row = get<{ id: number; username: string; is_site_admin: number; password: string }>(
    'SELECT id, username, is_site_admin, password FROM users WHERE id = ?',
    user.id,
  )
  if (!row || user.passwordTag !== passwordTag(row.password)) return null
  return { id: row.id, username: row.username, isAdmin: row.is_site_admin === 1 }
}

export async function requireUser(
  req: Request | NextRequest,
): Promise<AuthUser> {
  const user = await currentUser(req)
  if (!user) throw new ApiError('未登录或登录已过期', 401, 401)
  return user
}

export async function requireAdmin(
  req: Request | NextRequest,
): Promise<AuthUser> {
  const user = await requireUser(req)
  if (!user.isAdmin) throw new ApiError('无权限', 403, 403)
  return user
}

type Handler = (req: NextRequest, ctx: unknown) => Promise<Response> | Response

/** Wrap a route handler with uniform ApiError → JSON envelope handling. */
export function handle(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      if (e instanceof ApiError) return fail(e.message, e.code, e.status)
      // eslint-disable-next-line no-console
      console.error('[wind-blog] unhandled error:', e)
      return fail('服务器内部错误', 500, 500)
    }
  }
}
