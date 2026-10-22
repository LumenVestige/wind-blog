import { headers } from 'next/headers'
import { requestOrigin } from './http'
export async function publicBase(): Promise<URL> {
  const h = await headers()
  return new URL(requestOrigin(new Request(`http://${h.get('host') || 'localhost:3000'}`, { headers: h })))
}
