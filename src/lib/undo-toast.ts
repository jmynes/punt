import { getEffectiveDuration, rawToast as toast } from '@/lib/toast'

type ToastKind = 'success' | 'error'

interface UndoRedoToastOptions {
  title: string
  description: React.ReactNode
  duration?: number
  showUndoButtons: boolean
  /** Return false to prevent showing the nested "undone" toast */
  onUndo: (id: string | number) => void | boolean | Promise<void | boolean>
  /** Return false to prevent showing the nested "redone" toast */
  onRedo?: (id: string | number) => void | boolean | Promise<void | boolean>
  onUndoneToast?: (id: string | number) => void
  onRedoneToast?: (id: string | number) => void
  undoLabel?: string
  redoLabel?: string
  undoneTitle?: string
  undoneDescription?: React.ReactNode
  redoneTitle?: string
  redoneDescription?: React.ReactNode
  /** Toast ID to dismiss before showing this toast (for replacing toasts) */
  dismissPrevious?: string | number
}

export function showUndoRedoToast(kind: ToastKind, opts: UndoRedoToastOptions) {
  const {
    title,
    description,
    duration = 5000,
    showUndoButtons,
    onUndo,
    onRedo,
    onUndoneToast,
    onRedoneToast,
    undoLabel = 'Undo',
    redoLabel = 'Redo',
    undoneTitle = 'Action undone',
    undoneDescription = description,
    redoneTitle = 'Action redone',
    redoneDescription = description,
    dismissPrevious,
  } = opts

  // Dismiss the previous toast if specified (for replacing toasts instead of stacking)
  if (dismissPrevious !== undefined) {
    toast.dismiss(dismissPrevious)
  }

  const toastFn = kind === 'error' ? toast.error : toast.success
  const isError = kind === 'error'
  const effectiveDuration = getEffectiveDuration(duration, isError)
  const confirmDuration = getEffectiveDuration(2000, isError)

  let toastId: string | number | undefined

  toastId = toastFn(title, {
    description,
    duration: effectiveDuration,
    closeButton: isError && !Number.isFinite(effectiveDuration),
    action: showUndoButtons
      ? {
          label: undoLabel,
          onClick: async () => {
            if (!toastId) return
            // Call onUndo and check if it returns false (blocked by isProcessing)
            const result = await onUndo(toastId)
            if (result === false) return // Blocked, don't show nested toast

            if (onRedo && showUndoButtons) {
              const undoneToastId = toastFn(undoneTitle, {
                description: undoneDescription,
                duration: confirmDuration,
                action: {
                  label: redoLabel,
                  onClick: async () => {
                    const redoResult = await onRedo(undoneToastId)
                    if (redoResult === false) return // Blocked

                    let redoneToastId: string | number | undefined
                    redoneToastId = toastFn(redoneTitle, {
                      description: redoneDescription,
                      duration: confirmDuration,
                      action: {
                        label: undoLabel,
                        onClick: async () => {
                          if (redoneToastId) await onUndo(redoneToastId)
                          // We could continue chaining here, but 3 levels is usually enough
                          // Ideally this would recurse or use a better structure
                        },
                      },
                    })
                    if (redoneToastId) onRedoneToast?.(redoneToastId)
                  },
                },
              })
              onUndoneToast?.(undoneToastId)
            }
          },
        }
      : undefined,
  })

  // In case synchronous execution happened (unlikely for toast), ensure we return a value
  return toastId as string | number
}
