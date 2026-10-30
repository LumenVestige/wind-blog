import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb, get, run } from '@/db'
import { sha256Hex } from '@/lib/password'
import { setSettings } from '@/lib/settings'
import { dispatch } from '@/server/api/router'
import { createArticle, updateArticle, deleteArticle, getArticleById, listByUsername, adjacentArticles, pinArticle } from '@/server/blog/articles'
import { navigationArticles, navigationArticleIds } from '@/server/blog/navigation'
import { listTagsPublic } from '@/server/blog/tags'
import { ensureSiteConfig } from '@/server/blog/site'
import { manageSettingsSnapshot } from '@/server/manage-settings'
import AboutPage from '@/app/(site)/about/page'
import FriendsPage from '@/app/(site)/friends/page'

vi.mock('next/navigation', () => ({
  notFound() { throw new Error('NOT_FOUND') },
  redirect(href: string) { throw new Error(`REDIRECT:${href}`) },
}))
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-navigation-'))
let owner = 0, token = ''
async function call(endpoint: string, body?: unknown, authenticated = false) {
  const response = await dispatch(new Request(`http://test.local/api/${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never, endpoint.split('?')[0].split('/'))
  return { status: response.status, json: await response.json() }
}
async function save(aboutArticleId: number, friendsArticleId = 0, version?: string) {
  return call('manage/settings', { section: 'content', values: { aboutArticleId, friendsArticleId }, version: version || manageSettingsSnapshot(owner).content.version }, true)
}
beforeAll(async () => {
  process.env.DB_PATH = path.join(dir, 'test.db')
  process.env.JWT_SECRET = 'navigation-test-secret-0123456789abcdef'
  const setup = await call('setup', { username: 'owner', email: 'owner@test.local', password: sha256Hex('navigation-password-123') })
  owner = setup.json.data.user.id
  token = setup.json.jwtToken
})
beforeEach(() => {
  run('DELETE FROM blog_articles')
  ensureSiteConfig(owner)
  run("UPDATE blog_site_configs SET about_md = '', friends_md = '', home_intro_md = '' WHERE user_id = ?", owner)
  setSettings({ about_article_id: '0', friends_article_id: '0', navigation_articles_migrated: String(owner) })
})
afterAll(() => { closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })

describe('article-backed navigation', () => {
  it('starts without default pages and removes legacy Markdown from management content settings', () => {
    expect(navigationArticles(owner)).toEqual({ about: null, friends: null })
    expect(manageSettingsSnapshot(owner).content.values).toEqual({ aboutArticleId: 0, friendsArticleId: 0 })
    expect(() => AboutPage()).toThrow('NOT_FOUND')
    expect(() => FriendsPage()).toThrow('NOT_FOUND')
  })

  it('makes linked articles link-only and sends compatibility entries to their canonical article URLs', async () => {
    const about = createArticle(owner, { title: '关于我', slug: 'about-me', content: '关于正文' })
    const friends = createArticle(owner, { title: '我的朋友', slug: 'my-friends', content: '友链正文' })
    expect((await save(about.id, friends.id)).status).toBe(200)
    expect(getArticleById(about.id)?.visibility).toBe('unlisted')
    expect(navigationArticles(owner)).toMatchObject({ about: { id: about.id, slug: about.slug }, friends: { id: friends.id, slug: friends.slug } })
    expect(Object.getPrototypeOf(navigationArticles(owner).about)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(navigationArticles(owner).friends)).toBe(Object.prototype)
    expect(() => AboutPage()).toThrow('REDIRECT:/about-me')
    expect(() => FriendsPage()).toThrow('REDIRECT:/my-friends')
    const read = await call('user/blog/article/get?username=owner&slug=about-me')
    expect(read.json.data).toMatchObject({ content: '关于正文', canSeeBody: true, requiresPassword: false, visibility: 'unlisted', viewCount: 1 })
  })

  it('keeps link-only content out of public lists, search, tags and neighboring articles', async () => {
    const regular = createArticle(owner, { title: '正常博客', slug: 'regular', content: '普通正文' })
    const hidden = createArticle(owner, { title: '独立入口关键词', slug: 'hidden', content: '可直接阅读', visibility: 'unlisted', tags: ['hidden-only'] })
    expect(listByUsername('owner', { page: 1, pageSize: 20 }).list.map((row) => row.id)).toEqual([regular.id])
    expect(listByUsername('owner', { keyword: '独立入口关键词' }).total).toBe(0)
    expect(listTagsPublic('owner')).toEqual([])
    expect(adjacentArticles(regular)).toEqual({ prev: null, next: null })
    expect(() => pinArticle(owner, hidden.id, true)).toThrow()
    const prefetched = await call('user/blog/article/prefetch?slug=hidden')
    expect(prefetched.json.data.content).toBe('可直接阅读')
    expect(getArticleById(hidden.id)?.view_count).toBe(0)
    const opened = await call('user/blog/article/view', { id: hidden.id, updatedAt: prefetched.json.data.updatedAt })
    expect(opened.json.data.viewCount).toBe(1)
  })

  it('retains link-only visibility across slug edits and old-client republishes; private/deleted pages lose their entry', async () => {
    const about = createArticle(owner, { title: '关于', slug: 'author-page' })
    await save(about.id)
    updateArticle(owner, about.id, { slug: 'new-author-page', visibility: 'public', content: '更新正文' })
    expect(getArticleById(about.id)?.visibility).toBe('unlisted')
    expect(navigationArticles(owner).about?.slug).toBe('new-author-page')
    updateArticle(owner, about.id, { visibility: 'private' })
    expect(navigationArticles(owner).about).toBeNull()
    expect((await call('user/blog/article/get?username=owner&slug=new-author-page')).status).toBe(404)
    updateArticle(owner, about.id, { visibility: 'public' })
    expect(navigationArticles(owner).about?.id).toBe(about.id)
    deleteArticle(owner, about.id)
    expect(navigationArticles(owner).about).toBeNull()
  })

  it('rejects inaccessible or foreign article bindings atomically', async () => {
    const publicArticle = createArticle(owner, { title: '公开文章' })
    const privateArticle = createArticle(owner, { title: '私密文章', visibility: 'private' })
    const draft = createArticle(owner, { title: '草稿', isDraft: true })
    const locked = createArticle(owner, { title: '密码文章', visibility: 'password', password: 'secret' })
    const pending = createArticle(owner, { title: '未审核文章' })
    run("UPDATE blog_articles SET moderation_status = 'pending' WHERE id = ?", pending.id)
    const foreignOwner = run("INSERT INTO users (username, name, email, password) VALUES ('other', 'Other', 'other@test.local', 'unused')").lastInsertRowid
    const foreign = createArticle(foreignOwner, { title: '别人的文章' })
    for (const id of [privateArticle.id, draft.id, locked.id, pending.id, foreign.id, 999999]) {
      expect((await save(publicArticle.id, id)).status).toBe(400)
      expect(getArticleById(publicArticle.id)?.visibility).toBe('public')
      expect(navigationArticleIds(owner)).toEqual({ aboutArticleId: 0, friendsArticleId: 0 })
    }
  })

  it('honors module versions and does not publish a detached page into the feed', async () => {
    const about = createArticle(owner, { title: 'About' })
    const baseline = manageSettingsSnapshot(owner).content.version
    expect((await save(about.id)).status).toBe(200)
    expect((await save(0, 0, baseline)).status).toBe(409)
    expect((await save(0)).status).toBe(200)
    expect(navigationArticles(owner).about).toBeNull()
    expect(getArticleById(about.id)?.visibility).toBe('unlisted')
  })

  it('preserves authored legacy pages exactly once without restoring the removed homepage introduction', () => {
    run("DELETE FROM site_settings WHERE key IN ('about_article_id', 'friends_article_id', 'navigation_articles_migrated')")
    run('UPDATE blog_site_configs SET about_md = ?, friends_md = ?, home_intro_md = ? WHERE user_id = ?', '# 旧关于\n\n我的介绍', '# 旧友链\n\n朋友们', '# 旧首页介绍', owner)
    const first = navigationArticleIds(owner)
    expect(first.aboutArticleId).toBeGreaterThan(0)
    expect(first.friendsArticleId).toBeGreaterThan(0)
    expect(getArticleById(first.aboutArticleId)).toMatchObject({ content: '# 旧关于\n\n我的介绍', visibility: 'unlisted' })
    expect(navigationArticleIds(owner)).toEqual(first)
    expect(get<{ c: number }>('SELECT COUNT(*) AS c FROM blog_articles')?.c).toBe(2)
    expect(listByUsername('owner', {}).total).toBe(0)
  })
})
