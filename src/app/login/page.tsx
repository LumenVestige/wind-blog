import { redirect } from 'next/navigation'
import { isInitialized } from '@/server/tenant'
import { LoginForm } from '@/components/auth/login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  if (!isInitialized()) redirect('/setup')
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm />
    </div>
  )
}
