'use client'
import { cn } from '@/lib/utils'

import Link from '@/components/blog/blog-navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BookOpen, CalendarDays, CalendarClock, Clock, Eye, Hash, Heart, Link2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MarkdownView } from '@/components/blog/markdown-view'
import { LikeButton } from '@/components/blog/like-button'
import { UnlockForm } from '@/components/blog/unlock-form'
import { CommentSection } from '@/components/blog/comment-section'
import { ArticleToc, type TocItem } from '@/components/blog/article-toc'
import { useBlogChrome } from '@/components/blog/blog-chrome'
import { useFadeOutOnUnmount } from '@/components/motion/use-fade-out-on-unmount'
import { estimateReadMinutes, formatDateSlash } from '@/lib/blog-present'
import { bindArticleBlockMotion } from '@/lib/article-block-motion'

export interface ArticleViewData {
  id: number
  slug: string
  title: string
  content: string
  html: string
  tags: string[]
  categoryName: string
  categoryId?: number | null
  publishedLabel: string
  publishedAt?: number
  updatedAt?: number
  viewCount: number
  likeCount: number
  liked: boolean
  commentCount: number
  requiresPassword: boolean
  userId: number
}

export function ArticleBodyContent({
  themeId,
  html,
  toc,
  locked,
  articleId,
  children,
}: {
  themeId: 'mizuki' | 'chirpy' | 'simple'
  html: string
  toc: TocItem[]
  locked: boolean
  articleId: number
  children?: React.ReactNode
}) {
  const isChirpy = themeId === 'chirpy'
  const isMizuki = themeId === 'mizuki'
  const mobileToc =
    !isMizuki && !locked && toc.length > 0 ? (
      <details className={cn("mb-6 rounded-lg border p-3", isChirpy ? "chirpy-toc-mobile xl:hidden" : isMizuki ? "lg:hidden" : "")}>
        <summary className="cursor-pointer select-none font-semibold text-[var(--label-color)]">目录</summary>
        <ul className="chirpy-toc-list mt-2">
          {toc.map((item) => (
            <li key={item.id} className="chirpy-toc-item" style={{ paddingLeft: `${Math.max(0, item.level - 1) * 0.7}rem` }}>
              <a href={item.id === 'article-top' ? '#' : `#${item.id}`} className="chirpy-toc-link">{item.text}</a>
            </li>
          ))}
        </ul>
      </details>
    ) : null
  if (locked) {
    return (
      <div className={isChirpy ? 'rounded-[10px] border border-[var(--main-border-color)] bg-[var(--card-bg)] p-6' : isMizuki ? 'mz-section-card' : 'space-y-4 rounded-xl border p-6'}>
        <p className="mb-3 text-sm text-muted-foreground">这是一篇密码保护的文章。</p>
        <UnlockForm articleId={articleId} />
      </div>
    )
  }
  return (
    <>
      <div className={isChirpy ? 'chirpy-prose content' : isMizuki ? 'mz-prose' : 'rounded-xl border bg-card p-6 shadow-sm'} id="article-body">
        {mobileToc}
        <MarkdownView html={html} className={isChirpy || isMizuki ? '' : undefined} />
      </div>
      {children}
    </>
  )
}

// Overflows any viewport; the card clips it to the article card's height.
const TOC_SKELETON_WIDTHS = Array.from({ length: 3 }, () => [
  '82%', '64%', '74%', '58%', '88%', '68%', '52%', '78%', '60%', '70%', '84%', '56%', '72%', '62%',
]).flat()

function ArticleTocSkeleton() {
  const ref = useFadeOutOnUnmount<HTMLElement>()
  return (
    <section ref={ref} className="toc-card mz-widget mz-toc-loading" aria-hidden>
      <h2 className="mz-widget-title">目录</h2>
      <div className="mz-toc-skeleton">
        {TOC_SKELETON_WIDTHS.map((w, i) => (
          <span key={i} className="mz-skeleton mz-skeleton-line" style={{ width: w, marginLeft: i % 3 ? '0.8rem' : 0 }} />
        ))}
      </div>
    </section>
  )
}

function ArticleTitleSkeleton() {
  const ref = useFadeOutOnUnmount<HTMLDivElement>()
  return <div ref={ref} className="mz-skeleton mz-skeleton-title" aria-hidden />
}

function ArticleMetaSkeleton() {
  const ref = useFadeOutOnUnmount<HTMLDivElement>()
  return (
    <div ref={ref} className="mz-article-meta" aria-hidden>
      {[4.5, 6, 3.5, 4, 3, 3].map((w, i) => (
        <span key={i} className="mz-skeleton mz-skeleton-meta" style={{ width: `${w}rem` }} />
      ))}
    </div>
  )
}

export function ArticleView({
  themeId,
  username,
  isOwner,
  article,
  related,
  toc,
  bodySlot,
  bodyOnly = false,
  loading = false,
  viewerId,
  isAdmin, commentsEnabled = true, likesEnabled = true,
}: {
  themeId: 'mizuki' | 'chirpy' | 'simple'
  username: string
  isOwner: boolean
  article: ArticleViewData
  related: { id: number; slug: string; title: string; summary: string; summaryHtml: string }[]
  toc: TocItem[]
  bodySlot?: React.ReactNode
  bodyOnly?: boolean
  /** Full article not fetched yet: Mizuki header renders placeholders. */
  loading?: boolean
  viewerId: number
  isAdmin: boolean
  commentsEnabled?: boolean
  likesEnabled?: boolean
}) {
  const chrome = useBlogChrome()
  const [copied, setCopied] = useState(false)
  const isChirpy = themeId === 'chirpy'
  const isMizuki = themeId === 'mizuki'
  const locked = article.requiresPassword
  const articleRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (isMizuki && !loading && articleRef.current) return bindArticleBlockMotion(articleRef.current)
  }, [isMizuki, loading, article.id, article.content])
  const base = ''
  // `from=article` makes the editor return here after saving.
  const editHref = `/manage/edit/${article.id}?from=article`

  useEffect(() => {
    if (!chrome) return
    chrome.setArticleTitle(article.title)
    return () => chrome.setArticleTitle(null)
  }, [chrome, article.title])

  useEffect(() => {
    if (!chrome) return
    chrome.setArticleToc(locked || loading ? [] : toc)
    return () => chrome.setArticleToc([])
  }, [chrome, locked, toc, loading])

  useEffect(() => {
    if (!chrome) return
    if (loading && themeId === 'mizuki') {
      chrome.setPanel(<ArticleTocSkeleton />)
      return () => chrome.setPanel(null)
    }
    if ((themeId !== 'chirpy' && themeId !== 'mizuki') || locked || toc.length === 0) {
      chrome.setPanel(null)
      return
    }
    chrome.setPanel(
      <ArticleToc toc={toc} variant={themeId === 'mizuki' ? 'mizuki' : 'chirpy'} />,
    )
    return () => chrome.setPanel(null)
  }, [chrome, themeId, locked, toc, loading])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('链接已复制')
    } catch {
      toast.error('复制失败，请手动复制地址栏')
    }
  }

  const mobileToc =
    !isMizuki && !locked && toc.length > 0 ? (
      <details className={cn("mb-6 rounded-lg border p-3", isChirpy ? "chirpy-toc-mobile xl:hidden" : isMizuki ? "lg:hidden" : "")}>
        <summary className="cursor-pointer select-none font-semibold text-[var(--label-color)]">
          目录
        </summary>
        <ul className="chirpy-toc-list mt-2">
          {toc.map((item) => (
            <li
              key={item.id}
              className="chirpy-toc-item"
              style={{ paddingLeft: `${Math.max(0, item.level - 1) * 0.7}rem` }}
            >
              <a href={item.id === 'article-top' ? '#' : `#${item.id}`} className="chirpy-toc-link">
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </details>
    ) : null

  const body = bodySlot ?? (locked ? (
    <div
      className={
        isChirpy
          ? 'rounded-[10px] border border-[var(--main-border-color)] bg-[var(--card-bg)] p-6'
          : isMizuki
            ? 'mz-section-card'
            : 'space-y-4 rounded-xl border p-6'
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">这是一篇密码保护的文章。</p>
      <UnlockForm articleId={article.id} />
    </div>
  ) : isChirpy ? (
    <div className="chirpy-prose content" id="article-body">
      {mobileToc}
      <MarkdownView html={article.html} className="" />
    </div>
  ) : isMizuki ? (
    <div className="mz-prose" id="article-body">
      {mobileToc}
      <MarkdownView html={article.html} className="" />
    </div>
  ) : (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {mobileToc}
      <MarkdownView html={article.html} />
    </div>
  ))

  const likeBlock = !locked && likesEnabled ? (
    <LikeButton
      articleId={article.id}
      initialLiked={article.liked}
      initialCount={article.likeCount}
      variant="article"
      className={
        isChirpy
          ? 'mt-12 flex flex-col items-center gap-2 border-b border-[var(--main-border-color)] pb-8'
          : isMizuki
            ? 'mt-10 flex flex-col items-center gap-2 border-t border-dashed border-[var(--mz-line)] pt-6'
            : 'flex flex-col items-center gap-2 border-t pt-6'
      }
    />
  ) : null

  const shareBlock = !locked ? (
    <div
      className={
        isChirpy
          ? 'post-tail-wrapper mt-6 flex flex-wrap items-center justify-between gap-3 pb-6'
          : 'mt-6 flex flex-wrap items-center justify-between gap-3'
      }
    >
      <div className="text-sm text-muted-foreground">
        {article.categoryName ? <span>分类：{article.categoryName}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--link-color,var(--primary))] hover:underline"
      >
        <Link2 className="size-3.5" />
        {copied ? '已复制' : '复制链接'}
      </button>
    </div>
  ) : null

  const relatedBlock =
    !locked && related.length > 0 ? (
      <section
        id="related-posts"
        className={
          isChirpy
            ? 'mt-10 space-y-3'
            : isMizuki
              ? 'mz-section-card space-y-3'
              : 'mt-6 space-y-3 rounded-xl border bg-card p-5'
        }
      >
        <h3
          className={
            isChirpy
              ? 'text-[1.1rem] font-semibold text-[var(--label-color)]'
              : isMizuki
                ? 'text-base font-semibold text-[var(--mz-text-90)]'
                : 'text-base font-semibold'
          }
        >
          相关文章
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {related.map((a) => (
            <li key={a.id}>
              <Link
                href={`${base}/${a.slug}`}
                articleSlug={a.slug}
                className={
                  isChirpy
                    ? 'block rounded-[10px] bg-[var(--card-bg)] p-3 shadow-[var(--card-shadow)] transition hover:bg-[var(--card-hover-bg)]'
                    : isMizuki
                      ? 'block rounded-[var(--mz-radius-sm)] bg-[var(--mz-btn-bg)] p-3 transition hover:bg-[var(--mz-btn-bg-hover)]'
                      : 'block rounded-lg border p-3 hover:border-primary/40'
                }
              >
                <h4 className="line-clamp-2 font-medium">{a.title}</h4>
                {a.summary ? (
                  <div className="markdown-summary mt-1 line-clamp-2 text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: a.summaryHtml }} />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null

  const comments = !locked ? (
    <CommentSection
      commentsEnabled={commentsEnabled}
      likesEnabled={likesEnabled}
      articleId={article.id}
      viewerId={viewerId}
      isAdmin={isAdmin}
      articleOwnerId={article.userId}
      className={
        isChirpy
          ? 'mt-10 rounded-[10px] bg-[var(--card-bg)] p-6 shadow-[var(--card-shadow)]'
          : isMizuki
            ? 'mz-section-card mt-0'
            : 'rounded-xl border bg-card p-6 shadow-sm'
      }
    />
  ) : null

  const meta = (
    <>
      <span>
        <Link href="/">@{username}</Link>
      </span>
      <span>
        <time>{article.publishedLabel}</time>
      </span>
      {article.categoryName ? <span>{article.categoryName}</span> : null}
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" />约 {estimateReadMinutes(article.content)} 分钟
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3.5" />
        {article.viewCount}
      </span>
      <span className="inline-flex items-center gap-1">
        <Heart className="size-3.5" />
        {article.likeCount}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageCircle className="size-3.5" />
        {article.commentCount}
      </span>
      {isOwner ? (
        <span>
          <Link href={editHref}>编辑</Link>
        </span>
      ) : null}
    </>
  )

  const tags =
    article.tags.length > 0 ? (
      <div className={isMizuki ? 'mz-article-tags' : 'mt-3 flex flex-wrap gap-1.5'}>
        {article.tags.map((t) => (
          <Link
            key={t}
            href={`/?tag=${encodeURIComponent(t)}`}
            className={
              isChirpy
                ? 'rounded-full border border-[var(--main-border-color)] px-2.5 py-0.5 text-xs text-[var(--text-muted-color)] no-underline hover:border-[var(--link-color)] hover:text-[var(--link-color)]'
                : isMizuki
                  ? 'rounded-full bg-[var(--mz-btn-bg)] px-2.5 py-0.5 text-xs text-[var(--mz-text-50)] no-underline hover:text-[var(--mz-primary)]'
                  : 'rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground'
            }
          >
            {t}
          </Link>
        ))}
      </div>
    ) : null

  if (bodyOnly) {
    return (
      <>
        {bodySlot ?? body}
        {likeBlock}
        {shareBlock}
        {relatedBlock}
        {comments}
      </>
    )
  }

  if (isChirpy) {
    return (
      <article className="chirpy-article px-1 pt-4">
        <header>
          <h1>{article.title}</h1>
          <div className="post-meta flex flex-wrap items-center gap-y-1">{meta}</div>
          {tags}
        </header>
        {body}
        {!bodySlot ? likeBlock : null}
        {!bodySlot ? shareBlock : null}
        {!bodySlot ? relatedBlock : null}
        {!bodySlot ? comments : null}
      </article>
    )
  }

  if (isMizuki) {
    return (
      <div className="space-y-4">
        <article ref={articleRef} className={cn('mz-article', loading && 'is-loading')}>
          <header className="mz-article-header">
            {article.title ? (
              <h1>{article.title}</h1>
            ) : loading ? (
              <ArticleTitleSkeleton />
            ) : (
              <h1 />
            )}
            <div className="mz-article-info">
            {loading && !article.publishedAt ? (
              <ArticleMetaSkeleton />
            ) : (
              <div className="mz-article-meta">
                <span className="mz-meta-item" title="发布时间">
                  <span className="mz-meta-icon"><CalendarDays aria-hidden="true" /></span>
                  <span className="sr-only">发布于</span>
                  <time dateTime={article.publishedAt ? new Date(article.publishedAt * 1000).toISOString() : undefined}>
                    {article.publishedAt ? formatDateSlash(article.publishedAt).replaceAll('/', '-') : article.publishedLabel}
                  </time>
                </span>
                {article.updatedAt ? (
                  <span className="mz-meta-item" title="更新时间">
                    <span className="mz-meta-icon"><CalendarClock aria-hidden="true" /></span>
                    <span className="sr-only">更新于</span>
                    <time dateTime={new Date(article.updatedAt * 1000).toISOString()}>{formatDateSlash(article.updatedAt).replaceAll('/', '-')}</time>
                  </span>
                ) : null}
                <span className="mz-meta-item">
                  <span className="mz-meta-icon"><BookOpen aria-hidden="true" /></span>
                  <span className="sr-only">分类：</span>
                  {article.categoryId ? <Link href={`/archives?categoryId=${article.categoryId}`}>{article.categoryName || '未分类'}</Link> : <span>{article.categoryName || '未分类'}</span>}
                </span>
                <span className="mz-meta-item mz-meta-tags">
                  <span className="mz-meta-icon"><Hash aria-hidden="true" /></span>
                  <span className="sr-only">标签：</span>
                  <span className="mz-meta-tag-list">
                    {article.tags.length ? article.tags.map((tag, index) => (
                      <span key={tag}>{index > 0 && <span className="mz-meta-separator" aria-hidden="true">/</span>}<Link href={`/archives?tag=${encodeURIComponent(tag)}`}>{tag}</Link></span>
                    )) : '无标签'}
                  </span>
                </span>
              </div>
            )}
            {!loading && (
              <div className="mz-article-details">
                <span><Clock aria-hidden="true" />约 {estimateReadMinutes(article.content)} 分钟</span>
                <span><Eye aria-hidden="true" /><span className="sr-only">阅读</span>{article.viewCount}</span>
                <span><Heart aria-hidden="true" /><span className="sr-only">喜欢</span>{article.likeCount}</span>
                <span><MessageCircle aria-hidden="true" /><span className="sr-only">评论</span>{article.commentCount}</span>
                {isOwner ? <Link href={editHref}>编辑文章</Link> : null}
              </div>
            )}
            </div>
          </header>
          {body}
          {!bodySlot ? likeBlock : null}
          {!bodySlot ? shareBlock : null}
        </article>
        {!bodySlot ? relatedBlock : null}
        {!bodySlot ? comments : null}
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            @{username}
          </Link>
          <span>·</span>
          <time>{article.publishedLabel}</time>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />约 {estimateReadMinutes(article.content)} 分钟
          </span>
          {isOwner ? (
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href={editHref}>编辑</Link>
            </Button>
          ) : null}
        </div>
        {tags}
        <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-4" />
            {article.viewCount} 阅读
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-4" />
            {article.likeCount} 赞
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-4" />
            {article.commentCount} 评论
          </span>
        </div>
      </header>
      {body}
      {!bodySlot ? likeBlock : null}
      {!bodySlot ? shareBlock : null}
      {!bodySlot ? relatedBlock : null}
      {!bodySlot ? comments : null}
    </article>
  )
}
