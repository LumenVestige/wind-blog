import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { renderToString } from 'react-dom/server'

const session = vi.hoisted(() => ({ viewer: null as { id: number; username: string; isAdmin: boolean } | null, cookies: new Map<string, string>() }))
vi.mock('@/server/session', () => ({ getViewer: async () => session.viewer }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (key: string) => session.cookies.has(key) ? { value: session.cookies.get(key) } : undefined, toString: () => '' }),
  headers: async () => new Headers({ host: 'test.local' }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  useRouter: () => ({ refresh() {}, prefetch() {} }),
}))

import ArticlePage from '@/app/(site)/[slug]/page'
import { closeDb, get } from '@/db'
import { seedAdmin } from '@/db/seed'
import { siteOwner } from '@/server/tenant'
import { adjacentArticles, createArticle, getArticleById, makeUnlockToken, updateArticle } from '@/server/blog/articles'
import { articleRevision, renderArticle } from '@/server/blog/article-render'
import { dispatch } from '@/server/api/router'
import { passwordTag, signToken } from '@/lib/jwt'
import { isoToUnix } from '@/lib/utils'
import { cookieName } from '@/server/http'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-ssr-'))
let owner = 0, token = '', publicId = 0, lockedId = 0
const content = '# 服务端正文\n\n**完整正文无需 JavaScript**\n\n```javascript\nconst server = true\n```'
const count = (id: number) => get<{ view_count: number }>('SELECT view_count FROM blog_articles WHERE id = ?', id)!.view_count
const page = async (slug: string) => renderToString(await ArticlePage({ params: Promise.resolve({ slug }) }))

async function read(id: number, options: { authenticated?: boolean; cookie?: string; revision?: string } = {}) {
  const row = getArticleById(id)!
  const req = new Request('http://test.local/api/blog/article/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.authenticated ? { Authorization: `Bearer ${token}` } : {}), ...(options.cookie ? { Cookie: options.cookie } : {}) },
    body: JSON.stringify({ id, updatedAt: isoToUnix(row.updated_at), revision: options.revision || articleRevision(row.content) }),
  })
  const response = await dispatch(req as never, ['blog', 'article', 'read'])
  return { status: response.status, body: await response.json() }
}

beforeAll(async () => {
  process.env.DB_PATH = path.join(dir, 'review.db')
  process.env.JWT_SECRET = 'ssr-test-secret-0123456789abcdef'
  process.env.ADMIN_PASSWORD = 'unique-ssr-test-password'
  seedAdmin()
  const user = siteOwner()
  owner = user.id
  token = await signToken({ id: owner, username: user.username, isAdmin: true, passwordTag: passwordTag(user.password) })
  publicId = createArticle(owner, { title: 'SSR article', slug: 'public', content }).id
  lockedId = createArticle(owner, { title: 'Locked article', slug: 'locked', content: '# Secret\n\nProtected body', visibility: 'password', password: 'secret' }).id
})
beforeEach(() => { session.viewer = null; session.cookies.clear() })
afterAll(() => { closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })

describe('full article SSR and server render cache', () => {
  it('puts the complete formatted body in the original HTML without counting route prefetches', async () => {
    const before = count(publicId)
    for (let index = 0; index < 3; index++) {
      const html = await page('public')
      expect(html).toContain('<strong>完整正文无需 JavaScript</strong>')
      expect(html).toContain('language-javascript')
      expect(html).not.toContain('正文加载中')
    }
    expect(count(publicId)).toBe(before)
  })

  it('reuses content rendering but invalidates edits even within one timestamp second', () => {
    const cached = renderArticle(content)
    expect(renderArticle(content)).toBe(cached)
    const edited = renderArticle(content + '\n\nUpdated text')
    expect(edited).not.toBe(cached)
    expect(edited.revision).not.toBe(cached.revision)
    expect(edited.html).toContain('Updated text')
  })

  it('does not return cached protected content until the password is unlocked', async () => {
    renderArticle(getArticleById(lockedId)!.content)
    const locked = await page('locked')
    expect(locked).toContain('密码保护')
    expect(locked).not.toContain('Protected body')
    session.cookies.set(cookieName(`wind_unlock_${lockedId}`), makeUnlockToken(lockedId, getArticleById(lockedId)!.password_hash))
    expect(await page('locked')).toContain('Protected body')
    expect(count(lockedId)).toBe(0)
  })

  it('rejects private pages for visitors while retaining owner SSR', async () => {
    const item = createArticle(owner, { title: 'Private SSR', slug: 'private-ssr', content: 'Private body', visibility: 'private' })
    await expect(page(item.slug)).rejects.toThrow('NOT_FOUND')
    session.viewer = { id: owner, username: siteOwner().username, isAdmin: true }
    expect(await page(item.slug)).toContain('Private body')
    const before = count(item.id)
    expect((await read(item.id, { authenticated: true })).status).toBe(200)
    expect(count(item.id)).toBe(before)
  })

  it('counts actual opens and does not return another copy of the body', async () => {
    const before = count(publicId)
    const result = await read(publicId)
    expect(result.status).toBe(200)
    expect(result.body.data.viewCount).toBe(before + 1)
    expect(result.body.data).not.toHaveProperty('content')
    expect(result.body.data).not.toHaveProperty('html')
  })

  it('passes adjacent articles as plain objects across the RSC boundary', () => {
    const adjacent = adjacentArticles(getArticleById(publicId)!)
    const neighbors = [adjacent.prev, adjacent.next].filter((item) => item !== null)
    expect(neighbors.length).toBeGreaterThan(0)
    for (const item of neighbors) {
      expect(Object.getPrototypeOf(item)).toBe(Object.prototype)
      expect(item).toMatchObject({ slug: expect.any(String), title: expect.any(String) })
    }
  })

  it('rejects stale or revoked prefetched pages before increasing read counts', async () => {
    const item = createArticle(owner, { title: 'Stale SSR', slug: 'stale-ssr', content: 'Before edit' })
    const revision = articleRevision(item.content)
    updateArticle(owner, item.id, { content: 'After edit' })
    expect((await read(item.id, { revision })).status).toBe(409)
    expect(count(item.id)).toBe(0)
    updateArticle(owner, item.id, { visibility: 'private' })
    expect((await read(item.id)).status).toBe(404)
    expect(count(item.id)).toBe(0)
  })

  it('requires the unlock cookie when counting a protected article', async () => {
    const before = count(lockedId)
    expect((await read(lockedId)).status).toBe(403)
    expect(count(lockedId)).toBe(before)
    const cookie = `${cookieName(`wind_unlock_${lockedId}`)}=${makeUnlockToken(lockedId, getArticleById(lockedId)!.password_hash)}`
    expect((await read(lockedId, { cookie })).status).toBe(200)
    expect(count(lockedId)).toBe(before + 1)
  })
})
