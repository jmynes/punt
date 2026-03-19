'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  actionVariant?: 'default' | 'destructive' | 'primary'
  loading?: boolean
  disabled?: boolean
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
}

const actionClasses: Record<string, string> = {
  destructive: 'bg-red-600 hover:bg-red-700 text-white',
  primary: 'bg-amber-600 hover:bg-amber-700 text-white',
  default: '',
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  actionVariant = 'default',
  loading: externalLoading,
  disabled,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const loading = externalLoading ?? internalLoading

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (loading || disabled) return

      const result = onConfirm()
      if (result instanceof Promise) {
        setInternalLoading(true)
        try {
          await result
        } finally {
          setInternalLoading(false)
        }
      }
    },
    [onConfirm, loading, disabled],
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          // Focus first input if children present, otherwise confirm button
          if (children) {
            const firstInput = (e.currentTarget as HTMLElement)?.querySelector(
              'input, textarea, select',
            ) as HTMLElement | null
            if (firstInput) {
              setTimeout(() => firstInput.focus(), 0)
              return
            }
          }
          setTimeout(() => confirmRef.current?.focus(), 0)
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild={typeof description !== 'string'}>
              {typeof description === 'string' ? description : <div>{description}</div>}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {children && <div className="py-2">{children}</div>}

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={loading}>
              {cancelLabel}
            </AlertDialogCancel>
            <Button
              ref={confirmRef}
              type="submit"
              disabled={loading || disabled}
              className={cn(actionClasses[actionVariant])}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// --- useConfirmation hook ---

interface ConfirmOptions {
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  actionVariant?: 'default' | 'destructive' | 'primary'
  children?: React.ReactNode
}

export function useConfirmation() {
  const [state, setState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: ((value: boolean) => void) | null
  }>({
    open: false,
    options: { title: '', description: '' },
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }, [state.resolve])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        state.resolve?.(false)
        setState((s) => ({ ...s, open: false, resolve: null }))
      }
    },
    [state.resolve],
  )

  const ConfirmationDialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={handleOpenChange}
      title={state.options.title}
      description={state.options.description}
      confirmLabel={state.options.confirmLabel}
      cancelLabel={state.options.cancelLabel}
      actionVariant={state.options.actionVariant}
      onConfirm={handleConfirm}
    >
      {state.options.children}
    </ConfirmDialog>
  )

  return { confirm, ConfirmationDialog }
}
