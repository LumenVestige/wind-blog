import { afterEach, expect, it, vi } from 'vitest'
import { generateMetadata } from '@/app/layout'
import { closeDb } from '@/db'

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'test.local' }),
}))

afterEach(() => {
  closeDb()
  vi.unstubAllEnvs()
})

it('generates default metadata before the site owner is created', async () => {
  vi.stubEnv('DB_PATH', ':memory:')

  await expect(generateMetadata()).resolves.toMatchObject({
    title: { default: 'Wind Blog' },
    icons: { icon: [{ url: '/favicon.svg' }, { url: '/favicon.png' }] },
  })
})
