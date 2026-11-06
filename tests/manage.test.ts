import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dispatch } from '@/server/api/router'
import { closeDb, get, run } from '@/db'
import { sha256Hex } from '@/lib/password'
import { getSetting, setSetting } from '@/lib/settings'
import { createArticle } from '@/server/blog/articles'
import type { SettingsSnapshot } from '@/lib/admin-settings'
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wind-manage-'))
let token = '',
  owner = 0,
  article = 0
async function call(
  method: string,
  endpoint: string,
  body?: unknown,
  authenticated = true,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authenticated && token) headers.Authorization = `Bearer ${token}`
  const response = await dispatch(
    new Request('http://test.local/api/' + endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }) as never,
    endpoint.split('?')[0].split('/'),
  )
  return { status: response.status, json: await response.json() }
}
async function snapshot(): Promise<SettingsSnapshot> {
  return (await call('GET', 'manage/settings')).json.data
}
async function save(
  section: keyof SettingsSnapshot,
  values: unknown,
  version?: string,
) {
  return call('POST', 'manage/settings', {
    section,
    values,
    version: version || (await snapshot())[section].version,
  })
}
beforeAll(async () => {
  process.env.DB_PATH = path.join(dir, 'test.db')
  process.env.JWT_SECRET = 'manage-tests-secret-0123456789abcdef'
  const setup = await call(
    'POST',
    'setup',
    {
      username: 'owner',
      email: 'owner@test.local',
      password: sha256Hex('owner-password-123'),
    },
    false,
  )
  token = setup.json.jwtToken
  owner = setup.json.data.user.id
  article = createArticle(owner, {
    title: '公开文章',
    content: '正文',
    visibility: 'public',
  }).id
})
afterAll(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})
describe('modular management settings', () => {
  it('requires authentication for reading and saving configuration', async () => {
    expect(
      (await call('GET', 'manage/settings', undefined, false)).status,
    ).toBe(401)
    expect((await call('POST', 'manage/settings', {}, false)).status).toBe(401)
  })
  it('saves general information atomically and returns normalized values', async () => {
    const result = await save('general', {
      siteName: '  我的博客  ',
      displayName: '站长',
      faviconUrl: '/icon.png',
      icpNumber: '',
    })
    expect(result.status).toBe(200)
    expect(result.json.data.values).toMatchObject({
      siteName: '我的博客',
      displayName: '站长',
    })
    expect(
      get<{ name: string }>('SELECT name FROM users WHERE id = ?', owner)?.name,
    ).toBe('站长')
    const rejected = await save('general', {
      siteName: '不能提交',
      displayName: '',
      faviconUrl: '',
      icpNumber: '',
    })
    expect(rejected.status).toBe(400)
    expect(getSetting('site_name')).toBe('我的博客')
  })
  it('defaults to system Chinese fonts, persists WenKai and protects concurrent changes', async () => {
    const initial = (await snapshot()).appearance
    expect(initial.values.wenkaiEnabled).toBe(false)
    const enabled = await save('appearance', { ...initial.values, wenkaiEnabled: true }, initial.version)
    expect(enabled.status).toBe(200)
    expect(enabled.json.data.values.wenkaiEnabled).toBe(true)
    expect(getSetting('wenkai_enabled')).toBe('1')
    expect((await save('appearance', initial.values, initial.version)).status).toBe(409)
    const invalid = await save('appearance', {
      ...enabled.json.data.values, subtitle: '不能写入', wenkaiEnabled: 'false',
    })
    expect(invalid.status).toBe(400)
    expect((await snapshot()).appearance.values).toEqual(enabled.json.data.values)
    // Older clients omitting the new option must preserve the current choice.
    expect((await save('appearance', {
      colorScheme: initial.values.colorScheme, subtitle: initial.values.subtitle,
    })).status).toBe(200)
    expect((await snapshot()).appearance.values.wenkaiEnabled).toBe(true)
    const disabled = await save('appearance', { ...initial.values, wenkaiEnabled: false })
    expect(disabled.status).toBe(200)
    expect((await snapshot()).appearance.values.wenkaiEnabled).toBe(false)
    expect(getSetting('wenkai_enabled')).toBe('0')
  })
  it('saves independent font choices and preserves them for older clients', async () => {
    const initial = (await snapshot()).appearance
    expect(initial.values).toMatchObject({ uiFont: 'inherit', englishFont: 'maple', codeFont: 'maple' })
    const chosen = { ...initial.values, uiFont: 'system', englishFont: 'wenkai-mono', codeFont: 'system', wenkaiEnabled: true }
    expect((await save('appearance', chosen)).status).toBe(200)
    expect((await snapshot()).appearance.values).toEqual(chosen)
    expect(getSetting('ui_font')).toBe('system')
    expect(getSetting('english_font')).toBe('wenkai-mono')
    expect(getSetting('code_font')).toBe('system')
    expect((await save('appearance', { colorScheme: initial.values.colorScheme, subtitle: initial.values.subtitle })).status).toBe(200)
    expect((await snapshot()).appearance.values).toEqual(chosen)
    for (const field of ['uiFont', 'englishFont', 'codeFont']) {
      for (const invalid of ['other-font', null, false, 1, ['maple']]) {
        expect((await save('appearance', { ...chosen, subtitle: '不能写入', [field]: invalid })).status).toBe(400)
        expect((await snapshot()).appearance.values).toEqual(chosen)
      }
    }
    expect((await save('appearance', initial.values, initial.version)).status).toBe(409)
    expect((await save('appearance', initial.values)).status).toBe(200)
  })
  it('rejects a stale module while allowing independent modules to save', async () => {
    const before = await snapshot()
    expect(
      (
        await save(
          'general',
          { ...before.general.values, siteName: '新名称' },
          before.general.version,
        )
      ).status,
    ).toBe(200)
    expect(
      (await save('general', before.general.values, before.general.version))
        .status,
    ).toBe(409)
    expect(
      (
        await save(
          'appearance',
          { colorScheme: 'dark', subtitle: '新简介' },
          before.appearance.version,
        )
      ).status,
    ).toBe(200)
    expect(getSetting('site_name')).toBe('新名称')
  })
  it('validates URLs, enum values and types before writing', async () => {
    const base = await snapshot()
    for (const faviconUrl of [
      'javascript:alert(1)',
      '//evil.test/x',
      '/\\evil.test/x',
    ])
      expect(
        (await save('general', { ...base.general.values, faviconUrl })).status,
      ).toBe(400)
    expect(
      (await save('appearance', { colorScheme: 'wrong', subtitle: '' })).status,
    ).toBe(400)
    expect(
      (
        await save('interaction', { likesEnabled: 'false' })
      ).status,
    ).toBe(400)
    expect(
      (
        await call('POST', 'manage/settings', {
          section: 'unknown',
          values: {},
          version: 'x',
        })
      ).status,
    ).toBe(400)
  })
  it('links and clears navigation articles without modifying appearance', async () => {
    const page = createArticle(owner, { title: '关于文章', content: '关于正文' })
    expect(
      (
        await save('content', {
          aboutArticleId: page.id,
          friendsArticleId: 0,
        })
      ).status,
    ).toBe(200)
    expect(
      (await save('content', { aboutArticleId: 0, friendsArticleId: 0 }))
        .status,
    ).toBe(200)
    expect((await snapshot()).appearance.values.subtitle).toBe('新简介')
    expect((await snapshot()).content.values.aboutArticleId).toBe(0)
    expect(get<{ visibility: string }>('SELECT visibility FROM blog_articles WHERE id = ?', page.id)?.visibility).toBe('unlisted')
  })
  it('rejects malformed social links rather than silently dropping entries', async () => {
    expect(
      (
        await save('social', {
          socialLinks: [{ type: 'custom', url: 'javascript:alert(1)' }],
        })
      ).status,
    ).toBe(400)
    const result = await save('social', {
      socialLinks: [
        { type: 'github', url: 'https://github.com/example', label: 'GitHub' },
        { type: 'email', url: 'mailto:owner@example.test', label: '联系我' },
      ],
    })
    expect(result.status).toBe(200)
    expect(result.json.data.values.socialLinks).toHaveLength(2)
    expect(
      (await save('social', { socialLinks: [] })).json.data.values.socialLinks,
    ).toHaveLength(0)
  })
  it('never returns storage passwords, keeps a blank password and detects secret changes', async () => {
    const values = {
      bucket: 'test-bucket',
      operator: 'test-operator',
      password: 'private-cdn-value',
      domain: 'cdn.example.test',
      scheme: 'https',
      apiHost: '',
      uploadDir: 'blog',
    }
    const result = await save('storage', values)
    expect(result.status).toBe(200)
    expect(result.json.data.values).toMatchObject({
      password: '',
      hasPassword: true,
      configured: true,
    })
    expect(JSON.stringify(result.json)).not.toContain('private-cdn-value')
    const before = (await snapshot()).storage
    expect(
      (
        await save(
          'storage',
          { ...before.values, password: '', uploadDir: 'images' },
          before.version,
        )
      ).status,
    ).toBe(200)
    expect(getSetting('upyun_password')).toBe('private-cdn-value')
    const stale = (await snapshot()).storage
    setSetting('upyun_password', 'changed-elsewhere')
    expect((await save('storage', stale.values, stale.version)).status).toBe(
      409,
    )
    expect(
      (await save('storage', { ...stale.values, uploadDir: '../escape' }))
        .status,
    ).toBe(400)
  })
  it('resolves both retired themes to Mizuki without losing content', async () => {
    for (const legacy of ['chirpy', 'simple']) {
      run(
        'UPDATE blog_site_configs SET theme_id = ? WHERE user_id = ?',
        legacy,
        owner,
      )
      const result = await call('GET', 'user/blog/theme/status?username=owner')
      expect(result.json.data).toMatchObject({
        themeId: 'mizuki',
        subtitle: '新简介',
      })
    }
  })
})
describe('management lists', () => {
  it('filters article status before pagination and uses the same filter for totals', async () => {
    createArticle(owner, { title: '共同关键词草稿1', isDraft: true })
    createArticle(owner, { title: '共同关键词草稿2', isDraft: true })
    createArticle(owner, { title: '共同关键词私密', visibility: 'private' })
    const result = await call(
      'GET',
      'user/blog/article/mine?status=draft&keyword=共同关键词&pageSize=1',
    )
    expect(result.json.data.total).toBe(2)
    expect(result.json.data.list).toHaveLength(1)
    expect(result.json.data.list[0].isDraft).toBe(true)
    const privateList = await call(
      'GET',
      'user/blog/article/mine?status=private&keyword=共同关键词',
    )
    expect(privateList.json.data.total).toBe(1)
    expect(privateList.json.data.list[0].isDraft).toBe(false)
  })
})
