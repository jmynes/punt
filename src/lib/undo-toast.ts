import { toast } from 'sonner'

type ToastKind = 'success' | 'error'

interface UndoRedoToastOptions {
  title: string
  description: React.ReactNode
  duration?: number
  showUndoButtons: boolean
  onUndo: (id: string | number) => void
  onRedo?: (id: string | number) => void
  onUndoneToast?: (id: string | number) => void
  onRedoneToast?: (id: string | number) => void
  undoLabel?: string
  redoLabel?: string
  undoneTitle?: string
  undoneDescription?: React.ReactNode
  redoneTitle?: string
  redoneDescription?: React.ReactNode
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
  } = opts

  const toastFn = kind === 'error' ? toast.error : toast.success

  let toastId: string | number | undefined

  toastId = toastFn(title, {
    description,
    duration,
    action: showUndoButtons
      ? {
          label: undoLabel,
          onClick: () => {
            if (toastId) onUndo(toastId)
            if (onRedo && showUndoButtons) {
              const undoneToastId = toastFn(undoneTitle, {
                description: undoneDescription,
                duration: 2000,
                action: {
                  label: redoLabel,
                  onClick: () => {
                    onRedo(undoneToastId)
                    let redoneToastId: string | number | undefined
                    redoneToastId = toastFn(redoneTitle, {
                      description: redoneDescription,
                      duration: 2000,
                      action: {
                        label: undoLabel,
                        onClick: () => {
                          if (redoneToastId) onUndo(redoneToastId)
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

