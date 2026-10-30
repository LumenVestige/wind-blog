import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb, get, run } from '@/db'
import { sha256Hex } from '@/lib/password'
import { createArticle, updateArticle } from '@/server/blog/articles'
import { dispatch } from '@/server/api/router'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-prefetch-'))
let owner = 0, token = ''
let publicId = 0, privateId = 0, lockedId = 0, pendingId = 0
const count = (id: number) => get<{ view_count: number }>('SELECT view_count FROM blog_articles WHERE id = ?', id)!.view_count

async function call(route: string, body?: unknown, authenticated = false) {
  const request = new Request(`http://test.local/api/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const response = await dispatch(request as never, route.split('?')[0].split('/'))
  return { response, body: await response.json() }
}

beforeAll(async () => {
  process.env.DB_PATH = path.join(dir, 'test.db')
  process.env.JWT_SECRET = 'prefetch-test-secret-0123456789abcdef'
  const setup = await call('setup', { username: 'owner', email: 'owner@test.local', password: sha256Hex('prefetch-test-password') })
  owner = setup.body.data.user.id
  token = setup.body.jwtToken
  publicId = createArticle(owner, { title: 'Public', slug: 'public', content: 'Public body' }).id
  privateId = createArticle(owner, { title: 'Private', slug: 'private', content: 'Private body', visibility: 'private' }).id
  lockedId = createArticle(owner, { title: 'Locked', slug: 'locked', content: 'Secret body', visibility: 'password', password: 'secret' }).id
  pendingId = createArticle(owner, { title: 'Pending', slug: 'pending', content: 'Pending body' }).id
  run('UPDATE blog_articles SET moderation_status = ? WHERE id = ?', 'pending', pendingId)
})
afterAll(() => { closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })

describe('speculative article reads', () => {
  it('returns public content without changing its view count', async () => {
    const before = count(publicId)
    for (let i = 0; i < 3; i++) {
      const result = await call('user/blog/article/prefetch?slug=public')
      expect(result.body).toMatchObject({ code: 0, data: { id: publicId, content: 'Public body', viewCount: before } })
      expect(result.response.headers.get('cache-control')).toContain('no-store')
    }
    expect(count(publicId)).toBe(before)
  })

  it('counts opening cached content once without returning the body again', async () => {
    const prefetched = await call('user/blog/article/prefetch?slug=public')
    const before = count(publicId)
    const opened = await call('user/blog/article/view', { id: publicId, updatedAt: prefetched.body.data.updatedAt })
    expect(opened.body.data.viewCount).toBe(before + 1)
    expect(opened.body.data).not.toHaveProperty('content')
    expect(count(publicId)).toBe(before + 1)
  })

  it('invalidates stale content before incrementing the counter', async () => {
    const before = count(publicId)
    const result = await call('user/blog/article/view', { id: publicId, updatedAt: 1 })
    expect(result.response.status).toBe(409)
    expect(count(publicId)).toBe(before)
  })

  it('excludes private, password-protected and unapproved posts even for the owner', async () => {
    for (const [slug, id] of [['private', privateId], ['locked', lockedId], ['pending', pendingId]] as const) {
      for (const authenticated of [false, true]) {
        expect((await call(`user/blog/article/prefetch?slug=${slug}`, undefined, authenticated)).response.status).toBe(404)
        expect((await call('user/blog/article/view', { id, updatedAt: 1 }, authenticated)).response.status).toBe(404)
      }
      expect(count(id)).toBe(0)
    }
  })

  it('rechecks publication status when a prefetched article is opened later', async () => {
    const article = createArticle(owner, { title: 'Revoked', slug: 'revoked', content: 'Previously public' })
    const prefetched = await call('user/blog/article/prefetch?slug=revoked')
    updateArticle(owner, article.id, { visibility: 'private' })
    const result = await call('user/blog/article/view', { id: article.id, updatedAt: prefetched.body.data.updatedAt })
    expect(result.response.status).toBe(404)
    expect(count(article.id)).toBe(0)
  })

  it('preserves the existing detail API and its original read counting behavior', async () => {
    const before = count(publicId)
    const result = await call('user/blog/article/get?username=owner&slug=public')
    expect(result.body.data).toMatchObject({ content: 'Public body', viewCount: before + 1 })
  })
})
