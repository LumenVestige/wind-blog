import { redirect } from 'next/navigation'
import { isInitialized } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  // Single tenant: no public registration.
  redirect(isInitialized() ? '/login' : '/setup')
}
