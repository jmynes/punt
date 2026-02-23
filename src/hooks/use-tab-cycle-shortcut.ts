'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'

interface UseTabCycleShortcutOptions {
  /**
   * Ordered list of tab identifiers to cycle through.
   * For route-based tabs: full paths (e.g., `/projects/PROJ/board`).
   * For query-based tabs: query param values (e.g., `general`).
   */
  tabs: string[]

  /**
   * If set, tabs are identified by `?tab=<value>` query parameter
   * instead of by full pathname. The value is the base path
   * (e.g., `/projects/PROJ/settings`).
   */
  queryBasePath?: string
}

/**
 * Hook that adds Ctrl+Shift+ArrowLeft/ArrowRight keyboard shortcuts
 * to cycle between view tabs. Wraps around at the ends (last -> first
 * and first -> last).
 *
 * Skips when focus is in a text input, textarea, or contenteditable element.
 *
 * @example Route-based tabs (project views):
 * ```tsx
 * useTabCycleShortcut({
 *   tabs: [
 *     `/projects/${key}/board`,
 *     `/projects/${key}/backlog`,
 *     `/projects/${key}/sprints`,
 *     `/projects/${key}/burndown`,
 *   ],
 * })
 * ```
 *
 * @example Query-based tabs (settings pages):
 * ```tsx
 * useTabCycleShortcut({
 *   tabs: ['general', 'members', 'labels', 'roles'],
 *   queryBasePath: `/projects/${key}/settings`,
 * })
 * ```
 */
export function useTabCycleShortcut({ tabs, queryBasePath }: UseTabCycleShortcutOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle Ctrl+Shift+Arrow (or Cmd+Shift+Arrow on Mac)
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

      // Don't handle when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (tabs.length === 0) return

      e.preventDefault()

      const direction = e.key === 'ArrowRight' ? 1 : -1

      let currentIndex: number

      if (queryBasePath) {
        // Query-based tabs: match on ?tab= parameter
        if (pathname !== queryBasePath) return
        const currentTab = searchParams.get('tab')
        // If no tab param, treat as first tab (the default)
        currentIndex = currentTab === null ? 0 : tabs.indexOf(currentTab)
      } else {
        // Route-based tabs: match on pathname
        currentIndex = tabs.indexOf(pathname)
      }

      if (currentIndex === -1) return

      // Wrap-around navigation
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length
      const nextTab = tabs[nextIndex]

      if (queryBasePath) {
        router.push(`${queryBasePath}?tab=${nextTab}`)
      } else {
        router.push(nextTab)
      }
    },
    [tabs, queryBasePath, router, pathname, searchParams],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
