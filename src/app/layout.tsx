import { getOwner, siteName } from '@/server/tenant'
import { publicBase, siteDescription } from '@/server/metadata'
import { getSetting } from '@/lib/settings'
import { expandUrl } from '@/server/images'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import './globals.css'
import 'katex/dist/katex.min.css'
import 'viewerjs/dist/viewer.css'
import '@/styles/code-hl.css'
import '@/styles/markdown-body.css'
import '@/styles/blog-mizuki.css'
import '@/styles/blog-chirpy.css'
import '@/styles/blog-motion.css'
import '@/styles/motion.css'
import '@/styles/typography.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeScript } from '@/components/blog/theme-script'
import { defaultColorScheme } from '@/server/blog/site'
import { DeferredFonts } from '@/components/blog/deferred-fonts'
import { typographyAssets } from '@/lib/font-assets'
import { typographySettings } from '@/server/typography'
import { typographyStyles } from '@/lib/typography'

export async function generateMetadata(): Promise<Metadata> {
  const name = siteName()
  const custom = expandUrl(getSetting('favicon_url', ''))
  const avatar = expandUrl(getOwner()?.avatar || '')
  const icon = custom || avatar || '/favicon.svg'
  const icons = custom || avatar
    ? { icon, apple: icon }
    : { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon.png', type: 'image/png' }], apple: '/apple-touch-icon.png' }
  return { metadataBase: await publicBase(), title: { default: name, template: `%s · ${name}` }, description: siteDescription(), icons }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const typography = typographySettings()
  const fonts = typographyAssets(typography)
  return (
    <html
      lang="zh-CN"
      data-prose-font={typography.wenkaiEnabled ? 'wenkai' : undefined}
      style={typographyStyles(typography) as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        {fonts.preload && <link rel="preload" href={fonts.preload} as="font" type="font/woff2" crossOrigin="anonymous" />}
        {fonts.stylesheet && <link rel="stylesheet" href={fonts.stylesheet} />}
        <ThemeScript scheme={defaultColorScheme()} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        {fonts.deferred.map(asset => <DeferredFonts key={asset.href} {...asset} />)}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
