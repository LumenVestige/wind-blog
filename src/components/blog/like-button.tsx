'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api, ClientApiError } from '@/lib/api-client'

export function LikeButton({
  articleId,
  initialLiked,
  initialCount,
  variant = 'compact',
  className,
}: {
  articleId: number
  initialLiked: boolean
  initialCount: number
  /** article：文末大按钮 + 说明，跟原站阅读页一致 */
  variant?: 'compact' | 'article'
  className?: string
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(
        '/api/user/blog/like',
        { articleId },
      )
      setLiked(res.liked)
      setCount(res.likeCount)
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '操作失败')
    } finally { setLoading(false) }
  }

  if (variant === 'article') {
    return (
      <div className={className}>
        <Button
          type="button"
          size="lg"
          variant={liked ? 'default' : 'outline'}
          onClick={toggle}
          disabled={loading}
          className="min-w-40"
          aria-pressed={liked}
        >
          <Heart className={liked ? 'fill-current' : ''} />
          {liked ? '已点赞' : '点赞'}
          {count > 0 ? ` · ${count}` : ''}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {count > 0 ? `已有 ${count} 人为这篇文章点赞` : '觉得不错？给作者点个赞吧'}
        </p>
      </div>
    )
  }

  return (
    <Button variant={liked ? 'default' : 'outline'} size="sm" onClick={toggle}
          disabled={loading}>
      <Heart className={liked ? 'fill-current' : ''} />
      点赞 {count}
    </Button>
  )
}
