import { Skeleton } from '@/components/ui/skeleton'

/** Also cover navigation outside the public blog (management, login, setup). */
export default function Loading() {
  return <div className="space-y-6 p-6" role="status" aria-busy="true" aria-label="页面加载中">
    <span className="sr-only">页面加载中…</span>
    <Skeleton className="h-8 w-48" />
    <div className="space-y-4 rounded-xl border bg-card p-6">
      {[100, 92, 80, 100, 88, 68].map((width, index) => <Skeleton key={index} className="h-4" style={{ width: `${width}%` }} />)}
    </div>
  </div>
}
