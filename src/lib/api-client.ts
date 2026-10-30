'use client'

import { sha256 } from '@noble/hashes/sha2.js'

const TOKEN_KEY = 'wind_token'

/** Browser authentication uses the HttpOnly session cookie. Remove legacy copies. */
export function setToken(_token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_KEY)
}

export class ClientApiError extends Error {
  status: number
  code: number
  constructor(message: string, status = 0, code = 0) {
    super(message)
    this.name = 'ClientApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(
  method: string,
  path: string,
  opts: { params?: Record<string, unknown>; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let url = path
  if (opts.params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(opts.params)) {
      if (v === undefined || v === null || v === '') continue
      qs.set(k, String(v))
    }
    const s = qs.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
  }
  let res: Response
  try {
    res = await fetch(url, { method, headers, body, credentials: 'include', signal: opts.signal })
  } catch (e) {
    throw new ClientApiError('网络请求失败', 0, 0)
  }
  let json: Record<string, unknown> | null = null
  const text = await res.text()
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (res.status === 401) {
    setToken('')
    throw new ClientApiError(
      String((json?.message as string) || '未登录或登录已过期'),
      401,
      401,
    )
  }
  if (!res.ok || (json && typeof json.code === 'number' && json.code !== 0)) {
    throw new ClientApiError(
      String((json?.message as string) || `HTTP ${res.status}`),
      res.status,
      Number(json?.code) || 0,
    )
  }
  if (json && 'data' in json) return json.data as T
  return json as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>, options?: { signal?: AbortSignal }) =>
    request<T>('GET', path, { params, signal: options?.signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { body: form }),
}

/** POST /api/user/auth/login with client-side SHA-256 of the password. */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<{ jwtToken: string }> {
  const hash = await sha256Hex(password)
  const res = await fetch('/api/user/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: hash }),
  })
  const json = (await res.json()) as {
    success?: boolean
    message?: string
    jwtToken?: string
  }
  if (!res.ok || !json.jwtToken) {
    throw new ClientApiError(json.message || '登录失败', res.status, 0)
  }
  setToken(json.jwtToken)
  return { jwtToken: json.jwtToken }
}

export async function sha256Hex(text: string): Promise<string> {
  // Web Crypto is unavailable on plain HTTP IP addresses. The fallback keeps
  // first-run setup usable before the owner's HTTPS reverse proxy is ready.
  const bytes = new TextEncoder().encode(text)
  const hash = globalThis.crypto?.subtle ? new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)) : sha256(bytes)
  return Array.from(hash, b => b.toString(16).padStart(2, '0')).join('')
}
