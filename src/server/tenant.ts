import { redirect } from 'next/navigation'
import { get } from '@/db'
import { getSetting } from '@/lib/settings'
import type { UserRow } from './users'

/** Single-tenant: the site is initialized once the owner account exists. */
export function ownerCount(): number {
  return Number(get<{ c: number }>('SELECT COUNT(*) AS c FROM users')?.c) || 0
}

export function isInitialized(): boolean {
  return ownerCount() > 0
}

export function getOwner(): UserRow | undefined {
  return get<UserRow>('SELECT * FROM users ORDER BY id ASC LIMIT 1')
}

/** The single site owner. Sends visitors to setup when the site is empty. */
export function siteOwner(): UserRow {
  const owner = getOwner()
  if (!owner) redirect('/setup')
  return owner
}

export function siteName(): string {
  return getSetting('site_name', 'Wind Blog') || 'Wind Blog'
}
