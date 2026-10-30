'use client'

import { useEffect } from 'react'
import { scheduleArticleResourceWarmup, warmArticleResources } from '@/lib/article-resource-warmup'

export function ArticleResourceWarmup() {
  useEffect(() => scheduleArticleResourceWarmup(warmArticleResources), [])
  return null
}
