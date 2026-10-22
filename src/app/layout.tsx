import { siteName } from '@/server/tenant'
import { publicBase } from '@/server/metadata'
import type { Metadata } from 'next'
import './globals.css'
import 'katex/dist/katex.min.css'
import '@/styles/code-hl.css'
import '@/styles/markdown-body.css'
import '@/styles/blog-mizuki.css'
import '@/styles/blog-chirpy.css'
import { Toaster } from '@/components/ui/sonner'

export async function generateMetadata(): Promise<Metadata> {
  const name = siteName()
  return { metadataBase: await publicBase(), title: { default: name, template: `%s · ${name}` }, description: '一个独立的个人博客' }
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
