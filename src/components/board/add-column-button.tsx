'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { columnKeys } from '@/hooks/queries/use-tickets'
import { useHasPermission } from '@/hooks/use-permissions'
import { getTabId } from '@/hooks/use-realtime'
import { PERMISSIONS } from '@/lib/permissions'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets } from '@/types'

interface AddColumnButtonProps {
  projectId: string
  projectKey: string
}

export function AddColumnButton({ projectId, projectKey }: AddColumnButtonProps) {
  const queryClient = useQueryClient()
  const { getColumns, setColumns } = useBoardStore()
  const canManageBoard = useHasPermission(projectId, PERMISSIONS.BOARD_MANAGE)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleOpenDialog = useCallback(() => {
    setColumnName('')
    setDialogOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleCreateColumn = useCallback(async () => {
    const trimmedName = columnName.trim()
    if (!trimmedName) return

    setIsCreating(true)
    try {
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await fetch(`/api/projects/${projectKey}/columns`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: trimmedName }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to create column' }))
        throw new Error(error.error || 'Failed to create column')
      }

      const newColumn = await res.json()

      // Optimistically add the column to the board store
      const columns = getColumns(projectId)
      const newColumnWithTickets: ColumnWithTickets = {
        ...newColumn,
        tickets: [],
      }
      const updatedColumns = [...columns, newColumnWithTickets]
      setColumns(projectId, updatedColumns)

      // Invalidate column queries to refresh
      queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })

      const showUndo = useSettingsStore.getState().showUndoButtons

      const toastId = showUndoRedoToast('success', {
        title: 'Column created',
        description: `"${trimmedName}" added to board`,
        duration: 5000,
        showUndoButtons: showUndo,
        onUndo: async (id) => {
          // Undo: delete the column
          const undoEntry = useUndoStore.getState().undoByToastId(id)
          if (!undoEntry) return
          const undoStore = useUndoStore.getState()
          undoStore.setProcessing(true)
          try {
            await fetch(`/api/projects/${projectKey}/columns/${newColumn.id}`, {
              method: 'DELETE',
              headers: { 'X-Tab-Id': getTabId() },
            })
            const bs = useBoardStore.getState()
            const cols = bs.getColumns(projectId)
            bs.setColumns(
              projectId,
              cols.filter((c) => c.id !== newColumn.id),
            )
            queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
          } catch (err) {
            console.error('Failed to undo column create:', err)
            toast.error('Failed to undo column creation')
          } finally {
            useUndoStore.getState().setProcessing(false)
          }
        },
        onRedo: async (id) => {
          // Redo: recreate the column
          const undoEntry = useUndoStore.getState().redoByToastId(id)
          if (!undoEntry) return
          const undoStore = useUndoStore.getState()
          undoStore.setProcessing(true)
          try {
            const createRes = await fetch(`/api/projects/${projectKey}/columns`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ name: trimmedName }),
            })
            if (!createRes.ok) throw new Error('Failed to recreate column')
            const recreatedColumn = await createRes.json()
            const bs = useBoardStore.getState()
            const cols = bs.getColumns(projectId)
            bs.setColumns(projectId, [
              ...cols,
              { ...recreatedColumn, tickets: [] } as ColumnWithTickets,
            ])
            // Update the column ID for future undo/redo
            newColumn.id = recreatedColumn.id
            queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
          } catch (err) {
            console.error('Failed to redo column create:', err)
            toast.error('Failed to redo column creation')
          } finally {
            useUndoStore.getState().setProcessing(false)
          }
        },
        undoneTitle: 'Column deleted',
        undoneDescription: `"${trimmedName}" removed from board`,
        redoneTitle: 'Column created',
        redoneDescription: `"${trimmedName}" added to board`,
      })

      useUndoStore.getState().pushColumnCreate(projectId, newColumn.id, trimmedName, toastId)

      setDialogOpen(false)
      setColumnName('')
    } catch (error) {
      toast.error('Failed to create column', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsCreating(false)
    }
  }, [columnName, projectId, projectKey, getColumns, setColumns, queryClient])

  // Don't render if user doesn't have permission
  if (!canManageBoard) {
    return null
  }

  return (
    <>
      <div className="flex w-72 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-800 bg-zinc-900/20 min-h-[200px] hover:border-zinc-700 hover:bg-zinc-900/30 transition-colors">
        <Button
          variant="ghost"
          className="flex flex-col gap-2 h-auto py-6 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          onClick={handleOpenDialog}
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">Add Column</span>
        </Button>
      </div>

      {/* Create Column Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Create column</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new column to your board to organize tickets.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              ref={inputRef}
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateColumn()
                }
              }}
              placeholder="Column name (e.g., Testing, Blocked)"
              maxLength={50}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              disabled={isCreating}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateColumn}
              disabled={isCreating || !columnName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
