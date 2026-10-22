import { requireManageViewer } from '@/server/manage-access'
import { findUserById } from '@/server/users'
import { expandUrl } from '@/server/images'
import { manageSettingsSnapshot } from '@/server/manage-settings'
import { BlogSettings } from '@/components/dashboard/blog-settings'
import type { SettingsSection } from '@/lib/admin-settings'
export async function ManageSettingsContent({
  section,
}: {
  section: SettingsSection | 'account'
}) {
  const viewer = await requireManageViewer('/manage/settings'),
    user = findUserById(viewer.id)!
  return (
    <BlogSettings
      key={section}
      section={section}
      snapshot={manageSettingsSnapshot(user.id)}
      account={{
        username: user.username,
        email: user.email,
        avatar: expandUrl(user.avatar),
      }}
    />
  )
}
