import type { NextRequest } from 'next/server'

export interface Ctx {
  req: NextRequest
  method: string
  path: string[]
  query: URLSearchParams
  /** dynamic segments captured by the router (e.g. static file path) */
  params?: Record<string, string>
}

export type Handler = (ctx: Ctx) => Promise<Response> | Response
