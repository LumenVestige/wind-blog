import type { NextRequest } from 'next/server'
import { dispatch } from '@/server/api/router'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  return dispatch(req, path || [])
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
