import {
  BarChart3,
  FileCode2,
  Files,
  FolderOpen,
  House,
  Image,
  Link2,
  Paintbrush,
  Pin,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Text,
} from 'lucide-react'
export const settingsNav = [
  { id: 'general', label: '基本信息', icon: Settings2 },
  { id: 'appearance', label: '外观', icon: Paintbrush },
  { id: 'content', label: '页面内容', icon: Text },
  { id: 'social', label: '社交链接', icon: Link2 },
  { id: 'interaction', label: '访客互动', icon: SlidersHorizontal },
  { id: 'storage', label: '存储与上传', icon: Image },
  { id: 'account', label: '账号安全', icon: ShieldCheck },
] as const
export const adminNav = [
  { label: '工作台', icon: House, href: '/manage' },
  {
    label: '内容管理',
    icon: Files,
    items: [
      { label: '全部文章', href: '/manage/articles', icon: Files },
      { label: '草稿箱', href: '/manage/articles?status=draft', icon: Text },
      { label: '首页置顶', href: '/manage/pinned', icon: Pin },
      { label: '分类', href: '/manage/categories', icon: FolderOpen },
      { label: '静态页面', href: '/manage/pages', icon: FileCode2 },
      { label: '静态站点', href: '/manage/static-sites', icon: Image },
    ],
  },
  { label: '数据概览', icon: BarChart3, href: '/manage/analytics' },
  {
    label: '站点设置',
    icon: Settings2,
    items: settingsNav.map((item) => ({
      label: item.label,
      href:
        item.id === 'general'
          ? '/manage/settings'
          : `/manage/settings/${item.id}`,
      icon: item.icon,
    })),
  },
] as const
export function adminNavActive(href: string, pathname: string, search: string) {
  const [path, query = ''] = href.split('?')
  if (path !== pathname) return false
  const actual = new URLSearchParams(search),
    expected = new URLSearchParams(query)
  if (pathname === '/manage/articles')
    return (
      (actual.get('status') === 'draft') ===
      (expected.get('status') === 'draft')
    )
  return [...expected].every(([key, value]) => actual.get(key) === value)
}
export function adminLocation(pathname: string, search: string) {
  for (const group of adminNav) {
    if ('href' in group && adminNavActive(group.href, pathname, search))
      return { group: '', title: group.label }
    if ('items' in group) {
      const item = group.items.find((item) =>
        adminNavActive(item.href, pathname, search),
      )
      if (item) return { group: group.label, title: item.label }
    }
  }
  if (pathname === '/manage/new' || pathname.startsWith('/manage/edit/'))
    return {
      group: '内容管理',
      title: pathname === '/manage/new' ? '写文章' : '编辑文章',
    }
  if (pathname.startsWith('/manage/pages/'))
    return {
      group: '静态页面',
      title: pathname.endsWith('/new') ? '新建页面' : '编辑页面',
    }
  return { group: '', title: '管理后台' }
}
