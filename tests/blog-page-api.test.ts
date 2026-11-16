import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb, get, run } from '@/db'
import { seedAdmin } from '@/db/seed'
import { siteOwner } from '@/server/tenant'
import { createArticle, getArticleById, makeUnlockToken } from '@/server/blog/articles'
import { createCategory } from '@/server/blog/categories'
import { createPage } from '@/server/blog/pages'
import { articleRevision } from '@/server/blog/article-render'
import { dispatch } from '@/server/api/router'
import { cookieName } from '@/server/http'
import { passwordTag, signToken } from '@/lib/jwt'
import { setSettings } from '@/lib/settings'
import { homePageData } from '@/server/blog/page-data'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-json-pages-'))
let owner = 0, token = '', publicId = 0, lockedId = 0, categoryId = 0
const views = (id: number) => get<{ view_count: number }>('SELECT view_count FROM blog_articles WHERE id = ?', id)!.view_count
async function page(href: string, headers: Record<string, string> = {}) {
  const response = await dispatch(new Request(`http://test.local/api/blog/page?${new URLSearchParams({ href })}`, { headers }) as never, ['blog', 'page'])
  return { response, json: await response.json() }
}

beforeAll(async () => {
  process.env.DB_PATH = path.join(dir, 'test.db')
  process.env.JWT_SECRET = 'json-page-test-secret-0123456789abcdef'
  process.env.ADMIN_PASSWORD = 'unique-json-page-password'
  seedAdmin()
  const user = siteOwner(); owner = user.id
  token = await signToken({ id: owner, username: user.username, isAdmin: true, passwordTag: passwordTag(user.password) })
  categoryId = createCategory(owner, 'Android').id
  publicId = createArticle(owner, { slug: 'android-first', title: 'Android First', content: '# Details\n\n**Full JSON article**', categoryId, tags: ['Android', 'Framework'] }).id
  createArticle(owner, { slug: 'android-second', title: 'Android Second', content: 'Other article', categoryId, tags: ['Android'] })
  createArticle(owner, { slug: 'other-post', title: 'Other Post', content: 'Android in the body only', tags: ['Framework'] })
  createArticle(owner, { slug: 'hidden-post', title: 'Private', content: 'Private secret', visibility: 'private' })
  lockedId = createArticle(owner, { slug: 'locked-post', title: 'Locked', content: '# Protected\n\nLocked secret', visibility: 'password', password: 'secret' }).id
  createPage(owner, { slug: 'contact', title: 'Contact', contentMd: '**Contact body**', status: 'published' })
  createPage(owner, { slug: 'draft-page', title: 'Draft', contentMd: 'Draft secret', status: 'draft' })
})
afterAll(() => { closeDb(); fs.rmSync(dir, { recursive: true, force: true }) })

describe('blog JSON data for SPA navigation and prefetch', () => {
  it('uses the same saved home layout for SSR and JSON filtering and pagination', async () => {
    const hrefs = ['/', '/?sort=hot', `/?categoryId=${categoryId}&tag=Android&page=2`, '/?q=Android&pageSize=24']
    expect(homePageData(new URLSearchParams()).homeLayout).toBe('double')
    expect((await page('/')).json.data.page.homeLayout).toBe('double')
    for (const homeLayout of ['single', 'double']) {
      setSettings({ home_layout: homeLayout })
      for (const href of hrefs) {
        const data = homePageData(new URL(href, 'http://test.local').searchParams)
        expect(data.homeLayout).toBe(homeLayout)
        expect((await page(href)).json.data.page).toEqual(JSON.parse(JSON.stringify(data)))
      }
    }
    setSettings({ home_layout: 'unknown-legacy-value' })
    expect(homePageData(new URLSearchParams()).homeLayout).toBe('double')
    expect((await page('/')).json.data.page.homeLayout).toBe('double')
    setSettings({ home_layout: 'double' })
  })

  it('returns full article data in a private JSON envelope without counting prefetches', async () => {
    const before = views(publicId)
    for (let index = 0; index < 2; index++) {
      const { response, json } = await page('/android-first')
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(json.code).toBe(0)
      expect(json.data.page.kind).toBe('article')
      expect(json.data.page.reader.article.html).toContain('<strong>Full JSON article</strong>')
      expect(json.data.page.reader.toc.some((item: { text: string }) => item.text === 'Details')).toBe(true)
      expect(json.data.page.reader.revision).toBe(articleRevision(getArticleById(publicId)!.content))
      expect(json.data.page.reader.article.updatedAt).toBeTypeOf('number')
      expect(JSON.stringify(json)).not.toContain('password_hash')
    }
    expect(views(publicId)).toBe(before)
  })

  it('counts only after the client opens a successfully prefetched article', async () => {
    const { json } = await page('/android-first')
    const reader = json.data.page.reader
    const before = views(publicId)
    const response = await dispatch(new Request('http://test.local/api/blog/article/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: publicId, updatedAt: reader.article.updatedAt, revision: reader.revision }),
    }) as never, ['blog', 'article', 'read'])
    expect(response.status).toBe(200)
    expect(views(publicId)).toBe(before + 1)
  })

  it('preserves multi-tag AND filters, search, sort and valid pagination totals', async () => {
    const filtered = (await page(`/?categoryId=${categoryId}&tag=Android&tag=Framework&page=999`)).json.data.page
    expect(filtered.list.map((article: { id: number }) => article.id)).toEqual([publicId])
    expect(filtered.total).toBe(1); expect(filtered.page).toBe(1)
    expect(filtered.tags).toEqual(['Android', 'Framework'])
    const search = (await page('/?q=Android&sort=hot')).json.data.page
    expect(search.total).toBe(2); expect(search.sort).toBe('hot')
    expect(search.list[0].id).toBe(publicId)
    expect(search.list[0].summaryHtml).toBeTypeOf('string')
  })

  it('returns filtered archives, categories, static listings and formatted custom pages', async () => {
    const archive = (await page(`/archives?categoryId=${categoryId}&tag=Framework`)).json.data.page
    expect(archive.kind).toBe('archives'); expect(archive.categoryName).toBe('Android')
    expect(archive.list.map((article: { id: number }) => article.id)).toEqual([publicId])
    expect((await page('/categories')).json.data.page.list.some((category: { id: number }) => category.id === categoryId)).toBe(true)
    expect((await page('/static')).json.data.page.kind).toBe('static')
    expect((await page('/p/contact')).json.data.page).toMatchObject({ kind: 'page', title: 'Contact', html: expect.stringContaining('<strong>Contact body</strong>') })
  })

  it('enforces the same private, password and draft access rules as initial SSR', async () => {
    expect((await page('/hidden-post')).response.status).toBe(404)
    const locked = (await page('/locked-post')).json.data.page.reader
    expect(locked.article.requiresPassword).toBe(true); expect(locked.article.html).toBe('')
    expect(locked.toc).toEqual([]); expect(locked.adjacent).toEqual({ prev: null, next: null })
    expect(views(lockedId)).toBe(0)
    const cookie = `${cookieName(`wind_unlock_${lockedId}`)}=${makeUnlockToken(lockedId, getArticleById(lockedId)!.password_hash)}`
    expect((await page('/locked-post', { Cookie: cookie })).json.data.page.reader.article.html).toContain('Locked secret')
    expect((await page('/hidden-post', { Authorization: `Bearer ${token}` })).json.data.page.reader.article.html).toContain('Private secret')
    expect((await page('/p/draft-page')).response.status).toBe(404)
    expect((await page('/p/draft-page', { Authorization: `Bearer ${token}` })).json.data.page.title).toBe('Draft（草稿预览）')
  })

  it('returns JSON errors for unknown routes and resolves legacy navigation without a document redirect', async () => {
    expect((await page('/missing-post')).response.status).toBe(404)
    expect((await page('https://other.local')).response.status).toBe(400)
    const about = createArticle(owner, { slug: 'about-author', title: 'About', content: 'About content', visibility: 'unlisted' })
    setSettings({ about_article_id: String(about.id), navigation_articles_migrated: String(owner) })
    expect((await page('/about')).json.data).toMatchObject({ href: '/about-author', page: { kind: 'article' } })
    run('DELETE FROM blog_articles WHERE id = ?', about.id)
  })
})
