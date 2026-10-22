import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { zipSync } from 'fflate'
import { dispatch } from '@/server/api/router'
import { all, closeDb, get, run } from '@/db'
import { sha256Hex } from '@/lib/password'
import { signingSecret } from '@/lib/jwt'
import { guardImage } from '@/server/images'
import { getArticleById, makeUnlockToken, verifyUnlockToken } from '@/server/blog/articles'
import { resolveStaticFile, uploadStaticSite, validateStaticPath } from '@/server/blog/static-sites'
import { saveUpyun } from '@/lib/settings'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LightMarkdown } from '@/components/blog/light-markdown'
import { seedAdmin } from '@/db/seed'
import { UpyunClient } from '@/lib/upyun'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-security-'))
let token = ''
let ownerId = 0
async function call(p: string, body?: unknown, headers: Record<string, string> = {}) {
  const req = new Request('https://test.local/api/' + p, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const res = await dispatch(req as never, p.split('?')[0].split('/'))
  return { status: res.status, headers: res.headers, json: await res.json() }
}
const auth = () => ({ Authorization: `Bearer ${token}` })
async function create(overrides: Record<string, unknown> = {}) {
  const res = await call('user/blog/article/create', { title: 'test', content: 'secret body', ...overrides }, auth())
  expect(res.status).toBe(200)
  expect(res.json.code).toBe(0)
  return res.json.data
}

beforeAll(() => {
  process.env.DB_PATH = path.join(dir, 'test.db')
  process.env.JWT_SECRET = 'security-test-secret-0123456789abcdef'
})
afterAll(() => { vi.restoreAllMocks(); closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })

describe('audit security and behavior regressions', () => {
  it('serializes concurrent initialization into exactly one owner', async () => {
    const results = await Promise.all([
      call('setup', { username: 'owner', email: 'owner@test.local', password: sha256Hex('first-password') }),
      call('user/auth/register', { username: 'other', email: 'other@test.local', password: sha256Hex('second-password') }),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 403])
    const success = results.find(r => r.status === 200)!
    token = success.json.jwtToken
    ownerId = success.json.data.user.id
    expect(success.headers.get('set-cookie')).toContain('; Secure')
    expect(get<{ c: number }>('SELECT COUNT(*) AS c FROM users')?.c).toBe(1)
  })

  it('rejects malformed JSON and oversized streamed JSON without a content length', async () => {
    for (const [body, status] of [['{broken', 400], ['[]', 400], [JSON.stringify({ text: 'x'.repeat(2 * 1024 * 1024) }), 413]] as const) {
      const res = await dispatch(new Request('https://test.local/api/user/profile/update', {
        method: 'POST', headers: auth(), body,
      }) as never, ['user', 'profile', 'update'])
      expect(res.status).toBe(status)
    }
  })

  it('rejects cross-site mutations, including login CSRF', async () => {
    const res = await call('user/auth/login', { username: 'owner', password: sha256Hex('first-password') }, { Origin: 'https://evil.local' })
    expect(res.status).toBe(403)
    const valid = await call('user/profile/update', { name: 'Owner' }, { ...auth(), Origin: 'https://test.local' })
    expect(valid.json.code).toBe(0)
  })

  it('treats malformed cookie encoding as unauthenticated', async () => {
    expect((await call('user/profile/me', undefined, { Cookie: 'wind_token=%zz' })).status).toBe(401)
  })

  it('rejects placeholder and missing production JWT secrets', () => {
    const old = process.env.JWT_SECRET
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.JWT_SECRET
    expect(() => signingSecret()).toThrow('required')
    process.env.JWT_SECRET = 'change-me-to-a-long-random-string-at-least-32-chars'
    expect(() => signingSecret()).toThrow('random secret')
    vi.unstubAllEnvs()
    process.env.JWT_SECRET = old
  })

  it('hides password article summaries and blocks comment disclosure until unlock', async () => {
    const article = await create({ visibility: 'password', password: ' pw ' })
    await call('user/blog/comment/create', { articleId: article.id, content: 'secret comment' }, auth())
    const locked = await call(`user/blog/article/get?id=${article.id}`)
    expect(locked.json.data.summary).toBe('')
    expect((await call('user/blog/by-username?username=owner&keyword=secret%20body')).json.data.list.some((item: { id: number }) => item.id === article.id)).toBe(false)
    expect(locked.json.data.content).toBeUndefined()
    expect((await call(`user/blog/comment/list?articleId=${article.id}`)).status).toBe(403)
    const unlocked = await call('user/blog/article/unlock', { id: article.id, password: ' pw ' })
    expect(unlocked.json.data.author.username).toBe('owner')
    expect(unlocked.json.data.content).toBe('secret body')
    const cookie = unlocked.headers.get('set-cookie')!.split(';')[0]
    expect(cookie).toContain(`wind_unlock_${article.id}=`)
    expect((await call(`user/blog/comment/list?articleId=${article.id}`, undefined, { Cookie: cookie })).json.data.total).toBe(1)
    expect((await call(`user/blog/article/get?id=${article.id}`, undefined, { Cookie: cookie })).json.data.content).toBe('secret body')
    await call('user/blog/article/update', { id: article.id, password: 'new-password' }, auth())
    expect((await call(`user/blog/article/get?id=${article.id}`, undefined, { Cookie: cookie })).json.data.canSeeBody).toBe(false)
  })

  it('does not expose private or unapproved article metadata through comments and unlock', async () => {
    const article = await create({ visibility: 'private' })
    expect((await call('user/blog/article/unlock', { id: article.id, password: 'anything' })).status).toBe(404)
    expect((await call(`user/blog/comment/list?articleId=${article.id}`)).status).toBe(404)
    const pending = await create({ visibility: 'password', password: 'password' })
    run("UPDATE blog_articles SET moderation_status = 'pending' WHERE id = ?", pending.id)
    expect((await call(`user/blog/article/get?id=${pending.id}`)).status).toBe(404)
    expect((await call('user/blog/article/unlock', { id: pending.id, password: 'password' })).status).toBe(404)
  })

  it('keeps category on partial updates and honors custom summaries and recommendation', async () => {
    const category = await call('user/blog/category/create', { name: 'custom' }, auth())
    const article = await create({ categoryId: category.json.data.id, summary: 'custom summary', recommend: true })
    const updated = await call('user/blog/article/update', { id: article.id, title: 'changed' }, auth())
    expect(updated.json.data.categoryId).toBe(category.json.data.id)
    expect(updated.json.data.summary).toBe('custom summary')
    expect(updated.json.data.recommend).toBe(true)
  })

  it('rolls back article and tag mutations when tag validation fails', async () => {
    const article = await create({ tags: ['original'] })
    const updated = await call('user/blog/article/update', { id: article.id, title: 'broken', tags: Array.from({ length: 101 }, (_, i) => `tag-${i}`) }, auth())
    expect(updated.status).toBe(400)
    expect(getArticleById(article.id)?.title).toBe('test')
    expect(all('SELECT * FROM blog_article_tags WHERE article_id = ?', article.id)).toHaveLength(1)
  })

  it('rejects duplicate pinned order and clears pin when made private', async () => {
    const a = await create(), b = await create()
    for (const item of [a, b]) await call('user/blog/article/pin', { id: item.id, pinned: true }, auth())
    expect((await call('user/blog/article/pinned/reorder', { articleIds: [a.id, a.id] }, auth())).status).toBe(400)
    expect((await call('user/blog/article/pinned/reorder', { articleIds: [b.id, a.id] }, auth())).json.code).toBe(0)
    await call('user/blog/article/update', { id: b.id, visibility: 'private' }, auth())
    expect(getArticleById(b.id)?.pinned_at).toBeNull()
    expect((await call('user/blog/article/pin', { id: b.id, pinned: true }, auth())).status).toBe(400)
  })

  it('avoids article slugs that collide with fixed application pages', async () => {
    const article = await create({ title: 'About', slug: 'about' })
    expect(article.slug).toBe('about-2')
  })

  it('stores an ascii slug when the plugin publishes a CJK title', async () => {
    const article = await create({ title: 'Golang 中的切片扩容问题', content: 'body' })
    expect(article.slug).toMatch(/^post-[a-z0-9]+$/)
    const bySlug = await call(`user/blog/article/get?id=${article.id}`)
    expect(bySlug.json.data.title).toBe('Golang 中的切片扩容问题')
  })

  it('disables raw HTML execution in the lightweight preview', () => {
    const html = renderToStaticMarkup(createElement(LightMarkdown, {
      source: '<img src=x onerror=alert(1)><script>alert(1)</script>',
    }))
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;')
  })

  it('does not create a second owner through db:seed', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    seedAdmin()
    expect(get<{ c: number }>('SELECT COUNT(*) AS c FROM users')?.c).toBe(1)
    log.mockRestore()
  })

  it('normalizes decimal pagination and caps negative tag limits', async () => {
    const res = await call('user/blog/article/mine?page=1.7&pageSize=2.5', undefined, auth())
    expect(res.json.data).toMatchObject({ page: 1, pageSize: 2 })
    expect((await call('user/blog/tags?username=owner&limit=-1')).json.code).toBe(0)
  })

  it('paginates root comments together with their replies and updates counts on deletion', async () => {
    const article = await create()
    const first = await call('user/blog/comment/create', { articleId: article.id, content: 'root1' }, auth())
    await call('user/blog/comment/create', { articleId: article.id, content: 'reply', parentId: first.json.data.id }, auth())
    await call('user/blog/comment/create', { articleId: article.id, content: 'root2' }, auth())
    const page1 = await call(`user/blog/comment/list?articleId=${article.id}&pageSize=1`)
    expect(page1.json.data.total).toBe(2)
    expect(page1.json.data.list[0].replies[0].content).toBe('reply')
    const page2 = await call(`user/blog/comment/list?articleId=${article.id}&pageSize=1&page=2`)
    expect(page2.json.data.list[0].content).toBe('root2')
    await call('user/blog/comment/delete', { id: first.json.data.id }, auth())
    expect(getArticleById(article.id)?.comment_count).toBe(1)
  })

  it('protects images referenced by custom and fixed pages from cleanup', async () => {
    for (const kind of ['page', 'theme']) {
      const key = `/blog/${kind}.png`
      const id = run("INSERT INTO blog_image_assets (user_id, object_key, url, content_hash) VALUES (?, ?, ?, ?)", ownerId, key, key, kind.repeat(16)).lastInsertRowid
      if (kind === 'page') await call('user/blog/page/create', { title: 'Page', contentMd: `![pic](${key})` }, auth())
      else await call('user/blog/theme/config', { aboutMd: `![pic](${key})` }, auth())
      expect((await call('user/blog/admin/images/delete', { id }, auth())).status).toBe(409)
      expect((await call('user/blog/admin/images/delete-batch', { ids: [id] }, auth())).json.data.deleted).toBe(0)
    }
    const res = await call('user/blog/admin/images?mode=cleanup', undefined, auth())
    expect(res.json.data.candidateIds).toEqual([])
  })

  it('rejects dangerous social links and converts string boolean page flags', async () => {
    const res = await call('user/blog/theme/config', { socialLinks: [{ type: 'other', url: 'javascript:alert(1)' }] }, auth())
    expect(res.json.data.socialLinks).toEqual([])
    expect((await call('user/blog/page/create', { title: 'hidden', showInNav: 'false' }, auth())).json.data.showInNav).toBe(false)
  })

  it('rejects active SVG, mislabeled and oversized images', () => {
    expect(() => guardImage('image/svg+xml', new TextEncoder().encode('<svg onload="alert(1)"/>'))).toThrow()
    expect(() => guardImage('image/png', new TextEncoder().encode('<html>'))).toThrow()
    expect(() => guardImage('image/png', new Uint8Array(10 * 1024 * 1024 + 1))).toThrow()
  })

  it('rejects encoded, absolute and traversal static paths', () => {
    for (const value of ['../x', '/absolute', 'a/../b', 'a\\b', '%2e%2e/x', 'file?query', 'file#hash']) expect(() => validateStaticPath(value)).toThrow()
    expect(() => validateStaticPath('a..b/file name.html')).not.toThrow()
  })

  it('rejects ZIP bombs before upload, unwraps folder ZIPs, and keeps the old site on upload failure', async () => {
    saveUpyun({ bucket: 'test', operator: 'owner', password: 'test-password', domain: 'cdn.test.local', scheme: 'https' })
    const put = vi.spyOn(UpyunClient.prototype, 'put').mockResolvedValue(undefined)
    const del = vi.spyOn(UpyunClient.prototype, 'delete').mockResolvedValue(undefined)
    const bomb = zipSync({ 'index.html': new Uint8Array(16 * 1024 * 1024 + 1) })
    await expect(uploadStaticSite(ownerId, 'owner', { data: bomb, title: 'bomb' })).rejects.toThrow('解压后')
    expect(put).not.toHaveBeenCalled()
    const data = zipSync({ 'folder/index.html': new TextEncoder().encode('hello'), 'folder/assets/a.js': new Uint8Array([1]) })
    const site = await uploadStaticSite(ownerId, 'owner', { data, title: 'site', showInNav: true })
    expect(site.entry).toBe('index.html')
    const before = resolveStaticFile('owner', site.slug, '').url
    put.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('upload failed'))
    await expect(uploadStaticSite(ownerId, 'owner', { data, title: 'replacement', id: site.id })).rejects.toThrow('upload failed')
    expect(resolveStaticFile('owner', site.slug, '').url).toBe(before)
    expect(del).toHaveBeenCalledTimes(1)
    expect(get<{ title: string }>('SELECT title FROM blog_static_sites WHERE id = ?', site.id)?.title).toBe('site')
    const replacement = await uploadStaticSite(ownerId, 'owner', { data, title: 'replacement', id: site.id })
    expect(replacement.showInNav).toBe(true)
    expect(resolveStaticFile('owner', site.slug, '').url).not.toBe(before)
    put.mockRestore(); del.mockRestore()
  })

  it('retains image records when remote deletion fails', async () => {
    const id = run("INSERT INTO blog_image_assets (user_id, object_key, url, content_hash) VALUES (?, '/unused.png', '/unused.png', 'unused')", ownerId).lastInsertRowid
    const del = vi.spyOn(UpyunClient.prototype, 'delete').mockRejectedValue(new Error('remote failure'))
    expect((await call('user/blog/admin/images/delete', { id }, auth())).status).toBe(502)
    expect(get('SELECT id FROM blog_image_assets WHERE id = ?', id)).toBeTruthy()
    del.mockRestore()
  })

  it('binds unlock tokens to the password and rejects extra token segments', () => {
    const unlock = makeUnlockToken(9, 'hash1')
    expect(verifyUnlockToken(unlock, 9, 'hash1')).toBe(true)
    expect(verifyUnlockToken(unlock, 9, 'hash2')).toBe(false)
    expect(verifyUnlockToken(unlock + '.ignored', 9, 'hash1')).toBe(false)
    expect(verifyUnlockToken(unlock.split('.')[0] + '.' + 'é'.repeat(43), 9, 'hash1')).toBe(false)
  })

  it('limits login and article password guessing', async () => {
    for (let i = 0; i < 20; i++) await call('user/auth/login', { username: 'guessed', password: sha256Hex('wrong') })
    expect((await call('user/auth/login', { username: 'guessed', password: sha256Hex('wrong') })).status).toBe(429)
    const article = await create({ visibility: 'password', password: 'correct' })
    for (let i = 0; i < 30; i++) await call('user/blog/article/unlock', { id: article.id, password: 'wrong' })
    expect((await call('user/blog/article/unlock', { id: article.id, password: 'wrong' })).status).toBe(429)
  })

  it('revokes old JWTs on password changes', async () => {
    expect((await call('user/auth/change-password', { oldPassword: sha256Hex('first-password'), newPassword: sha256Hex('new-password') }, auth())).json.code).toBe(0)
    expect((await call('user/profile/me', undefined, auth())).status).toBe(401)
    expect((await call('user/auth/refresh', {}, auth())).status).toBe(401)
    const loggedIn = await call('user/auth/login', { username: 'owner', password: sha256Hex('new-password') })
    expect(loggedIn.json.jwtToken).toBeTruthy()
  })
})
