'use client'
import { cn } from '@/lib/utils'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Clock, Eye, Heart, Link2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MarkdownView } from '@/components/blog/markdown-view'
import { LikeButton } from '@/components/blog/like-button'
import { UnlockForm } from '@/components/blog/unlock-form'
import { CommentSection } from '@/components/blog/comment-section'
import { ArticleToc, type TocItem } from '@/components/blog/article-toc'
import { useBlogChrome } from '@/components/blog/blog-chrome'
import { estimateReadMinutes } from '@/lib/blog-present'

export interface ArticleViewData {
  id: number
  slug: string
  title: string
  content: string
  html: string
  tags: string[]
  categoryName: string
  publishedLabel: string
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
    !locked && toc.length > 0 ? (
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

export function ArticleView({
  themeId,
  username,
  isOwner,
  article,
  related,
  toc,
  bodySlot,
  bodyOnly = false,
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
  const base = ''
  const editHref = `/manage/edit/${article.id}`

  useEffect(() => {
    if (!chrome) return
    chrome.setArticleTitle(article.title)
    return () => chrome.setArticleTitle(null)
  }, [chrome, article.title])

  useEffect(() => {
    if (!chrome) return
    if ((themeId !== 'chirpy' && themeId !== 'mizuki') || locked || toc.length === 0) {
      chrome.setPanel(null)
      return
    }
    chrome.setPanel(
      <ArticleToc toc={toc} variant={themeId === 'mizuki' ? 'mizuki' : 'chirpy'} />,
    )
    return () => chrome.setPanel(null)
  }, [chrome, themeId, locked, toc])

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
    !locked && toc.length > 0 ? (
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
      <div className="mt-3 flex flex-wrap gap-1.5">
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
        <article className="mz-article">
          <header>
            <h1>{article.title}</h1>
            <div className="mz-article-meta">{meta}</div>
            {tags}
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
