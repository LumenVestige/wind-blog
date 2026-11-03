/**
 * Mirrors the GoAlgo Blog Obsidian plugin's ApiClient call sequence and
 * envelope-unwrapping rules, verifying wind-blog is drop-in compatible:
 * a user only needs to point the plugin's `baseUrl` at this server.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { saveUpyun } from '@/lib/settings'
import { UpyunClient } from '@/lib/upyun'
import { imageFixtures } from './helpers/image-fixtures'

type Dispatch = typeof import('@/server/api/router').dispatch
let dispatch: Dispatch
let dbFile: string

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

interface Envelope {
  code?: number
  message?: string
  data?: unknown
  list?: unknown
  url?: string
  jwtToken?: string
  [k: string]: unknown
}

/** Faithful port of the plugin's `unwrap` (pick='data' | 'list'). */
function unwrap<T>(data: unknown, pick: 'data' | 'list'): T {
  if (data == null) return data as T
  if (typeof data !== 'object') return data as T
  const env = data as Envelope
  if (typeof env.code === 'number' && env.code !== 0) {
    throw new Error(env.message || `业务错误 code=${env.code}`)
  }
  if (pick === 'list') {
    if (Array.isArray(env.list)) return env.list as T
    if (env.data && typeof env.data === 'object' && Array.isArray((env.data as Envelope).list)) {
      return (env.data as { list: T }).list
    }
    if (Array.isArray(env.data)) return env.data as T
  }
  let cur: unknown = env
  for (let i = 0; i < 3; i++) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break
    const rec = cur as Envelope
    if (typeof rec.code === 'number' && rec.code !== 0) {
      throw new Error(rec.message || `业务错误 code=${rec.code}`)
    }
    if (!('data' in rec) || rec.data === undefined || rec.data === null) break
    const inner = rec.data
    if (
      inner &&
      typeof inner === 'object' &&
      !Array.isArray(inner) &&
      ('id' in (inner as object) || 'slug' in (inner as object) || 'title' in (inner as object))
    ) {
      return inner as T
    }
    if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'data' in (inner as object)) {
      cur = inner
      continue
    }
    return inner as T
  }
  if ('data' in env && env.data !== undefined) return env.data as T
  return data as T
}

class PluginLikeClient {
  token = ''
  constructor(private baseUrl: string) {}
  async requestRaw(
    p: string,
    opts: { method?: string; body?: unknown; auth?: boolean } = {},
  ): Promise<{ status: number; data: unknown }> {
    const headers: Record<string, string> = {}
    if (opts.auth !== false && this.token) headers.Authorization = `Bearer ${this.token}`
    let body: string | undefined
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    const res = await fetch(this.baseUrl + '/api' + p, {
      method: opts.method || 'GET',
      headers,
      body,
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, data }
  }
  async login(username: string, password: string) {
    const { data } = await this.requestRaw('/user/auth/login', {
      method: 'POST',
      body: { username, password: sha256(password) },
      auth: false,
    })
    return data as { success?: boolean; message?: string; jwtToken?: string }
  }
  async activationStatus() {
    const { data } = await this.requestRaw('/user/blog/activation/status')
    return unwrap<{ activated?: boolean }>(data, 'data')
  }
  async imageUploadStatus() {
    const { data } = await this.requestRaw('/user/blog/image-upload/status')
    return unwrap<{ configured: boolean; authorized: boolean; enabled: boolean }>(data, 'data')
  }
  async categoryMine() {
    const { data } = await this.requestRaw('/user/blog/category/mine')
    return unwrap<{ id: number; name: string }[]>(data, 'list')
  }
  async articleMine(page = 1, pageSize = 50) {
    const { data } = await this.requestRaw(
      `/user/blog/article/mine?page=${page}&pageSize=${pageSize}`,
    )
    return unwrap<{ id: number }[]>(data, 'list')
  }
  async articleGet(id: number) {
    const { data } = await this.requestRaw(`/user/blog/article/get?id=${id}`)
    return unwrap<{ id: number; content?: string; tags?: string[] }>(data, 'data')
  }
  async articleCreate(body: Record<string, unknown>) {
    const { data } = await this.requestRaw('/user/blog/article/create', {
      method: 'POST',
      body,
    })
    return unwrap<{ id: number; slug: string }>(data, 'data')
  }
  async articleUpdate(body: Record<string, unknown>) {
    const { data } = await this.requestRaw('/user/blog/article/update', {
      method: 'POST',
      body,
    })
    return unwrap<{ id: number }>(data, 'data')
  }
  async blogImagesCheck(urls: string[], hashes: string[]) {
    const { data } = await this.requestRaw('/user/blog/images/check', {
      method: 'POST',
      body: { urls, hashes },
    })
    return unwrap<{
      existing: string[]
      missing: string[]
      existingHashes: string[]
      missingHashes: string[]
    }>(data, 'data')
  }
  async obsidianLatest() {
    const { data } = await this.requestRaw('/user/blog/obsidian-plugin/latest', { auth: false })
    const env = data as Envelope
    return (env.data as Record<string, unknown>) || (data as Record<string, unknown>)
  }
}

beforeAll(async () => {
  dbFile = path.join(os.tmpdir(), `wind-plugin-${Date.now()}.db`)
  process.env.DB_PATH = dbFile
  process.env.JWT_SECRET = 'plugin-test-secret-0123456789abcdef'
  const db = await import('@/db')
  db.getDb()
  dispatch = (await import('@/server/api/router')).dispatch
  // install a fetch shim that routes through the in-process dispatcher
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('test.local')) {
      const u = new URL(url)
      const req = new Request(url, init)
      return dispatch(req as never, u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean))
    }
    return originalFetch(input as never, init)
  }) as typeof fetch
})

afterAll(async () => {
  const db = await import('@/db')
  db.closeDb()
  for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
    try {
      fs.rmSync(f, { force: true })
    } catch {
      /* ignore */
    }
  }
})

describe('Obsidian plugin compatibility', () => {
  const client = new PluginLikeClient('http://test.local')

  it('runs the full plugin publish lifecycle', async () => {
    const reg = await client.requestRaw('/user/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        username: 'writer',
        password: sha256('writerpass'),
        name: 'writer',
        email: 'writer@test.local',
      },
    })
    expect(reg.status).toBe(200)

    const login = await client.login('writer', 'writerpass')
    expect(login.success).toBe(true)
    expect(typeof login.jwtToken).toBe('string')
    client.token = login.jwtToken!

    const activation = await client.activationStatus()
    expect(activation.activated).toBe(true)

    const upload = await client.imageUploadStatus()
    expect(upload).toHaveProperty('configured')
    expect(upload).toHaveProperty('authorized')
    expect(upload).toHaveProperty('enabled')

    const categories = await client.categoryMine()
    expect(categories.some((c) => c.name === '默认')).toBe(true)

    const created = await client.articleCreate({
      title: 'From Obsidian',
      content: '![img](https://cdn.test/blog/9/hash.png)\n\nbody',
      tags: ['obsidian'],
      visibility: 'public',
      categoryId: categories[0].id,
      syncToMainProfile: true,
    })
    expect(created.id).toBeGreaterThan(0)
    expect(created.slug).toMatch(/^from-obsidian-[a-z0-9]{6}$/)

    const mine = await client.articleMine()
    expect(mine.map((a) => a.id)).toContain(created.id)

    const fetched = await client.articleGet(created.id)
    expect(fetched.content).toContain('body')
    expect(fetched.tags).toContain('obsidian')

    const updated = await client.articleUpdate({
      id: created.id,
      title: 'From Obsidian (edited)',
      content: 'updated body',
      visibility: 'public',
    })
    expect(updated.id).toBe(created.id)

    const check = await client.blogImagesCheck(
      ['https://cdn.test/blog/9/hash.png'],
      ['a'.repeat(64)],
    )
    expect(check.missing).toContain('https://cdn.test/blog/9/hash.png')
    expect(check.missingHashes).toContain('a'.repeat(64))
  })

  it.each(['blog', 'blog_cover', 'avatar'])('uploads mislabeled images for %s using their actual format', async (purpose) => {
    saveUpyun({ bucket: 'test', operator: 'owner', password: 'test-password', domain: 'cdn.test.local', scheme: 'https' })
    const put = vi.spyOn(UpyunClient.prototype, 'put').mockResolvedValue(undefined)
    try {
      for (const image of imageFixtures) {
        // The plugin derives MIME from the filename, even for JPEG bytes in a .png file.
        const form = new FormData()
        form.append('purpose', purpose)
        form.append('file', new Blob([new Uint8Array(image.data)], { type: 'image/png' }), 'pasted-image.png')
        const response = await fetch('http://test.local/api/user/upload', {
          method: 'POST', headers: { Authorization: `Bearer ${client.token}` }, body: form,
        })
        const result = await response.json()
        const hash = crypto.createHash('sha256').update(image.data).digest('hex')
        const objectKey = `/blog/${purpose === 'avatar' ? 'avatar/' : ''}${hash}${image.ext}`
        const url = `https://cdn.test.local${objectKey}`
        expect(response.status).toBe(200)
        expect(result).toMatchObject({ code: 0, url, hash, data: { url, hash } })
        expect(put).toHaveBeenLastCalledWith(objectKey, new Uint8Array(image.data), image.contentType)
        if (purpose !== 'avatar') {
          const check = await client.blogImagesCheck([url], [hash])
          expect(check.existing).toContain(url)
          expect(check.existingHashes).toContain(hash)
        }
      }
    } finally {
      put.mockRestore()
    }
  })

  it('serves plugin update metadata', async () => {
    const info = await client.obsidianLatest()
    expect(info).toHaveProperty('version')
    expect(info).toHaveProperty('downloadBase')
    expect(info).toHaveProperty('minAppVersion')
  })
})
