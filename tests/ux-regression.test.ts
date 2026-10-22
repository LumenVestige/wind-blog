import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dispatch } from '@/server/api/router'
import { closeDb, get } from '@/db'
import { sha256Hex } from '@/lib/password'
import { createArticle, serializeArticle, updateArticle } from '@/server/blog/articles'
import { createComment, deleteComment, listComments } from '@/server/blog/comments'
import { sha256Hex as browserHash } from '@/lib/api-client'
import { cookieName, requestOrigin } from '@/server/http'
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-ux-'))
let token = '', owner = 0, article = 0, guestCookie = '', guestComment = 0
async function call(p: string, body?: unknown, headers: Record<string, string> = {}) {
  const req = new Request('http://test.local/api/' + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const res = await dispatch(req as never, p.split('?')[0].split('/'))
  return { status: res.status, headers: res.headers, json: await res.json() }
}
const auth = () => ({ Authorization: `Bearer ${token}` })
beforeAll(async () => { process.env.DB_PATH = path.join(dir, 'test.db'); process.env.JWT_SECRET = 'ux-regression-secret-0123456789abcdef'; delete process.env.INSTANCE_ID; const r = await call('setup', { username: 'owner', email: 'owner@test.local', password: sha256Hex('long-owner-password') }); token = r.json.jwtToken; owner = r.json.data.user.id; article = (await call('user/blog/article/create', { title: 'Visible', content: 'Hello' }, auth())).json.data.id })
afterAll(() => { delete process.env.INSTANCE_ID; delete process.env.TRUST_PROXY; closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })
describe('single owner UX regressions', () => {
  it('lets visitors submit moderated comments without creating user accounts', async () => {
    const r = await call('user/blog/comment/create', { articleId: article, name: 'Reader', content: 'Hello owner' })
    expect(r.status).toBe(200); expect(r.json.data.status).toBe('pending'); expect(r.json.data.id).toBeLessThan(0)
    guestComment = r.json.data.id; guestCookie = r.headers.get('set-cookie')!.split(';')[0]
    expect((await call(`user/blog/comment/list?articleId=${article}`)).json.data.totalComments).toBe(0)
    expect(get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n).toBe(1)
    expect(get<{ comment_count: number }>('SELECT comment_count FROM blog_articles WHERE id = ?', article)!.comment_count).toBe(0)
  })
  it('requires the owner to approve pending comments and does not expose them via likes or replies', async () => {
    expect((await call('user/blog/comment/approve', { id: guestComment })).status).toBe(401)
    expect((await call('user/blog/comment/like', { commentId: guestComment }, { Cookie: guestCookie })).status).toBe(404)
    expect((await call('user/blog/comment/create', { articleId: article, name: 'Reader', content: 'reply', parentId: guestComment }, { Cookie: guestCookie })).status).toBe(404)
    expect((await call('user/blog/comment/approve', { id: guestComment }, auth())).status).toBe(200)
    await call('user/blog/comment/approve', { id: guestComment }, auth())
    expect((await call(`user/blog/comment/list?articleId=${article}`)).json.data.totalComments).toBe(1)
    expect(get<{ comment_count: number }>('SELECT comment_count FROM blog_articles WHERE id = ?', article)!.comment_count).toBe(1)
  })
  it('supports replies to visitor comments and deletes the complete mixed subtree', async () => {
    const reply = (await call('user/blog/comment/create', { articleId: article, content: 'Owner reply', parentId: guestComment }, auth())).json.data
    expect(reply.id).toBeLessThan(0)
    const list = listComments(article, { pageSize: 20 })
    expect(list.totalComments).toBe(2); expect(list.list[0].replies[0].author.id).toBe(owner)
    deleteComment(owner, guestComment)
    expect(listComments(article, {}).totalComments).toBe(0)
    expect(get<{ comment_count: number }>('SELECT comment_count FROM blog_articles WHERE id = ?', article)!.comment_count).toBe(0)
  })
  it('remembers anonymous article likes in a signed cookie and toggles exactly once', async () => {
    const one = await call('user/blog/like', { articleId: article }, { Cookie: guestCookie })
    expect(one.json.data).toMatchObject({ liked: true, likeCount: 1 })
    const two = await call('user/blog/like', { articleId: article }, { Cookie: guestCookie })
    expect(two.json.data).toMatchObject({ liked: false, likeCount: 0 })
  })
  it('retains article readability rules for anonymous interaction', async () => {
    const locked = (await call('user/blog/article/create', { title: 'Locked', content: 'secret', visibility: 'password', password: 'secret' }, auth())).json.data.id
    expect((await call('user/blog/like', { articleId: locked }, { Cookie: guestCookie })).status).toBe(403)
    const unlocked = await call('user/blog/article/unlock', { id: locked, password: 'secret' })
    const cookies = guestCookie + '; ' + unlocked.headers.get('set-cookie')!.split(';')[0]
    expect((await call('user/blog/comment/create', { articleId: locked, name: 'Reader', content: 'unlocked' }, { Cookie: cookies })).status).toBe(200)
  })
  it('keeps manual summaries through full editor updates and supports explicit cover removal', () => {
    const original = createArticle(owner, { title: 'Summary', content: 'old', summary: 'Manual excerpt', coverUrl: 'https://example.test/cover.png' })
    const updated = updateArticle(owner, original.id, { title: 'Updated', content: 'new body', coverUrl: '' })
    expect(updated.summary).toBe('Manual excerpt'); expect(updated.cover_url).toBe('')
    expect(serializeArticle(updated, { viewerId: owner }).summaryIsDefault).toBe(false)
    expect(updateArticle(owner, original.id, { content: 'auto body', autoSummary: true }).summary).toBe('auto body')
  })
  it('keeps saved drafts private and publishes explicitly', async () => {
    const r = await call('user/blog/article/create', { title: 'Draft', content: 'not published', isDraft: true, visibility: 'public' }, auth())
    expect(r.json.data).toMatchObject({ isDraft: true, visibility: 'private' })
    expect((await call(`user/blog/article/get?id=${r.json.data.id}`)).status).toBe(404)
    const updated = await call('user/blog/article/update', { id: r.json.data.id, visibility: 'public' }, auth())
    expect(updated.json.data.isDraft).toBe(false)
    expect((await call(`user/blog/article/get?id=${r.json.data.id}`)).status).toBe(200)
  })
  it('paginates root comments while counting their replies', () => {
    const row = createArticle(owner, { title: 'Many comments' })
    const first = createComment(owner, row.id, 'Root')
    createComment(owner, row.id, 'Reply', first.id)
    for (let i = 0; i < 51; i++) createComment(owner, row.id, `Root ${i}`)
    const a = listComments(row.id, { page: 1, pageSize: 50 }), b = listComments(row.id, { page: 2, pageSize: 50 })
    expect(a.total).toBe(52); expect(a.totalComments).toBe(53); expect(b.list).toHaveLength(2)
  })
  it('lets the owner disable visitor interaction while preserving existing comments', async () => {
    expect((await call('site/settings', { siteName: 'My site', commentsEnabled: false, likesEnabled: false }, auth())).status).toBe(200)
    expect((await call('user/blog/comment/create', { articleId: article, name: 'Reader', content: 'disabled' })).status).toBe(403)
    expect((await call('user/blog/like', { articleId: article })).status).toBe(403)
    expect((await call('site/settings', undefined, auth())).json.data).toMatchObject({ siteName: 'My site', commentsEnabled: false })
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
