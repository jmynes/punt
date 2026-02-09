'use client'

import { useQueryClient } from '@tanstack/react-query'
import { ChevronsLeftRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { columnKeys, ticketKeys } from '@/hooks/queries/use-tickets'
import { useHasPermission } from '@/hooks/use-permissions'
import { getTabId } from '@/hooks/use-realtime'
import { PERMISSIONS } from '@/lib/permissions'
import { useBoardStore } from '@/stores/board-store'
import type { ColumnWithTickets } from '@/types'

interface ColumnMenuProps {
  column: ColumnWithTickets
  projectId: string
  projectKey: string
  allColumns: ColumnWithTickets[]
}

export function ColumnMenu({ column, projectId, projectKey, allColumns }: ColumnMenuProps) {
  const queryClient = useQueryClient()
  const { toggleColumnCollapsed, setColumns, getColumns } = useBoardStore()
  const canManageBoard = useHasPermission(projectId, PERMISSIONS.BOARD_MANAGE)

  // Rename state
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(column.name)
  const [renameLoading, setRenameLoading] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [moveToColumnId, setMoveToColumnId] = useState<string>('')

  const otherColumns = allColumns.filter((c) => c.id !== column.id)
  const isLastColumn = allColumns.length <= 1

  // Initialize move target when delete dialog opens
  const handleDeleteOpen = useCallback(() => {
    if (otherColumns.length > 0) {
      setMoveToColumnId(otherColumns[0].id)
    }
    setDeleteOpen(true)
  }, [otherColumns])

  const handleRenameOpen = useCallback(() => {
    setRenameValue(column.name)
    setRenameOpen(true)
    // Focus the input after the dialog renders
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }, [column.name])

  const handleRename = useCallback(async () => {
    const trimmedName = renameValue.trim()
    if (!trimmedName || trimmedName === column.name) {
      setRenameOpen(false)
      return
    }

    setRenameLoading(true)
    try {
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await fetch(`/api/projects/${projectKey}/columns/${column.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: trimmedName }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to rename column' }))
        throw new Error(error.error || 'Failed to rename column')
      }

      // Update the board store optimistically
      const columns = getColumns(projectId)
      const updatedColumns = columns.map((c) =>
        c.id === column.id ? { ...c, name: trimmedName } : c,
      )
      setColumns(projectId, updatedColumns)

      // Invalidate column queries to refresh data
      queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })

      toast.success('Column renamed', {
        description: `"${column.name}" renamed to "${trimmedName}"`,
      })
      setRenameOpen(false)
    } catch (error) {
      toast.error('Failed to rename column', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setRenameLoading(false)
    }
  }, [
    renameValue,
    column.id,
    column.name,
    projectId,
    projectKey,
    getColumns,
    setColumns,
    queryClient,
  ])

  const handleDelete = useCallback(async () => {
    if (!moveToColumnId) return

    setDeleteLoading(true)
    try {
      const tabId = getTabId()
      const headers: HeadersInit = {
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const url = new URL(
        `/api/projects/${projectKey}/columns/${column.id}`,
        window.location.origin,
      )
      if (column.tickets.length > 0) {
        url.searchParams.set('moveTicketsTo', moveToColumnId)
      }

      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete column' }))
        throw new Error(error.error || 'Failed to delete column')
      }

      // Update board store: remove column and move tickets
      const columns = getColumns(projectId)
      const deletedColumn = columns.find((c) => c.id === column.id)
      const ticketsToMove = deletedColumn?.tickets || []

      const updatedColumns = columns
        .filter((c) => c.id !== column.id)
        .map((c) => {
          if (c.id === moveToColumnId && ticketsToMove.length > 0) {
            return {
              ...c,
              tickets: [
                ...c.tickets,
                ...ticketsToMove.map((t) => ({ ...t, columnId: moveToColumnId })),
              ],
            }
          }
          return c
        })

      setColumns(projectId, updatedColumns)

      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })

      const targetColumn = otherColumns.find((c) => c.id === moveToColumnId)
      toast.success('Column deleted', {
        description:
          ticketsToMove.length > 0
            ? `"${column.name}" deleted. ${ticketsToMove.length} ticket${ticketsToMove.length === 1 ? '' : 's'} moved to "${targetColumn?.name}".`
            : `"${column.name}" deleted.`,
      })
      setDeleteOpen(false)
    } catch (error) {
      toast.error('Failed to delete column', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setDeleteLoading(false)
    }
  }, [
    column,
    moveToColumnId,
    projectId,
    projectKey,
    getColumns,
    setColumns,
    queryClient,
    otherColumns,
  ])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-700">
          {canManageBoard && (
            <DropdownMenuItem
              onClick={handleRenameOpen}
              className="text-zinc-300 focus:bg-zinc-800"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Rename column
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => toggleColumnCollapsed(column.id)}
            className="text-zinc-300 focus:bg-zinc-800"
          >
            <ChevronsLeftRight className="h-4 w-4 mr-2" />
            Collapse column
          </DropdownMenuItem>
          {canManageBoard && (
            <>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem
                onClick={handleDeleteOpen}
                disabled={isLastColumn}
                className="text-red-400 focus:bg-red-900/20 focus:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete column
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Rename column</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Enter a new name for the &quot;{column.name}&quot; column.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleRename()
                }
              }}
              placeholder="Column name"
              maxLength={50}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              disabled={renameLoading}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={renameLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRename()
              }}
              disabled={renameLoading || !renameValue.trim() || renameValue.trim() === column.name}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {renameLoading ? 'Renaming...' : 'Rename'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete column</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete the &quot;{column.name}&quot; column?
              {column.tickets.length > 0 && (
                <>
                  {' '}
                  This column contains{' '}
                  <span className="font-medium text-zinc-300">
                    {column.tickets.length} ticket{column.tickets.length === 1 ? '' : 's'}
                  </span>
                  . Select a column to move them to.
                </>
              )}
              {column.tickets.length === 0 && ' This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {column.tickets.length > 0 && otherColumns.length > 0 && (
            <div className="py-2">
              <label
                htmlFor="move-to-column"
                className="text-sm font-medium text-zinc-300 mb-2 block"
              >
                Move tickets to:
              </label>
              <Select value={moveToColumnId} onValueChange={setMoveToColumnId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {otherColumns.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-zinc-300 focus:bg-zinc-800">
                      {c.name} ({c.tickets.length} ticket{c.tickets.length === 1 ? '' : 's'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={deleteLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleteLoading || (column.tickets.length > 0 && !moveToColumnId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? 'Deleting...' : 'Delete column'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
