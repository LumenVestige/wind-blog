import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dispatch } from '@/server/api/router'
import { closeDb, get, getDb, run } from '@/db'
import { sha256Hex } from '@/lib/password'
import { createArticle, getArticleById, listByUsername, serializeArticle, updateArticle } from '@/server/blog/articles'
import { sha256Hex as browserHash } from '@/lib/api-client'
import { cookieName, requestOrigin } from '@/server/http'
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-ux-'))
let token = '', owner = 0, article = 0, guestCookie = ''
async function call(p: string, body?: unknown, headers: Record<string, string> = {}) {
  const req = new Request('http://test.local/api/' + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const res = await dispatch(req as never, p.split('?')[0].split('/'))
  return { status: res.status, headers: res.headers, json: await res.json() }
}
const auth = () => ({ Authorization: `Bearer ${token}` })
beforeAll(async () => { process.env.DB_PATH = path.join(dir, 'test.db'); process.env.JWT_SECRET = 'ux-regression-secret-0123456789abcdef'; delete process.env.INSTANCE_ID; const r = await call('setup', { username: 'owner', email: 'owner@test.local', password: sha256Hex('long-owner-password') }); token = r.json.jwtToken; owner = r.json.data.user.id; article = (await call('user/blog/article/create', { title: 'Visible', content: 'Hello' }, auth())).json.data.id })
afterAll(() => { delete process.env.INSTANCE_ID; delete process.env.TRUST_PROXY; closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })
describe('single owner UX regressions', () => {
  it('remembers anonymous article likes in a signed cookie and toggles exactly once', async () => {
    const one = await call('user/blog/like', { articleId: article })
    expect(one.json.data).toMatchObject({ liked: true, likeCount: 1 })
    guestCookie = one.headers.get('set-cookie')!.split(';')[0]
    expect(get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n).toBe(1)
    const two = await call('user/blog/like', { articleId: article }, { Cookie: guestCookie })
    expect(two.json.data).toMatchObject({ liked: false, likeCount: 0 })
  })
  it('retains article readability rules for anonymous interaction', async () => {
    const locked = (await call('user/blog/article/create', { title: 'Locked', content: 'secret', visibility: 'password', password: 'secret' }, auth())).json.data.id
    expect((await call('user/blog/like', { articleId: locked }, { Cookie: guestCookie })).status).toBe(403)
    const unlocked = await call('user/blog/article/unlock', { id: locked, password: 'secret' })
    const cookies = guestCookie + '; ' + unlocked.headers.get('set-cookie')!.split(';')[0]
    expect((await call('user/blog/like', { articleId: locked }, { Cookie: cookies })).json.data.liked).toBe(true)
  })
  it('keeps manual summaries through full editor updates and supports explicit cover removal', () => {
    const original = createArticle(owner, { title: 'Summary', content: 'old', summary: 'Manual excerpt', coverUrl: 'https://example.test/cover.png' })
    const updated = updateArticle(owner, original.id, { title: 'Updated', content: 'new body', coverUrl: '' })
    expect(updated.summary).toBe('Manual excerpt'); expect(updated.cover_url).toBe('')
    expect(serializeArticle(updated, { viewerId: owner }).summaryIsDefault).toBe(false)
    expect(updateArticle(owner, original.id, { content: 'auto body', autoSummary: true }).summary).toBe('auto body')
  })
  it('repairs previously saved automatic image summaries on startup and preserves manual summaries', () => {
    const content = '先占个坑\n![|51%](https://cdn.test/photo.jpg)'
    const automatic = createArticle(owner, { title: 'Automatic image summary', content })
    const manual = createArticle(owner, { title: 'Manual percentage', content, summary: '活动进度 51%' })
    run("UPDATE blog_articles SET summary = '先占个坑 51%', updated_at = '2026-01-01 00:00:00' WHERE id = ?", automatic.id)
    run("DELETE FROM schema_migrations WHERE key = 'article-image-summary-v1'")
    closeDb()
    getDb()
    const repaired = getArticleById(automatic.id)!
    expect(repaired.summary).toBe('先占个坑')
    expect(repaired.content).toBe(content)
    expect(repaired.updated_at).toBe('2026-01-01 00:00:00')
    expect(getArticleById(manual.id)!.summary).toBe('活动进度 51%')
    const list = listByUsername('owner', { pageSize: 100 }).list
    expect(list.find(article => article.id === automatic.id)).toMatchObject({ summary: '先占个坑', summaryIsDefault: true })
    expect(list.find(article => article.id === manual.id)).toMatchObject({ summary: '活动进度 51%', summaryIsDefault: false })
    expect(get("SELECT 1 FROM schema_migrations WHERE key = 'article-image-summary-v1'")).toBeTruthy()
    closeDb()
    expect(getArticleById(automatic.id)!.summary).toBe('先占个坑')
    expect(getArticleById(manual.id)!.summary).toBe('活动进度 51%')
  })
  it('keeps saved drafts private and publishes explicitly', async () => {
    const r = await call('user/blog/article/create', { title: 'Draft', content: 'not published', isDraft: true, visibility: 'public' }, auth())
    expect(r.json.data).toMatchObject({ isDraft: true, visibility: 'private' })
    expect((await call(`user/blog/article/get?id=${r.json.data.id}`)).status).toBe(404)
    const updated = await call('user/blog/article/update', { id: r.json.data.id, visibility: 'public' }, auth())
    expect(updated.json.data.isDraft).toBe(false)
    expect((await call(`user/blog/article/get?id=${r.json.data.id}`)).status).toBe(200)
  })
  it('lets the owner disable visitor likes', async () => {
    expect((await call('site/settings', { siteName: 'My site', likesEnabled: false }, auth())).status).toBe(200)
    expect((await call('user/blog/like', { articleId: article })).status).toBe(403)
    expect((await call('site/settings', undefined, auth())).json.data).toMatchObject({ siteName: 'My site', likesEnabled: false })
  })
  it('hashes passwords before HTTPS is configured, including plain HTTP environments', async () => {
    vi.stubGlobal('crypto', {})
    try { expect(await browserHash('test-password')).toBe(sha256Hex('test-password')) } finally { vi.unstubAllGlobals() }
  })
  it('namespaces cookies for independent instances and supports a trusted reverse proxy', () => {
    process.env.INSTANCE_ID = 'sec'; expect(cookieName('wind_token')).toBe('wind_token_sec')
    process.env.INSTANCE_ID = 'syc'; expect(cookieName('wind_token')).toBe('wind_token_syc')
    process.env.TRUST_PROXY = '1'
    expect(requestOrigin(new Request('http://localhost:3000', { headers: { 'x-forwarded-host': 'blog.example.test', 'x-forwarded-proto': 'https' } }))).toBe('https://blog.example.test')
    delete process.env.INSTANCE_ID; delete process.env.TRUST_PROXY
  })
})
