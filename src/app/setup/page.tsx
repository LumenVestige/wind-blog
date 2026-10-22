import { redirect } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { isInitialized } from '@/server/tenant'
import { SetupForm } from '@/components/auth/setup-form'

export const dynamic = 'force-dynamic'

export default function SetupPage() {
  if (isInitialized()) redirect('/login')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2 text-xl font-semibold">
        <BookOpen className="h-6 w-6 text-primary" />
        Wind Blog
      </div>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        首次使用，请创建站点管理员账号完成初始化。
      </p>
      <SetupForm />
    </div>
  )
}
