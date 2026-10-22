import { siteName } from '@/server/tenant'
import { publicBase } from '@/server/metadata'
import { siteOwner } from '@/server/tenant'
import { getSetting } from '@/lib/settings'
import { expandUrl } from '@/server/images'
import type { Metadata } from 'next'
import './globals.css'
import 'katex/dist/katex.min.css'
import 'viewerjs/dist/viewer.css'
import '@/styles/code-hl.css'
import '@/styles/markdown-body.css'
import '@/styles/blog-mizuki.css'
import '@/styles/blog-chirpy.css'
import '@/styles/blog-motion.css'
import { Toaster } from '@/components/ui/sonner'

export async function generateMetadata(): Promise<Metadata> {
  const name = siteName()
  const custom = expandUrl(getSetting('favicon_url', ''))
  const avatar = expandUrl(siteOwner().avatar || '')
  const icon = custom || avatar || '/favicon.svg'
  const icons = custom || avatar
    ? { icon, apple: icon }
    : { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon.png', type: 'image/png' }], apple: '/apple-touch-icon.png' }
  return { metadataBase: await publicBase(), title: { default: name, template: `%s · ${name}` }, description: '一个独立的个人博客', icons }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
