'use client'

import { useCallback, useEffect } from 'react'

interface UseCtrlSaveOptions {
  /**
   * Callback to trigger when Ctrl+S (or Cmd+S on Mac) is pressed
   */
  onSave: () => void
  /**
   * Whether the save shortcut is enabled. Defaults to true.
   * Use this to disable the shortcut when there are no changes to save.
   */
  enabled?: boolean
}

/**
 * Hook to handle Ctrl+S (Windows/Linux) or Cmd+S (Mac) keyboard shortcut for saving.
 * Prevents the browser's default "Save Page As" dialog.
 *
 * @example
 * ```tsx
 * useCtrlSave({
 *   onSave: handleSave,
 *   enabled: hasUnsavedChanges
 * })
 * ```
 */
export function useCtrlSave({ onSave, enabled = true }: UseCtrlSaveOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Always prevent default to avoid "Save Page As" dialog
        e.preventDefault()

        // Only trigger save if enabled
        if (enabled) {
          onSave()
        }
      }
    },
    [onSave, enabled],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
