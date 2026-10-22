import { getDb, transaction } from './index'
import { createUser, findUserByUsername, findUserByEmail } from '@/server/users'
import { sha256Hex } from '@/lib/password'
import { isInitialized } from '@/server/tenant'
import { activate, ensureSiteConfig } from '@/server/blog/site'

export function seedAdmin(): void {
  getDb()
  if (isInitialized()) { console.log('[wind-blog] site already initialized'); return }
  const username = process.env.ADMIN_USERNAME || 'admin'
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase()
  const plain = process.env.ADMIN_PASSWORD
  if (!plain || plain === 'admin123456' || plain.length < 12) throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters')
  if (findUserByUsername(username) || findUserByEmail(email)) {
    console.log(`[wind-blog] admin account already exists: ${username}`)
    return
  }
  transaction(() => {
    if (isInitialized()) return
    const user = createUser({
      username,
      email,
      name: username,
      clientPasswordHash: sha256Hex(plain),
      isSiteAdmin: true,
    })
    ensureSiteConfig(user.id)
    activate(user.id, { accept: true })
    console.log(`[wind-blog] created admin "${username}" (${email})`)
  })
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedAdmin()
}
