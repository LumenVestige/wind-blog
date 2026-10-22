import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

type Dispatch = typeof import('@/server/api/router').dispatch

let dispatch: Dispatch
let dbFile: string
const tokens: Record<string, string> = {}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function call(
  method: string,
  p: string,
  opts: {
    token?: string
    body?: unknown
    form?: FormData
    headers?: Record<string, string>
  } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const [pathname] = p.split('?')
  const url = 'http://test.local/api' + p
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: BodyInit | undefined
  if (opts.form) {
    body = opts.form
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const req = new Request(url, { method, headers, body })
  const res = await dispatch(req as never, pathname.split('/').filter(Boolean))
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

async function register(
  username: string,
  password: string,
  email: string,
): Promise<string> {
  const res = await call('POST', '/user/auth/register', {
    body: { username, password: sha256(password), name: username, email },
  })
  expect(res.status).toBe(200)
  return (res.json.jwtToken as string) || ''
}

beforeAll(async () => {
  dbFile = path.join(os.tmpdir(), `wind-test-${Date.now()}-${Math.random()}.db`)
  process.env.DB_PATH = dbFile
  process.env.JWT_SECRET = 'api-test-secret-0123456789abcdef'
  process.env.CWXU_OBSIDIAN_PUBLISH_TOKEN = 'test-publish-token'
  const db = await import('@/db')
  db.getDb()
  const router = await import('@/server/api/router')
  dispatch = router.dispatch
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

describe('auth', () => {
  it('reports health', async () => {
    const res = await call('GET', '/health')
    expect(res.json.data).toMatchObject({ status: 'healthy' })
  })

  it('reports setup status and blocks duplicate initialization', async () => {
    const before = await call('GET', '/setup/status')
    expect(before.json.data).toMatchObject({ initialized: false })
    // first user is the single owner
    tokens.alice = await register('alice', 'password123', 'alice@test.local')
    const after = await call('GET', '/setup/status')
    expect(after.json.data).toMatchObject({ initialized: true })
    const dup = await call('POST', '/user/setup', {
      body: {
        username: 'bob',
        email: 'bob@test.local',
        name: 'bob',
        password: sha256('x'),
      },
    })
    expect(dup.status).toBe(403)
  })

  it('logs in with client SHA-256 password', async () => {
    expect(tokens.alice).toBeTruthy()
    const login = await call('POST', '/user/auth/login', {
      body: { username: 'alice', password: sha256('password123') },
    })
    expect(login.json.success).toBe(true)
    expect(typeof login.json.jwtToken).toBe('string')
    const bad = await call('POST', '/user/auth/login', {
      body: { username: 'alice', password: sha256('nope') },
    })
    expect(bad.json.code).not.toBe(0)
  })

  it('rejects unauthenticated profile access', async () => {
    const res = await call('GET', '/user/profile/me')
    expect(res.status).toBe(401)
  })
})

describe('blog lifecycle', () => {
  let articleId = 0
  let categoryId = 0

  it('activates the blog', async () => {
    const res = await call('POST', '/user/blog/activate', {
      token: tokens.alice,
      body: { accept: true },
    })
    expect(res.json.data).toMatchObject({ activated: true })
  })

  it('ensures a default category', async () => {
    const res = await call('GET', '/user/blog/category/mine', { token: tokens.alice })
    const list = (res.json.data as { list: { name: string; isDefault: boolean }[] }).list
    expect(list.some((c) => c.isDefault)).toBe(true)
    categoryId = (list[0] as unknown as { id: number }).id
  })

  it('creates an article and returns it', async () => {
    const res = await call('POST', '/user/blog/article/create', {
      token: tokens.alice,
      body: {
        title: 'My First Post',
        content: '# Intro\n\n![pic](https://cdn.test/blog/1/pic.png)\n\nhello world',
        tags: ['a', 'b'],
        visibility: 'public',
      },
    })
    expect(res.json.code).toBe(0)
    const data = res.json.data as Record<string, unknown>
    articleId = data.id as number
    expect(data.slug).toMatch(/^my-first-post-[a-z0-9]{6}$/)
    expect(data.canSeeBody).toBe(true)
  })

  it('lists my articles with tags (plugin shape)', async () => {
    const res = await call('GET', '/user/blog/article/mine?page=1&pageSize=10', {
      token: tokens.alice,
    })
    const data = res.json.data as { list: { id: number; tags: string[] }[]; total: number }
    expect(data.total).toBe(1)
    expect(data.list[0].tags).toContain('a')
  })

  it('exposes public author home + plaza', async () => {
    const home = await call('GET', '/user/blog/by-username?username=alice&pinnedFirst=true')
    const data = home.json.data as { list: unknown[]; activated: boolean; themeId: string }
    expect(data.activated).toBe(true)
    expect(data.list.length).toBe(1)
    const plaza = await call('GET', '/user/blog/plaza?sort=latest')
    expect((plaza.json.data as { total: number }).total).toBe(1)
  })

  it('serves article detail by slug', async () => {
    const res = await call('GET', `/user/blog/article/get?id=${articleId}`)
    const data = res.json.data as { content: string; tags: string[] }
    expect(data.content).toContain('# Intro')
    expect(data.tags).toContain('a')
  })

  it('supports password articles and unlock', async () => {
    const create = await call('POST', '/user/blog/article/create', {
      token: tokens.alice,
      body: { title: 'Secret', content: 'hidden', visibility: 'password', password: 'pw123' },
    })
    const id = (create.json.data as { id: number }).id
    const locked = await call('GET', `/user/blog/article/get?id=${id}`)
    const lockedData = locked.json.data as { canSeeBody: boolean; requiresPassword: boolean }
    expect(lockedData.canSeeBody).toBe(false)
    expect(lockedData.requiresPassword).toBe(true)
    const unlock = await call('POST', '/user/blog/article/unlock', {
      body: { id, password: 'pw123' },
    })
    expect((unlock.json.data as { canSeeBody: boolean; unlockToken: string }).canSeeBody).toBe(true)
    expect((unlock.json.data as { unlockToken: string }).unlockToken).toBeTruthy()
    const wrong = await call('POST', '/user/blog/article/unlock', {
      body: { id, password: 'bad' },
    })
    expect(wrong.json.code).not.toBe(0)
  })

  it('hides private articles from anonymous listing', async () => {
    await call('POST', '/user/blog/article/create', {
      token: tokens.alice,
      body: { title: 'Private Note', content: 'x', visibility: 'private' },
    })
    const anon = await call('GET', '/user/blog/by-username?username=alice')
    const titles = (anon.json.data as { list: { title: string }[] }).list.map((a) => a.title)
    expect(titles).not.toContain('Private Note')
    const owner = await call('GET', '/user/blog/by-username?username=alice', {
      token: tokens.alice,
    })
    const ownerTitles = (owner.json.data as { list: { title: string }[] }).list.map((a) => a.title)
    expect(ownerTitles).toContain('Private Note')
  })

  it('likes articles idempotently', async () => {
    const first = await call('POST', '/user/blog/like', {
      token: tokens.alice,
      body: { articleId },
    })
    expect(first.json.data).toMatchObject({ liked: true, likeCount: 1 })
    const second = await call('POST', '/user/blog/like', {
      token: tokens.alice,
      body: { articleId },
    })
    expect(second.json.data).toMatchObject({ liked: false, likeCount: 0 })
  })

  it('creates and lists comments', async () => {
    const create = await call('POST', '/user/blog/comment/create', {
      token: tokens.alice,
      body: { articleId, content: 'nice post' },
    })
    expect(create.json.code).toBe(0)
    const list = await call('GET', `/user/blog/comment/list?articleId=${articleId}`)
    const data = list.json.data as { list: { content: string }[]; total: number }
    expect(data.total).toBe(1)
    expect(data.list[0].content).toBe('nice post')
  })

  it('saves theme config after activation', async () => {
    const res = await call('POST', '/user/blog/theme/config', {
      token: tokens.alice,
      body: {
        themeId: 'chirpy',
        colorScheme: 'dark',
        subtitle: 'hello',
        socialLinks: [{ type: 'github', url: 'https://github.com/alice' }],
      },
    })
    expect(res.json.data).toMatchObject({ themeId: 'chirpy', colorScheme: 'dark' })
    const status = await call('GET', '/user/blog/theme/status?username=alice')
    expect((status.json.data as { themeId: string }).themeId).toBe('chirpy')
  })

  it('creates nav pages and exposes them publicly', async () => {
    await call('POST', '/user/blog/page/create', {
      token: tokens.alice,
      body: { title: 'About Me', contentMd: 'hi', status: 'published', showInNav: true },
    })
    const pub = await call('GET', '/user/blog/page/list?username=alice')
    expect((pub.json.data as unknown[]).length).toBe(1)
  })

  it('checks image asset existence', async () => {
    const res = await call('POST', '/user/blog/images/check', {
      token: tokens.alice,
      body: { urls: ['https://cdn.test/blog/1/pic.png'], hashes: [] },
    })
    const data = res.json.data as { missing: string[] }
    expect(data.missing.length).toBe(1)
  })

  it('refuses blog image upload when UpYun is not configured', async () => {
    const form = new FormData()
    form.append('purpose', 'blog')
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'x.png')
    const res = await call('POST', '/user/upload', { token: tokens.alice, form })
    expect(res.status).toBe(403)
  })
})

describe('obsidian plugin contract', () => {
  it('returns latest version metadata envelope', async () => {
    const res = await call('GET', '/user/blog/obsidian-plugin/latest')
    expect(res.json.code).toBe(0)
    expect(res.json.data).toHaveProperty('version')
    expect(res.json.data).toHaveProperty('downloadBase')
  })

  it('publishes a new version with the publish token', async () => {
    const res = await call('POST', '/user/blog/obsidian-plugin/publish', {
      headers: { 'X-Plugin-Publish-Token': 'test-publish-token' },
      body: { version: '1.2.3', minAppVersion: '1.4.0', downloadBase: 'https://cdn/x/1.2.3' },
    })
    expect(res.json.code).toBe(0)
    const latest = await call('GET', '/user/blog/obsidian-plugin/latest')
    expect((latest.json.data as { version: string }).version).toBe('1.2.3')
  })

  it('rejects publish without a valid token', async () => {
    const res = await call('POST', '/user/blog/obsidian-plugin/publish', {
      body: { version: '9.9.9' },
    })
    expect(res.status).toBe(401)
  })
})

describe('admin (single owner)', () => {
  it('requires authentication', async () => {
    const res = await call('GET', '/user/blog/admin/overview')
    expect(res.status).toBe(401)
  })

  it('allows the owner to moderate', async () => {
    const overview = await call('GET', '/user/blog/admin/overview', { token: tokens.alice })
    expect(overview.json.code).toBe(0)
    const articles = await call('GET', '/user/blog/admin/articles', { token: tokens.alice })
    const list = (articles.json.data as { list: { id: number; visibility: string }[] }).list
    const publicArticle = list.find((article) => article.visibility === 'public')!
    const mod = await call('POST', '/user/blog/admin/moderate', {
      token: tokens.alice,
      body: { id: publicArticle.id, action: 'feature' },
    })
    expect(mod.json.data).toMatchObject({ recommend: true })
  })
})
