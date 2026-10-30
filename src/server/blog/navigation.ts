import { all, get, transaction } from '@/db'
import { ApiError } from '@/lib/api'
import { getSetting, setSettings } from '@/lib/settings'
import { createArticle, getArticleById, updateArticle } from './articles'
import { ensureSiteConfig } from './site'

const keys = { aboutArticleId: 'about_article_id', friendsArticleId: 'friends_article_id' } as const
export type NavigationArticleIds = { aboutArticleId: number; friendsArticleId: number }
export type NavigationArticle = { id: number; slug: string; title: string }
export type NavigationArticleOption = NavigationArticle & { visibility: string; isDraft: boolean; approved: boolean }

/** Preserve previously authored pages once; empty sites get no default pages. */
function migrateLegacyContent(userId: number) {
  if (getSetting('navigation_articles_migrated') === String(userId)) return
  transaction(() => {
    const legacy = ensureSiteConfig(userId)
    const values: Record<string, string> = {}
    for (const [key, title, content] of [
      ['aboutArticleId', '关于', legacy.about_md],
      ['friendsArticleId', '友链', legacy.friends_md],
    ] as const) {
      const setting = keys[key]
      if (getSetting(setting) || !content.trim()) continue
      const article = createArticle(userId, { title, content, visibility: 'unlisted' })
      values[setting] = String(article.id)
    }
    setSettings({ ...values, navigation_articles_migrated: String(userId) })
  })
}

export function navigationArticleIds(userId: number): NavigationArticleIds {
  migrateLegacyContent(userId)
  const read = (key: string) => {
    const value = Number(getSetting(key))
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  }
  return { aboutArticleId: read(keys.aboutArticleId), friendsArticleId: read(keys.friendsArticleId) }
}

export function navigationArticles(userId: number) {
  const ids = navigationArticleIds(userId)
  const resolve = (id: number): NavigationArticle | null => {
    const row = get<NavigationArticle>(
      `SELECT id, slug, title FROM blog_articles a WHERE id = ? AND user_id = ?
        AND visibility IN ('public', 'unlisted') AND moderation_status = 'approved'
        AND NOT EXISTS (SELECT 1 FROM blog_article_options o WHERE o.article_id = a.id AND o.is_draft = 1)`,
      id, userId,
    )
    // node:sqlite rows have a null prototype; React's client boundary needs DTOs.
    return row ? { ...row } : null
  }
  return { about: resolve(ids.aboutArticleId), friends: resolve(ids.friendsArticleId) }
}

export function navigationArticleOptions(userId: number): NavigationArticleOption[] {
  return all<{ id: number; slug: string; title: string; visibility: string; is_draft: number; moderation_status: string }>(
    `SELECT a.id, a.slug, a.title, a.visibility, COALESCE(o.is_draft, 0) AS is_draft, a.moderation_status
      FROM blog_articles a LEFT JOIN blog_article_options o ON o.article_id = a.id
      WHERE a.user_id = ? ORDER BY a.updated_at DESC, a.id DESC`, userId,
  ).map(({ is_draft, moderation_status, ...article }) => ({ ...article, isDraft: !!is_draft, approved: moderation_status === 'approved' }))
}

export function saveNavigationArticles(userId: number, value: Record<string, unknown>) {
  return transaction(() => {
    const ids = Object.entries(keys).map(([key, setting]) => {
      const id = value[key]
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 0) throw new ApiError('请选择有效的关联文章', 1, 400)
      if (id) {
        const row = getArticleById(id)
        const draft = get<{ is_draft: number }>('SELECT is_draft FROM blog_article_options WHERE article_id = ?', id)
        if (!row || row.user_id !== userId || row.moderation_status !== 'approved' || draft?.is_draft ||
            !['public', 'unlisted'].includes(row.visibility)) throw new ApiError('只能关联自己的已发布文章；私密、草稿和密码文章不可关联', 1, 400)
      }
      return { id, setting }
    })
    for (const id of new Set(ids.map((entry) => entry.id).filter(Boolean))) updateArticle(userId, id, { visibility: 'unlisted' })
    setSettings(Object.fromEntries(ids.map(({ id, setting }) => [setting, String(id)])))
  })
}
