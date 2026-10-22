import { get, run, transaction } from '@/db'
import { ApiError } from '@/lib/api'

/** Persistent fixed window limits, shared by processes using the same database. */
export function rateLimit(key: string, max: number, windowMs = 15 * 60 * 1000): void {
  const now = Date.now()
  const attempts = transaction(() => {
    run('DELETE FROM security_rate_limits WHERE expires_at <= ?', now)
    run(`INSERT INTO security_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1`, key, now + windowMs)
    return get<{ attempts: number }>('SELECT attempts FROM security_rate_limits WHERE key = ?', key)!.attempts
  })
  if (attempts > max) throw new ApiError('尝试过于频繁，请稍后再试', 429, 429)
}
