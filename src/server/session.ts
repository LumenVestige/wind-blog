import { cookieName } from './http'
import { cookies } from 'next/headers'
import { currentUser } from '@/lib/api'
import type { AuthUser } from '@/lib/jwt'

export async function getViewer(): Promise<AuthUser | null> {
  const store = await cookies()
  const token = store.get(cookieName('wind_token'))?.value
  if (!token) return null
  return currentUser(new Request('http://session.local', {
    headers: { authorization: `Bearer ${token}` },
  }))
}
