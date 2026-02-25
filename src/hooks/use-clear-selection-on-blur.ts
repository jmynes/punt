'use client'

import { useEffect } from 'react'
import { useSelectionStore } from '@/stores/selection-store'

/**
 * Hook that clears the ticket selection when the user switches to another
 * browser tab or window. This prevents confusion when returning to the app,
 * as previously selected tickets may no longer be relevant.
 *
 * Uses the Page Visibility API to detect when the document becomes hidden.
 */
export function useClearSelectionOnBlur() {
  const clearSelection = useSelectionStore((state) => state.clearSelection)
  const clearClipboard = useSelectionStore((state) => state.clearClipboard)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearSelection()
        clearClipboard()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clearSelection, clearClipboard])
}
