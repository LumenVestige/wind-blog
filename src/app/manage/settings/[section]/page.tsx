import { notFound } from 'next/navigation'
import { ManageSettingsContent } from '@/server/manage-settings-page'
import { settingsNav } from '@/lib/admin-nav'
import type { SettingsSection } from '@/lib/admin-settings'
export const dynamic = 'force-dynamic'
export default async function ManageSettingsSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!settingsNav.some(item => item.id === section)) notFound()
  return <ManageSettingsContent section={section as SettingsSection | 'account'} />
}
