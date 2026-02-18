/**
 * Centralized toast notification system.
 *
 * This module provides consistent toast notifications across the app with:
 * - Standardized durations
 * - Consistent styling and messaging patterns
 * - Built-in undo/redo support
 * - Loading state helpers
 * - User-configurable auto-dismiss behavior
 *
 * Usage:
 *   import { showToast } from '@/lib/toast'
 *
 *   showToast.success('Project created')
 *   showToast.error('Failed to delete ticket')
 *   showToast.info('Settings are read-only in demo mode')
 *   showToast.warning('This action cannot be undone')
 *   showToast.withUndo('Ticket deleted', { onUndo: () => restore() })
 *   showToast.loading('Saving...', async () => saveData())
 */

import { toast } from 'sonner'
import { useSettingsStore } from '@/stores/settings-store'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Standard toast durations in milliseconds.
 * Keep these consistent across the app.
 */
export const TOAST_DURATION = {
  /** Quick feedback (2s) - for confirmations, minor actions */
  SHORT: 2000,
  /** Standard feedback (4s) - default for most notifications */
  DEFAULT: 4000,
  /** Extended feedback (5s) - for undo-able actions */
  WITH_ACTION: 5000,
  /** Longer visibility (6s) - for important messages users need to read */
  LONG: 6000,
  /** Infinity - toast stays until manually dismissed */
  INFINITE: Number.POSITIVE_INFINITY,
} as const

/**
 * Get toast preferences from the settings store.
 * Returns the user's configured toast behavior.
 */
function getToastPreferences() {
  const state = useSettingsStore.getState()
  return {
    autoDismiss: state.toastAutoDismiss,
    dismissDelay: state.toastDismissDelay,
    errorAutoDismiss: state.errorToastAutoDismiss,
  }
}

/**
 * Get the effective duration for a toast based on user preferences.
 * @param requestedDuration - The duration requested by the caller
 * @param isError - Whether this is an error toast
 * @returns The effective duration to use
 */
function getEffectiveDuration(requestedDuration: number | undefined, isError = false): number {
  const prefs = getToastPreferences()
  const autoDismiss = isError ? prefs.errorAutoDismiss : prefs.autoDismiss

  if (!autoDismiss) {
    return TOAST_DURATION.INFINITE
  }

  // If a specific duration was requested, scale it by the user's preference ratio
  if (requestedDuration !== undefined) {
    const defaultDuration = TOAST_DURATION.DEFAULT
    const ratio = prefs.dismissDelay / defaultDuration
    return Math.round(requestedDuration * ratio)
  }

  return prefs.dismissDelay
}

// =============================================================================
// Types
// =============================================================================

type ToastId = string | number

interface ToastOptions {
  /** Optional description below the title */
  description?: string
  /** Custom duration in ms (use TOAST_DURATION constants) */
  duration?: number
  /** Toast ID for programmatic control */
  id?: ToastId
}

interface UndoToastOptions extends Omit<ToastOptions, 'duration'> {
  /** Called when user clicks Undo */
  onUndo: () => void | Promise<void>
  /** Custom undo button label (default: "Undo") */
  undoLabel?: string
  /** Duration before toast auto-dismisses (default: WITH_ACTION) */
  duration?: number
}

interface LoadingToastOptions {
  /** Loading message (default: "Loading...") */
  loadingMessage?: string
  /** Success message after promise resolves */
  successMessage?: string | ((data: unknown) => string)
  /** Error message after promise rejects (default: shows error.message) */
  errorMessage?: string | ((error: Error) => string)
  /** Description for loading state */
  description?: string
}

// =============================================================================
// Core Toast Functions
// =============================================================================

/**
 * Show a success toast.
 * Use for completed actions: creation, updates, deletions, etc.
 */
function success(message: string, options?: ToastOptions): ToastId {
  return toast.success(message, {
    description: options?.description,
    duration: getEffectiveDuration(options?.duration),
    id: options?.id,
  })
}

/**
 * Show an error toast.
 * Use for failed operations, validation errors, etc.
 */
function error(message: string, options?: ToastOptions): ToastId {
  return toast.error(message, {
    description: options?.description,
    duration: getEffectiveDuration(options?.duration, true),
    id: options?.id,
  })
}

/**
 * Show an info toast.
 * Use for informational messages, demo mode notices, etc.
 */
function info(message: string, options?: ToastOptions): ToastId {
  return toast.info(message, {
    description: options?.description,
    duration: getEffectiveDuration(options?.duration),
    id: options?.id,
  })
}

/**
 * Show a warning toast.
 * Use for cautions, partial successes, etc.
 */
function warning(message: string, options?: ToastOptions): ToastId {
  return toast.warning(message, {
    description: options?.description,
    duration: getEffectiveDuration(options?.duration),
    id: options?.id,
  })
}

/**
 * Show a success toast with an Undo button.
 * Use for reversible actions like delete, move, update.
 */
function withUndo(message: string, options: UndoToastOptions): ToastId {
  return toast.success(message, {
    description: options.description,
    duration: getEffectiveDuration(options.duration ?? TOAST_DURATION.WITH_ACTION),
    id: options.id,
    action: {
      label: options.undoLabel ?? 'Undo',
      onClick: () => {
        void options.onUndo()
      },
    },
  })
}

/**
 * Show an error toast with an Undo button (for undo-able failures).
 * Use when showing deleted/removed state that can be restored.
 */
function errorWithUndo(message: string, options: UndoToastOptions): ToastId {
  return toast.error(message, {
    description: options.description,
    duration: getEffectiveDuration(options.duration ?? TOAST_DURATION.WITH_ACTION, true),
    id: options.id,
    action: {
      label: options.undoLabel ?? 'Undo',
      onClick: () => {
        void options.onUndo()
      },
    },
  })
}

/**
 * Show a loading toast that transitions to success/error.
 * Use for async operations where you want to show progress.
 *
 * @example
 * showToast.loading(saveProject(), {
 *   loadingMessage: 'Saving project...',
 *   successMessage: 'Project saved',
 *   errorMessage: 'Failed to save project'
 * })
 */
function loading<T>(promise: Promise<T>, options?: LoadingToastOptions): Promise<T> {
  const loadingMessage = options?.loadingMessage ?? 'Loading...'
  const successMessage = options?.successMessage ?? 'Done'
  const errorMessage = options?.errorMessage ?? ((err: Error) => err.message || 'An error occurred')

  toast.promise(promise, {
    loading: loadingMessage,
    success: (data) => {
      if (typeof successMessage === 'function') {
        return successMessage(data)
      }
      return successMessage
    },
    error: (err) => {
      if (typeof errorMessage === 'function') {
        return errorMessage(err as Error)
      }
      return errorMessage
    },
    description: options?.description,
  })

  return promise
}

/**
 * Dismiss a toast by ID.
 */
function dismiss(toastId?: ToastId): void {
  toast.dismiss(toastId)
}

/**
 * Dismiss all toasts.
 */
function dismissAll(): void {
  toast.dismiss()
}

// =============================================================================
// Specialized Toast Helpers
// =============================================================================

/**
 * Show a "copied to clipboard" toast.
 */
function copied(item?: string): ToastId {
  const message = item ? `${item} copied to clipboard` : 'Copied to clipboard'
  return success(message, { duration: TOAST_DURATION.SHORT })
}

/**
 * Show a demo mode notice.
 */
function demoModeNotice(feature: string): ToastId {
  return info(`${feature} is disabled in demo mode`, { duration: TOAST_DURATION.DEFAULT })
}

/**
 * Show an action with keyboard shortcut hint.
 */
function actionWithHint(message: string, hint: string, options?: ToastOptions): ToastId {
  return success(message, {
    ...options,
    description: options?.description ? `${options.description} (${hint})` : hint,
    duration: options?.duration ?? TOAST_DURATION.DEFAULT,
  })
}

// =============================================================================
// Export
// =============================================================================

/**
 * Centralized toast notification system.
 *
 * @example
 * // Basic toasts
 * showToast.success('Ticket created')
 * showToast.error('Failed to save')
 * showToast.info('Demo mode active')
 * showToast.warning('Large file detected')
 *
 * // With undo action
 * showToast.withUndo('Ticket deleted', {
 *   description: 'PUNT-42',
 *   onUndo: () => restoreTicket(id)
 * })
 *
 * // Loading state
 * showToast.loading(saveProject(), {
 *   loadingMessage: 'Saving...',
 *   successMessage: 'Saved!',
 * })
 *
 * // Quick helpers
 * showToast.copied('API key')
 * showToast.demoModeNotice('File uploads')
 */
export const showToast = {
  // Core
  success,
  error,
  info,
  warning,

  // With actions
  withUndo,
  errorWithUndo,
  loading,

  // Control
  dismiss,
  dismissAll,

  // Helpers
  copied,
  demoModeNotice,
  actionWithHint,

  // Duration constants for custom use
  DURATION: TOAST_DURATION,
} as const

// Re-export the raw toast for edge cases where direct access is needed
export { toast as rawToast }
