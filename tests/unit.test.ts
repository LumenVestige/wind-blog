import { describe, it, expect, beforeAll } from 'vitest'
import {
  hashAccessPassword,
  hashClientPassword,
  sha256Hex,
  verifyAccessPassword,
  verifyClientPassword,
} from '@/lib/password'
import { isValidSlug, isValidUsername, slugify, uniqueSlug } from '@/lib/slug'
import {
  buildSummary,
  extractHeadings,
  extractImageKeys,
  extractImageUrls,
  plainTextFromMarkdown,
  renderMarkdown,
  renderSummaryMarkdown,
} from '@/lib/markdown'
import { signToken, verifyToken } from '@/lib/jwt'
import { makeUnlockToken, verifyUnlockToken } from '@/server/blog/articles'
import { migrationVisibility, parseArgs, rewriteImages } from '../scripts/migrate'

beforeAll(() => {
  process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef'
})

describe('password', () => {
  it('hashes and verifies client password hashes', () => {
    const clientHash = sha256Hex('hunter2')
    const stored = hashClientPassword(clientHash)
    expect(stored).not.toBe(clientHash)
    expect(verifyClientPassword(stored, clientHash)).toBe(true)
    expect(verifyClientPassword(stored, sha256Hex('wrong'))).toBe(false)
  })

  it('rejects malformed client hashes', () => {
    expect(() => hashClientPassword('not-a-hash')).toThrow()
    expect(verifyClientPassword('x', 'zzz')).toBe(false)
  })

  it('hashes and verifies article access passwords', () => {
    const stored = hashAccessPassword('open-sesame')
    expect(verifyAccessPassword(stored, 'open-sesame')).toBe(true)
    expect(verifyAccessPassword(stored, 'nope')).toBe(false)
    expect(verifyAccessPassword('', 'x')).toBe(false)
  })
})

describe('slug', () => {
  it('slugifies titles', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('Agent 系列 Part2. MCP与Skills')).toBe('agent-part2-mcp-skills')
    expect(slugify('  中文 标题 ')).toBe('post')
    expect(slugify('')).toBe('post')
  })
  it('validates slugs and usernames', () => {
    expect(isValidSlug('abc-123')).toBe(true)
    expect(isValidSlug('Bad Slug')).toBe(false)
    expect(isValidUsername('alice_01')).toBe(true)
    expect(isValidUsername('a')).toBe(false)
  })
  it('resolves unique slugs', () => {
    const taken = new Set(['post', 'post-2'])
    expect(uniqueSlug('post', (s) => taken.has(s))).toBe('post-3')
  })
})

describe('markdown', () => {
  it('renders markdown to sanitized html with heading anchors', () => {
    const html = renderMarkdown('# Title\n\n<script>alert(1)</script>\n\n**bold**')
    expect(html).toContain('id="title"')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).not.toContain('<script>')
    const rich = renderMarkdown(
      '![图|120|center](https://cdn.test/a.png)\n\n> [!note] 提示\n> 正文\n\n$$E=mc^2$$',
    )
    expect(rich).toContain('data-md-align="center"')
    expect(rich).toContain('width="120"')
    expect(rich).toContain('obsidian-callout')
    expect(rich).toContain('katex')
    const summary = renderSummaryMarkdown('最大 $10^{500}$ 与 **数位**')
    expect(summary).toContain('class="katex"')
    expect(summary).toContain('数位')
    expect(summary).not.toContain('<strong>')
    expect(summary).not.toContain('$')
  })
  it('keeps angle brackets as text instead of dropping them as HTML', () => {
    const heading = renderMarkdown('## std::vector<T>\n\n正文')
    expect(heading).toContain('std::vector&lt;T&gt;')
    expect(heading).toContain('<h2')
    const inline = renderMarkdown('用 List<String> 和 `Map<K, V>` 说明')
    expect(inline).toContain('List&lt;String&gt;')
    expect(inline).toContain('<code>Map&lt;K, V&gt;</code>')
    const code = renderMarkdown('```cpp\nvector<int> v;\n```')
    expect(code).toContain('vector&lt;')
    const kept = renderMarkdown('<mark>高亮</mark> 与 <kbd>Ctrl</kbd>')
    expect(kept).toContain('<mark>高亮</mark>')
    expect(kept).toContain('<kbd>Ctrl</kbd>')
    const video = renderMarkdown(
      '<video controls src="http://192.168.3.201:3000/a/video.mkv" type="video/x-matroska"></video>\n\n<video src="javascript:alert(1)"></video>',
    )
    expect(video).toContain('<video')
    expect(video).toContain('src="http://192.168.3.201:3000/a/video.mkv"')
    expect(video).toContain('controls')
    expect(video).not.toContain('javascript:')
  })
  it('builds a plain-text summary', () => {
    expect(buildSummary('## 标题\n\n这是一段**正文**。', 100)).toContain('这是一段正文')
  })
  it('renders Obsidian highlights beside equals signs and preserves emoji', () => {
    const source = '## ==🔴PASS==\n\na == b 时显示 ==🟢**PASS**==，记录 ==x=y==。'
    const html = renderMarkdown(source)
    expect(html).toContain('id="pass"><mark class="obsidian-highlight-red">🔴PASS</mark></h2>')
    expect(html).toContain('a == b 时显示 <mark class="obsidian-highlight-green">🟢<strong>PASS</strong></mark>，记录 <mark>x=y</mark>。')
    expect(extractHeadings(source)).toEqual([{ level: 2, text: '🔴PASS', id: 'pass' }])
    expect(buildSummary(source)).toBe('🔴PASS a == b 时显示 🟢PASS，记录 x=y。')
  })
  it('keeps highlight delimiters literal in escapes, code and link URLs', () => {
    const html = renderMarkdown(
      '\\==🔴PASS== 和 `==🔴PASS==`\n\n> ```text\n> ==🔴PASS==\n> ```\n\n' +
      '[==🔴PASS==](https://example.test/?q===🔴PASS==)',
    )
    expect(html).toContain('==🔴PASS== 和 <code>==🔴PASS==</code>')
    expect(html).toContain('class="md-code-src">==🔴PASS==</span>')
    expect(html).toContain('href="https://example.test/?q===🔴PASS=="')
    expect(html.match(/<mark\b/g)).toHaveLength(1)
    expect(html).toContain('<mark class="obsidian-highlight-red">🔴PASS</mark></a>')
  })
  it('selects highlight colors from leading circles and squares', () => {
    const html = renderMarkdown('==🔵蓝== ==🟧橙== ==🟡黄== ==🟪紫== ==🟤棕== ==⬛️黑== ==⚪白== ==文字🔴==')
    expect(html).toContain(
      '<mark class="obsidian-highlight-blue">🔵蓝</mark> <mark class="obsidian-highlight-orange">🟧橙</mark> ' +
      '<mark class="obsidian-highlight-yellow">🟡黄</mark> <mark class="obsidian-highlight-purple">🟪紫</mark> ' +
      '<mark class="obsidian-highlight-brown">🟤棕</mark> <mark class="obsidian-highlight-black">⬛️黑</mark> ' +
      '<mark class="obsidian-highlight-white">⚪白</mark> <mark>文字🔴</mark>',
    )
  })
  it.each([
    ['![|51%](https://cdn.test/a.jpg)', ''],
    ['![|473](https://cdn.test/a.jpg)', ''],
    ['![|473x300|center](https://cdn.test/a.jpg)', ''],
    ['![比赛现场|51%|right](https://cdn.test/a.jpg)', '比赛现场'],
    ['![比赛现场|473](https://cdn.test/a.jpg)', '比赛现场'],
    ['![比赛现场|51%][photo]', '比赛现场'],
  ])('omits image sizing from summaries: %s', (image, label) => {
    const source = `先占个坑\n${image}`
    const expected = label ? `先占个坑 ${label}` : '先占个坑'
    expect(buildSummary(source)).toBe(expected)
    expect(plainTextFromMarkdown(source)).toBe(expected)
    expect(renderSummaryMarkdown(source)).toBe(expected)
  })
  it('retains real percentages and math while removing image layout modifiers', () => {
    expect(buildSummary('进度 51%，还有 $10^{5}$ 项\n![|51%](https://cdn.test/a.jpg)'))
      .toBe('进度 51%，还有 $10^{5}$ 项')
    expect(buildSummary('| 说明 | 图片 |\n| --- | --- |\n| 现场 | ![比赛现场|51%](https://cdn.test/a.jpg) |'))
      .toBe('说明 图片 现场 比赛现场')
    expect(buildSummary('[[AtCoder abc465_d] X to Y](https://vjudge.net/problem/AtCoder-abc465d)'))
      .toBe('[AtCoder abc465_d] X to Y')
  })
  it('extracts headings, images and object keys', () => {
    const src = '# A\n\n## B\n\n![x](https://cdn.test/blog/1/abc.png)\n\n<img src="/x/y.png">'
    expect(extractHeadings(src).map((h) => h.id)).toEqual(['a', 'b'])
    expect(extractImageUrls(src)).toContain('https://cdn.test/blog/1/abc.png')
    const keys = extractImageKeys(src)
    expect(keys).toContain('/blog/1/abc.png')
    expect(keys).toContain('/x/y.png')
  })
  it('strips nested link headings without leaking URLs', () => {
    const [heading] = extractHeadings(
      '# [[AtCoder abc465_d] X to Y](https://vjudge.net/problem/AtCoder-abc465d)',
    )
    expect(heading.text).toBe('[AtCoder abc465_d] X to Y')
    expect(heading.id).toBe('atcoder-abc465_d-x-to-y')
  })
})

describe('jwt', () => {
  it('signs and verifies tokens', async () => {
    const token = await signToken({ id: 7, username: 'alice', isAdmin: false })
    const user = await verifyToken(token)
    expect(user).toEqual({ id: 7, username: 'alice', isAdmin: false })
    expect(await verifyToken('garbage')).toBeNull()
  })
})

describe('unlock token', () => {
  it('round-trips and rejects tampering', () => {
    const token = makeUnlockToken(42)
    expect(verifyUnlockToken(token, 42)).toBe(true)
    expect(verifyUnlockToken(token, 43)).toBe(false)
    expect(verifyUnlockToken(token + 'x', 42)).toBe(false)
  })
})

describe('migrate helpers', () => {
  it('keeps target passwords only when an existing password article can supply one', () => {
    expect(migrationVisibility('password', 'keep')).toBe('private')
    expect(migrationVisibility('password', 'keep', 'public')).toBe('private')
    expect(migrationVisibility('password', 'keep', 'password')).toBe('password')
    expect(migrationVisibility('public', 'keep')).toBe('public')
  })
  it('parses CLI args and defaults', () => {
    const args = parseArgs([
      '--old-url',
      'https://old.test',
      '--old-username',
      'alice',
      '--old-password',
      'pw',
      '--new-url',
      'https://new.test',
      '--dry-run',
      '--rewrite-domain',
      'https://old.cdn=https://new.cdn',
    ])
    expect(args.oldUrl).toBe('https://old.test')
    expect(args.newUsername).toBe('alice')
    expect(args.newPassword).toBe('pw')
    expect(args.dryRun).toBe(true)
    expect(args.rewriteDomain).toEqual(['https://old.cdn', 'https://new.cdn'])
  })
  it('rewrites image hosts', () => {
    const out = rewriteImages('![a](https://old.cdn/blog/1/x.png)', {
      rewriteDomain: ['https://old.cdn', 'https://new.cdn'],
    })
    expect(out).toBe('![a](https://new.cdn/blog/1/x.png)')
  })
})
