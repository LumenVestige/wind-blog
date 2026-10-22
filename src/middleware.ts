import { NextResponse, type NextRequest } from 'next/server'
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers)
  headers.set('x-wind-path', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.next({ request: { headers } })
}
export const config = { matcher: ['/manage/:path*', '/dashboard/:path*'] }
