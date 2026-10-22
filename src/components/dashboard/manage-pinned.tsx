'use client'
import Link from 'next/link'
import { useListMotion } from '@/components/motion/use-list-motion'
import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pin,
  PinOff,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { RequestError } from '@/components/ui/request-error'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  AdminPagination,
  AdminStatus,
  useAdminQuery,
} from './admin-ui'
import { api } from '@/lib/api-client'
interface Article {
  id: number
  title: string
  visibility: string
  isDraft: boolean
  pinned: boolean
}
function ArticlePicker({
  pinnedIds,
  busy,
  add,
}: {
  pinnedIds: Set<number>
  busy: boolean
  add: (article: Article) => Promise<void>
}) {
  const [q, setQ] = useState(''),
    [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10)
  const query = useAdminQuery<{ list: Article[]; total: number }>(
    '/api/user/blog/article/mine',
    { keyword, page, pageSize },
  )
  const eligible =
    query.data?.list.filter((item) => !pinnedIds.has(item.id)) || []
  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setKeyword(q.trim())
        }}
      >
        <Input
          aria-label="搜索待置顶文章"
          placeholder="搜索文章"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Button variant="outline" type="submit">
          <Search />
          搜索
        </Button>
      </form>
      {query.error ? (
        <RequestError error={query.error} retry={() => void query.refresh()} />
      ) : query.loading ? (
        <AdminLoading />
      ) : !eligible.length ? (
        <AdminEmpty
          title="当前页没有可添加的文章"
          description="可切换页码或搜索其他文章。"
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {eligible.map((item) => (
            <li className="flex items-center gap-3 p-4" key={item.id}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.isDraft
                    ? '草稿不可置顶'
                    : item.visibility === 'private'
                      ? '私密文章不可置顶'
                      : item.visibility === 'password'
                        ? '密码保护'
                        : '公开'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || item.isDraft || item.visibility === 'private'}
                onClick={() => void add(item)}
              >
                <Pin />
                添加
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AdminPagination
        page={page}
        pageSize={pageSize}
        total={query.data?.total || 0}
        disabled={query.loading}
        onChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </div>
  )
}
export function ManagePinned() {
  const query = useAdminQuery<Article[]>('/api/user/blog/article/pinned/mine')
  const [picker, setPicker] = useState(false),
    [busy, setBusy] = useState(false),
    [dragOver, setDragOver] = useState<number | null>(null)
  const drag = useRef<number | null>(null),
    list = query.data || []
  const listRef = useListMotion(list.map(item => item.id).join(','))
  async function toggle(item: Article, pinned: boolean) {
    setBusy(true)
    try {
      await api.post('/api/user/blog/article/pin', { id: item.id, pinned })
      await query.refresh()
      toast.success(pinned ? '文章已置顶' : '已取消置顶')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }
  async function move(from: number, to: number) {
    if (busy || from === to || to < 0 || to >= list.length) return
    const previous = [...list],
      next = [...list],
      [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    query.setData(next)
    setBusy(true)
    try {
      await api.post('/api/user/blog/article/pinned/reorder', {
        articleIds: next.map((item) => item.id),
      })
      toast.success('置顶顺序已保存')
    } catch (error) {
      query.setData(previous)
      toast.error(error instanceof Error ? error.message : '排序保存失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AdminHeading
        title="首页置顶"
        description="设置首页优先展示的文章及顺序。"
        actions={
          <Button onClick={() => setPicker(true)}>
            <Pin data-icon="inline-start" />
            添加文章
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>置顶文章</CardTitle>
          <CardDescription>
            拖动或使用上下箭头排序，修改后自动保存。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.error ? (
            <RequestError
              error={query.error}
              retry={() => void query.refresh()}
            />
          ) : query.loading ? (
            <AdminLoading />
          ) : !list.length ? (
            <AdminEmpty
              title="还没有置顶文章"
              action={
                <Button variant="outline" onClick={() => setPicker(true)}>
                  添加文章
                </Button>
              }
            />
          ) : (
            <ol ref={listRef} className="divide-y rounded-lg border" aria-busy={busy}>
              {list.map((item, index) => (
                <li
                  key={item.id}
                  data-motion-key={item.id}
                  draggable={!busy}
                  onDragStart={() => {
                    drag.current = index
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(index)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (drag.current !== null) void move(drag.current, index)
                    drag.current = null
                    setDragOver(null)
                  }}
                  onDragEnd={() => {
                    drag.current = null
                    setDragOver(null)
                  }}
                  className={`flex items-center gap-3 p-4 ${dragOver === index ? 'bg-muted' : ''}`}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/manage/edit/${item.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`上移：${item.title}`}
                    disabled={busy || index === 0}
                    onClick={() => void move(index, index - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`下移：${item.title}`}
                    disabled={busy || index === list.length - 1}
                    onClick={() => void move(index, index + 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`取消置顶：${item.title}`}
                    disabled={busy}
                    onClick={() => void toggle(item, false)}
                  >
                    <PinOff />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <Sheet open={picker} onOpenChange={setPicker}>
        <SheetContent className="flex flex-col gap-5 overflow-y-auto p-6 sm:max-w-lg">
          <SheetHeader className="p-0">
            <SheetTitle>添加置顶文章</SheetTitle>
            <SheetDescription>
              从已发布的公开或密码文章中选择。
            </SheetDescription>
          </SheetHeader>
          {picker && (
            <ArticlePicker
              pinnedIds={new Set(list.map((item) => item.id))}
              busy={busy}
              add={(item) => toggle(item, true)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
