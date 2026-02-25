import { getEffectiveDuration, rawToast as toast } from '@/lib/toast'

type ToastKind = 'success' | 'error'

interface UndoRedoToastOptions {
  title: string
  description: React.ReactNode
  duration?: number
}

/**
 * Show an informational toast notification.
 * Note: Undo/redo buttons have been removed from toasts.
 * Use Ctrl+Z / Ctrl+Y keyboard shortcuts for undo/redo operations.
 */
export function showUndoRedoToast(kind: ToastKind, opts: UndoRedoToastOptions) {
  const { title, description, duration = 5000 } = opts

  const toastFn = kind === 'error' ? toast.error : toast.success
  const isError = kind === 'error'
  const effectiveDuration = getEffectiveDuration(duration, isError)

  return toastFn(title, {
    description,
    duration: effectiveDuration,
    closeButton: isError && !Number.isFinite(effectiveDuration),
  })
}
