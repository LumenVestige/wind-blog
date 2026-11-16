import type { HomeLayout } from '@/lib/blog-layout'

export interface ShellSocialLink {
  type: string
  url: string
  label?: string
}

export interface BlogShellData {
  homeLayout: HomeLayout
  siteName: string
  username: string
  displayName: string
  avatar: string
  subtitle: string
  socialLinks: ShellSocialLink[]
  aboutArticle: { id: number; slug: string; title: string } | null
  friendsArticle: { id: number; slug: string; title: string } | null
  isOwner: boolean
  icpNumber: string
  recentPosts: { id: number; slug: string; title: string; publishedAt: number; viewCount: number }[]
  categories: { id: number; name: string; articleCount: number }[]
  tags: { name: string; count: number }[]
  pages: { slug: string; label: string }[]
  staticSites: { slug: string; label: string; publicPath: string }[]
}
