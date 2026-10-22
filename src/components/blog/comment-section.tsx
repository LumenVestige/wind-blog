'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { DataPagination } from '@/components/ui/data-pagination'
import { RequestError } from '@/components/ui/request-error'
import { api } from '@/lib/api-client'
import { cn, formatDateTime } from '@/lib/utils'
interface CommentInfo {
  id: number
  parentId: number
  content: string
  createdAt: number
  userId: number
  likeCount: number
  liked: boolean
  author: { id: number; username: string; name: string; avatar: string }
  replyToName: string
  replies: CommentInfo[]
}
export function CommentSection({
  articleId,
  viewerId,
  isAdmin,
  articleOwnerId,
  className,
  commentsEnabled = true,
  likesEnabled = true,
}: {
  articleId: number
  viewerId: number
  isAdmin: boolean
  articleOwnerId: number
  className?: string
  commentsEnabled?: boolean
  likesEnabled?: boolean
}) {
  const [comments, setComments] = useState<CommentInfo[]>([]),
    [total, setTotal] = useState(0),
    [totalRoots, setTotalRoots] = useState(0)
  const [content, setContent] = useState(''),
    [name, setName] = useState(''),
    [replyTo, setReplyTo] = useState<CommentInfo | null>(null)
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null)
  const sequence = useRef(0)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1),
    [target, setTarget] = useState<CommentInfo | null>(null),
    [pendingLike, setPendingLike] = useState<number | null>(null)
  const key = `wind-comment:${articleId}`
  useEffect(() => {
    try {
      setContent(localStorage.getItem(key) || '')
      setName(localStorage.getItem('wind-visitor-name') || '')
    } catch {}
  }, [key])
  function updateContent(text: string) {
    setContent(text)
    try {
      localStorage.setItem(key, text)
    } catch {}
  }
  const load = useCallback(
    async (next: number) => {
      const request = ++sequence.current
      setLoading(true)
      setError(null)
      try {
        const r = await api.get<{
          list: CommentInfo[]
          total: number
          totalComments: number
        }>('/api/user/blog/comment/list', { articleId, page: next, pageSize })
        if (request !== sequence.current) return
        const last = Math.max(1, Math.ceil(r.total / pageSize))
        if (next > last) {
          setPage(last)
          return
        }
        setComments(r.list)
        setTotalRoots(r.total)
        setTotal(r.totalComments)
      } catch (e) {
        if (request === sequence.current) setError(e)
      } finally {
        if (request === sequence.current) setLoading(false)
      }
    },
    [articleId, pageSize],
  )
  useEffect(() => {
    void load(page)
    return () => {
      sequence.current += 1
    }
  }, [load, page])
  async function submit() {
    if (!content.trim() || busy) return
    setBusy(true)
    try {
      const res = await api.post<{ status?: string }>(
        '/api/user/blog/comment/create',
        { articleId, content, name, parentId: replyTo?.id || 0 },
      )
      updateContent('')
      setReplyTo(null)
      try {
        localStorage.setItem('wind-visitor-name', name)
      } catch {}
      toast.success(
        res.status === 'pending' ? '留言已提交，站长审核后公开' : '评论已发表',
      )
      if (res.status !== 'pending') {
        if (page === 1) await load(1)
        else setPage(1)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '发表失败')
    } finally {
      setBusy(false)
    }
  }
  async function like(c: CommentInfo) {
    if (pendingLike !== null) return
    setPendingLike(c.id)
    try {
      const result = await api.post<{ liked: boolean; likeCount: number }>(
        '/api/user/blog/comment/like',
        { commentId: c.id },
      )
      const update = (items: CommentInfo[]): CommentInfo[] =>
        items.map((item) => ({
          ...item,
          ...(item.id === c.id ? result : {}),
          replies: update(item.replies || []),
        }))
      setComments(update)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setPendingLike(null)
    }
  }
  function render(c: CommentInfo, depth = 0) {
    const canDelete =
      viewerId > 0 &&
      (isAdmin || c.userId === viewerId || articleOwnerId === viewerId)
    return (
      <div
        key={c.id}
        data-comment-row=""
        className={depth ? 'ml-3 border-l pl-3 sm:ml-6 sm:pl-4' : ''}
      >
        <div className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar className="h-7 w-7">
              {c.author.avatar && <AvatarImage src={c.author.avatar} alt="" />}
              <AvatarFallback>
                {(c.author.name || c.author.username || '访客').slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {c.author.name || c.author.username}
            </span>
            {c.replyToName && (
              <span className="text-xs text-muted-foreground">
                回复 {c.replyToName}
              </span>
            )}
            <time className="text-xs text-muted-foreground">
              {formatDateTime(c.createdAt)}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
            {c.content}
          </p>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            {likesEnabled && (
              <button
                aria-label={`为 ${c.author.name} 的评论点赞`}
                aria-pressed={c.liked}
                disabled={pendingLike !== null}
                className="flex items-center gap-1"
                onClick={() => void like(c)}
              >
                <Heart
                  className={cn(
                    'size-3.5',
                    c.liked && 'fill-current text-primary',
                  )}
                />
                {c.likeCount || ''}
              </button>
            )}
            {commentsEnabled && depth < 2 && (
              <button
                onClick={() => {
                  setReplyTo(c)
                  document
                    .getElementById(`comment-content-${articleId}`)
                    ?.focus()
                }}
              >
                回复
              </button>
            )}
            {canDelete && (
              <button className="text-destructive" onClick={() => setTarget(c)}>
                删除
              </button>
            )}
          </div>
        </div>
        {c.replies?.map((item) => render(item, depth + 1))}
      </div>
    )
  }
  return (
    <section className={cn(className ?? 'mt-10')}>
      <h3 className="mb-4 text-lg font-semibold">评论 ({total})</h3>
      {commentsEnabled ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {!viewerId && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor={`comment-name-${articleId}`}>昵称</Label>
              <Input
                id={`comment-name-${articleId}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={40}
                placeholder="如何称呼你"
              />
              <p className="text-xs text-muted-foreground">
                无需注册，留言经站长审核后公开。
              </p>
            </div>
          )}
          {replyTo && (
            <p className="motion-reply text-sm">
              回复 {replyTo.author.name}{' '}
              <Button
                variant="ghost"
                type="button"
                size="sm"
                onClick={() => setReplyTo(null)}
              >
                取消回复
              </Button>
            </p>
          )}
          <Label className="sr-only" htmlFor={`comment-content-${articleId}`}>
            评论内容
          </Label>
          <Textarea
            id={`comment-content-${articleId}`}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            maxLength={2000}
            required
            placeholder="写下你的评论…（输入会保留在当前浏览器）"
          />
          <div className="flex justify-end">
            <ActionButton size="sm" pending={busy}>
              {busy ? '提交中…' : viewerId ? '发表评论' : '提交留言'}
            </ActionButton>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">站长已关闭新评论。</p>
      )}
      <div className="mt-4 divide-y">{comments.map((c) => render(c))}</div>
      {error != null && (
        <RequestError error={error} retry={() => void load(page)} />
      )}
      {loading && (
        <p role="status" className="py-4 text-sm">
          加载评论中…
        </p>
      )}
      {!loading && !error && !comments.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          还没有公开评论。
        </p>
      )}
      {totalRoots > 0 && (
        <DataPagination
          page={page}
          total={totalRoots}
          pageSize={pageSize}
          disabled={loading}
          onChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          label="评论分页"
        />
      )}
      <ConfirmDelete
        title="这条评论"
        open={!!target}
        onClose={() => setTarget(null)}
        description="此评论和全部回复将被删除，无法恢复。"
        onConfirm={async () => {
          try {
            await api.post('/api/user/blog/comment/delete', { id: target!.id })
            await load(page)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : '删除失败')
          }
        }}
      />
    </section>
  )
}
