import React from 'react'
import { toast } from 'sonner'

type ToastKind = 'success' | 'error'

interface UndoRedoToastOptions {
  title: string
  description: React.ReactNode
  duration?: number
  showUndoButtons: boolean
  onUndo: () => void
  onRedo?: () => void
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
    undoLabel = 'Undo',
    redoLabel = 'Redo',
    undoneTitle = 'Action undone',
    undoneDescription = description,
    redoneTitle = 'Action redone',
    redoneDescription = description,
  } = opts

  const toastFn = kind === 'error' ? toast.error : toast.success
  const toastId = toastFn(title, {
    description,
    duration,
    action: showUndoButtons
      ? {
          label: undoLabel,
          onClick: () => {
            onUndo()
            if (onRedo && showUndoButtons) {
              toastFn(undoneTitle, {
                description: undoneDescription,
                duration: 2000,
                action: {
                  label: redoLabel,
                  onClick: () => {
                    onRedo()
                    toastFn(redoneTitle, {
                      description: redoneDescription,
                      duration: 2000,
                      action: {
                        label: undoLabel,
                        onClick: () => {
                          onUndo()
                        },
                      },
                    })
                  },
                },
              })
            }
          },
        }
      : undefined,
  })

  return toastId
}

