/**
 * Wind Blog migration tool (old site → new site).
 *
 * Usage:
 *   npm run migrate -- \
 *     --old-url https://algo.example.com --old-username alice --old-password secret \
 *     --new-url http://localhost:3000 --new-username alice --new-password secret
 *
 * Options:
 *   --new-register            register the new account if login fails
 *   --password-articles=private|skip|keep
 *   --include-comments        also migrate comments (attributed to the target account)
 *   --rewrite-domain old=new  rewrite image URL host from old CDN to new CDN
 *   --dry-run                 print the plan without writing anything
 *
 * Images/static-site files are NOT migrated (by design). Article body image URLs
 * are kept as-is unless --rewrite-domain is given.
 */
import crypto from 'node:crypto'

const API = '/api'

interface Args {
  oldUrl: string
  oldUsername: string
  oldPassword: string
  newUrl: string
  newUsername: string
  newPassword: string
  newRegister: boolean
  passwordArticles: 'private' | 'skip' | 'keep'
  includeComments: boolean
  rewriteDomain?: [string, string]
  dryRun: boolean
}

export function parseArgs(argv: string[]): Args {
  const map: Record<string, string> = {}
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      flags.add(key)
    } else {
      map[key] = next
      i++
    }
  }
  const oldUrl = (map['old-url'] || '').replace(/\/$/, '')
  const newUrl = (map['new-url'] || '').replace(/\/$/, '')
  if (!oldUrl || !newUrl) {
    console.error('缺少 --old-url / --new-url')
    process.exit(1)
  }
  if (!map['old-username'] || !map['old-password']) {
    console.error('缺少 --old-username / --old-password')
    process.exit(1)
  }
  let rewriteDomain: [string, string] | undefined
  if (map['rewrite-domain']) {
    const [from, to] = map['rewrite-domain'].split('=')
    if (from && to) rewriteDomain = [from.replace(/\/$/, ''), to.replace(/\/$/, '')]
  }
  const pwMode = (map['password-articles'] || 'private') as Args['passwordArticles']
  return {
    oldUrl,
    oldUsername: map['old-username'],
    oldPassword: map['old-password'],
    newUrl,
    newUsername: map['new-username'] || map['old-username'],
    newPassword: map['new-password'] || map['old-password'],
    newRegister: flags.has('new-register'),
    passwordArticles: ['private', 'skip', 'keep'].includes(pwMode) ? pwMode : 'private',
    includeComments: flags.has('include-comments'),
    rewriteDomain,
    dryRun: flags.has('dry-run'),
  }
}

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

class RemoteClient {
  private token = ''
  constructor(private baseUrl: string) {}

  async login(username: string, password: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}${API}/user/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: sha256Hex(password) }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      jwtToken?: string
      success?: boolean
      message?: string
    }
    if (res.ok && json.jwtToken) {
      this.token = json.jwtToken
      return true
    }
    return false
  }

  async register(username: string, password: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}${API}/user/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: sha256Hex(password),
        name: username,
        email: `${username}@wind-blog.local`,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { jwtToken?: string }
    if (res.ok && json.jwtToken) {
      this.token = json.jwtToken
      return true
    }
    return false
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    let url = `${this.baseUrl}${API}${path}`
    if (opts.query) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
      }
      const s = qs.toString()
      if (s) url += (url.includes('?') ? '&' : '?') + s
    }
    const headers: Record<string, string> = {}
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    let body: string | undefined
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    const res = await fetch(url, { method, headers, body })
    const json = (await res.json().catch(() => ({}))) as {
      code?: number
      message?: string
      data?: unknown
    }
    if (!res.ok || (typeof json.code === 'number' && json.code !== 0)) {
      throw new Error(
        `${method} ${path} 失败：${json.message || `HTTP ${res.status}`}`,
      )
    }
    return (json.data ?? json) as T
  }

  get<T>(path: string, query?: Record<string, unknown>) {
    return this.request<T>('GET', path, { query })
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body })
  }
}

/** A source password hash cannot be recreated without its plaintext password. */
export function migrationVisibility(visibility: string, mode: Args['passwordArticles'], targetVisibility?: string): string {
  if (visibility !== 'password') return visibility
  return mode === 'keep' && targetVisibility === 'password' ? 'password' : 'private'
}

interface OldArticle {
  id: number
  slug: string
  title: string
  summary: string
  content?: string
  coverUrl?: string
  visibility: string
  categoryId: number | null
  tags?: string[]
  recommend?: boolean
  syncToMainProfile?: boolean
  publishedAt?: number
}
interface OldCategory {
  id: number
  name: string
  sortOrder: number
  isDefault: boolean
}
interface OldPage {
  id: number
  title: string
  slug: string
  contentMd: string
  status: string
  showInNav: boolean
  navLabel: string
  navOrder: number
}
interface OldTheme {
  themeId: string
  colorScheme: string
  subtitle: string
  socialLinks: { type: string; url: string; label?: string }[]
  aboutMd: string
  homeIntroMd: string
  friendsMd: string
}

export function rewriteImages(text: string, args: Pick<Args, 'rewriteDomain'>): string {
  if (!args.rewriteDomain) return text
  const [from, to] = args.rewriteDomain
  return text.split(from).join(to)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log('=== Wind Blog 迁移 ===')
  console.log(`旧站：${args.oldUrl}  (账号 ${args.oldUsername})`)
  console.log(`新站：${args.newUrl}  (账号 ${args.newUsername})`)
  if (args.dryRun) console.log('模式：dry-run（不写入）')

  const oldClient = new RemoteClient(args.oldUrl)
  if (!(await oldClient.login(args.oldUsername, args.oldPassword))) {
    console.error('旧站登录失败，请检查地址与账号密码')
    process.exit(1)
  }
  console.log('✓ 旧站登录成功')

  const newClient = new RemoteClient(args.newUrl)
  let loggedIn = await newClient.login(args.newUsername, args.newPassword)
  if (!loggedIn && args.newRegister) {
    loggedIn = await newClient.register(args.newUsername, args.newPassword)
    console.log(loggedIn ? '✓ 新站注册成功' : '✗ 新站注册失败')
  }
  if (!loggedIn) {
    console.error('新站登录失败（可用 --new-register 自动注册）')
    process.exit(1)
  }
  console.log('✓ 新站登录成功')

  // ---- pull data ----
  const oldCategories =
    (await oldClient.get<{ list: OldCategory[] }>('/user/blog/category/mine'))?.list || []
  const oldPages = (await oldClient.get<OldPage[]>('/user/blog/page/mine')) || []
  let oldTheme: OldTheme | null = null
  try {
    oldTheme = await oldClient.get<OldTheme>('/user/blog/theme/status')
  } catch {
    oldTheme = null
  }

  const articles: OldArticle[] = []
  for (let page = 1; page <= 50; page++) {
    const data = await oldClient.get<{ list: OldArticle[]; total: number }>(
      '/user/blog/article/mine',
      { page, pageSize: 50 },
    )
    const list = data?.list || []
    if (!list.length) break
    articles.push(...list)
    if (list.length < 50) break
  }
  // fetch full content for each article
  for (const a of articles) {
    try {
      const full = await oldClient.get<OldArticle>('/user/blog/article/get', { id: a.id })
      a.content = full.content ?? ''
      a.coverUrl = full.coverUrl ?? a.coverUrl
      a.tags = full.tags ?? a.tags
    } catch {
      a.content = a.content ?? ''
    }
  }
  console.log(
    `拉取完成：${articles.length} 篇文章 / ${oldCategories.length} 分类 / ${oldPages.length} 页面`,
  )

  if (args.dryRun) {
    console.log('dry-run 结束，未写入任何数据。')
    return
  }

  // ---- categories ----
  const catMap = new Map<number, number>() // old id -> new id
  for (const c of oldCategories) {
    try {
      const created = await newClient.post<{ id: number }>('/user/blog/category/create', {
        name: c.name,
        sortOrder: c.sortOrder,
      })
      catMap.set(c.id, created.id)
    } catch (e) {
      console.warn(`  分类「${c.name}」创建失败（可能已存在）：${(e as Error).message}`)
    }
  }
  console.log(`✓ 分类完成（${catMap.size}）`)

  // ---- articles ----
  let created = 0
  let updated = 0
  let skipped = 0
  for (const a of articles) {
    if (a.visibility === 'password' && args.passwordArticles === 'skip') {
      skipped++
      continue
    }
    let visibility = a.visibility
    let password: string | undefined
    if (a.visibility === 'password' && args.passwordArticles === 'private') {
      visibility = 'private'
    }
    const body = {
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      recommend: a.recommend,
      content: rewriteImages(a.content || '', args),
      coverUrl: a.coverUrl ? rewriteImages(a.coverUrl, args) : undefined,
      visibility,
      password,
      clearPassword: visibility !== 'password',
      categoryId: a.categoryId && catMap.has(a.categoryId) ? catMap.get(a.categoryId) : null,
      tags: a.tags || [],
      syncToMainProfile: a.syncToMainProfile !== false,
    }
    try {
      let existingId = 0
      let targetVisibility: string | undefined
      try {
        const existing = await newClient.get<{ id: number; visibility: string }>('/user/blog/article/get', {
          username: args.newUsername,
          slug: a.slug,
        })
        existingId = existing?.id || 0
        targetVisibility = existing?.visibility
      } catch {
        existingId = 0
      }
      body.visibility = migrationVisibility(a.visibility, args.passwordArticles, targetVisibility)
      body.clearPassword = body.visibility !== 'password'
      if (a.visibility === 'password' && args.passwordArticles === 'keep' && body.visibility === 'private') {
        console.warn(`  文章「${a.title}」缺少可保留的目标密码，已安全转为私密`)
      }
      if (existingId) {
        await newClient.post('/user/blog/article/update', { ...body, id: existingId })
        updated++
      } else {
        await newClient.post('/user/blog/article/create', body)
        created++
      }
    } catch (e) {
      console.warn(`  文章「${a.title}」迁移失败：${(e as Error).message}`)
      skipped++
    }
    process.stdout.write(`\r  文章进度 ${created + updated}/${articles.length}`)
  }
  console.log(`\n✓ 文章完成（新建 ${created} / 更新 ${updated} / 跳过 ${skipped}）`)

  // ---- pages ----
  let pageCount = 0
  for (const p of oldPages) {
    try {
      await newClient.post('/user/blog/page/create', {
        title: p.title,
        slug: p.slug,
        contentMd: rewriteImages(p.contentMd || '', args),
        status: p.status,
        showInNav: p.showInNav,
        navLabel: p.navLabel,
        navOrder: p.navOrder,
      })
      pageCount++
    } catch (e) {
      console.warn(`  页面「${p.title}」迁移失败：${(e as Error).message}`)
    }
  }
  console.log(`✓ 页面完成（${pageCount}）`)

  // ---- theme ----
  if (oldTheme) {
    try {
      await newClient.post('/user/blog/activate', { accept: true })
      await newClient.post('/user/blog/theme/config', {
        themeId: oldTheme.themeId,
        colorScheme: oldTheme.colorScheme,
        subtitle: oldTheme.subtitle,
        socialLinks: oldTheme.socialLinks,
        aboutMd: rewriteImages(oldTheme.aboutMd || '', args),
        homeIntroMd: rewriteImages(oldTheme.homeIntroMd || '', args),
        friendsMd: rewriteImages(oldTheme.friendsMd || '', args),
      })
      const verify = await newClient.get<OldTheme>('/user/blog/theme/status')
      console.log(
        `✓ 主题与站点设置完成（themeId=${verify?.themeId || oldTheme.themeId}）`,
      )
    } catch (e) {
      console.warn(`  主题迁移失败：${(e as Error).message}`)
    }
  }

  // ---- comments (optional) ----
  if (args.includeComments) {
    let cCount = 0
    for (const a of articles) {
      try {
        const newArticle = await newClient.get<{ id: number; visibility: string }>('/user/blog/article/get', {
          username: args.newUsername,
          slug: a.slug,
        })
        if (!newArticle?.id) continue
        const list = await oldClient.get<{ list: OldComment[] }>('/user/blog/comment/list', {
          articleId: a.id,
          page: 1,
          pageSize: 100,
        })
        for (const top of list?.list || []) {
          await newClient.post('/user/blog/comment/create', {
            articleId: newArticle.id,
            content: top.content,
          })
          cCount++
        }
      } catch {
        /* ignore */
      }
    }
    console.log(`✓ 评论完成（${cCount}，顶层评论归到目标账号）`)
  }

  console.log('\n=== 迁移完成 ===')
  console.log(`访问你的博客：${args.newUrl}/`)
}

interface OldComment {
  id: number
  content: string
}

export { RemoteClient, main }

const invokedDirectly = process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
