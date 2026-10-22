'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ChromeApi = {
  setPanel: (node: ReactNode) => void
  setArticleTitle: (title: string | null) => void
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
  children: (state: { panel: ReactNode; articleTitle: string | null }) => ReactNode
}) {
  const [panel, setPanel] = useState<ReactNode>(null)
  const [articleTitle, setArticleTitle] = useState<string | null>(null)
  const api = useMemo<ChromeApi>(
    () => ({
      setPanel: (node) => setPanel(node),
      setArticleTitle: (title) => setArticleTitle(title),
    }),
    [],
  )
  return (
    <ChromeCtx.Provider value={api}>{children({ panel, articleTitle })}</ChromeCtx.Provider>
  )
}
