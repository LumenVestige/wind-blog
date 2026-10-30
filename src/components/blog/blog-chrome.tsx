'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { TocItem } from './article-toc'

type ChromeApi = {
  setPanel: (node: ReactNode) => void
  setArticleTitle: (title: string | null) => void
  setArticleToc: (toc: TocItem[]) => void
}

const ChromeCtx = createContext<ChromeApi | null>(null)

export function useBlogChrome(): ChromeApi | null {
  return useContext(ChromeCtx)
}

/**
 * Lets an article page fill the shell's right rail and breadcrumb
 * without lifting state through the server layout.
 */
export function BlogChrome({
  children,
}: {
  children: (state: { panel: ReactNode; articleTitle: string | null; articleToc: TocItem[] }) => ReactNode
}) {
  const [panel, setPanel] = useState<ReactNode>(null)
  const [articleTitle, setArticleTitle] = useState<string | null>(null)
  const [articleToc, setArticleToc] = useState<TocItem[]>([])
  const api = useMemo<ChromeApi>(
    () => ({
      setPanel: (node) => setPanel(node),
      setArticleTitle: (title) => setArticleTitle(title),
      setArticleToc: (toc) => setArticleToc(toc),
    }),
    [],
  )
  return (
    <ChromeCtx.Provider value={api}>{children({ panel, articleTitle, articleToc })}</ChromeCtx.Provider>
  )
}
