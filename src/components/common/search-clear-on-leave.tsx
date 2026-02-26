'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useBacklogStore } from '@/stores/backlog-store'

const PROJECT_VIEW_PATTERN = /^\/projects\/[^/]+\/(backlog|board|sprints)$/

/**
 * Clears PQL/search state when the user navigates away from project views
 * (backlog, board, sprints) to any other page (preferences, admin, dashboard, etc.).
 * Lives in the app layout so the ref persists across navigations.
 */
export function SearchClearOnLeave() {
  const pathname = usePathname()
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    const wasProjectView = PROJECT_VIEW_PATTERN.test(prevPathRef.current)
    const isProjectView = PROJECT_VIEW_PATTERN.test(pathname)
    prevPathRef.current = pathname

    if (wasProjectView && !isProjectView) {
      const store = useBacklogStore.getState()
      store.setSearchQuery('')
      store.setQueryText('')
      store.setQueryMode(false)
      store.setSearchProjectId(null)
    }
  }, [pathname])

  return null
}
