'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeftRight,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ColorPickerBody } from '@/components/tickets/label-select'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { columnKeys, ticketKeys } from '@/hooks/queries/use-tickets'
import { useHasPermission } from '@/hooks/use-permissions'
import { getTabId } from '@/hooks/use-realtime'
import { PERMISSIONS } from '@/lib/permissions'
import {
  COLUMN_ICON_OPTIONS,
  getColumnIcon,
  resolveColumnColor,
  resolveColumnIconName,
} from '@/lib/status-icons'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets } from '@/types'

interface ColumnMenuProps {
  column: ColumnWithTickets
  projectId: string
  projectKey: string
  allColumns: ColumnWithTickets[]
  activeSprintId?: string | null
  onAddTicket?: () => void
}

export function ColumnMenu({
  column,
  projectId,
  projectKey,
  allColumns,
  activeSprintId = null,
  onAddTicket,
}: ColumnMenuProps) {
  const queryClient = useQueryClient()
  const { toggleColumnCollapsed, setColumns, getColumns } = useBoardStore()
  const { openCreateTicketWithData, setSprintCreateOpen } = useUIStore()
  const canManageBoard = useHasPermission(projectId, PERMISSIONS.BOARD_MANAGE)
  const canCreateTickets = useHasPermission(projectId, PERMISSIONS.TICKETS_CREATE)

  // Move state
  const [moveLoading, setMoveLoading] = useState(false)

  // Rename state
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(column.name)
  const [iconValue, setIconValue] = useState<string | null>(column.icon ?? null)
  const [colorValue, setColorValue] = useState<string | null>(column.color ?? null)
  const [renameLoading, setRenameLoading] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [moveToColumnId, setMoveToColumnId] = useState<string>('')

  const otherColumns = allColumns.filter((c) => c.id !== column.id)
  const isLastColumn = allColumns.length <= 1

  // Calculate column position for move left/right
  const columnIndex = allColumns.findIndex((c) => c.id === column.id)
  const canMoveLeft = columnIndex > 0
  const canMoveRight = columnIndex < allColumns.length - 1

  // Handle adding a ticket to this column
  const handleAddTicket = useCallback(() => {
    if (onAddTicket) {
      onAddTicket()
    } else if (activeSprintId) {
      openCreateTicketWithData({ columnId: column.id, sprintId: activeSprintId })
    } else {
      // No active sprint - prompt to create one first
      setSprintCreateOpen(true)
    }
  }, [onAddTicket, activeSprintId, column.id, openCreateTicketWithData, setSprintCreateOpen])

  // Handle moving column left or right
  const handleMoveColumn = useCallback(
    async (direction: 'left' | 'right') => {
      const currentIndex = allColumns.findIndex((c) => c.id === column.id)
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1

      if (targetIndex < 0 || targetIndex >= allColumns.length) return

      setMoveLoading(true)
      try {
        const tabId = getTabId()
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(tabId && { 'X-Tab-Id': tabId }),
        }

        // The target order is the order of the column we're swapping with
        const targetColumn = allColumns[targetIndex]
        const newOrder = targetColumn.order

        const res = await fetch(`/api/projects/${projectKey}/columns/${column.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ order: newOrder }),
        })

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Failed to move column' }))
          throw new Error(error.error || 'Failed to move column')
        }

        // Also update the swapped column's order
        await fetch(`/api/projects/${projectKey}/columns/${targetColumn.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ order: column.order }),
        })

        // Update the board store
        const columns = getColumns(projectId)
        const updatedColumns = [...columns]
        // Swap the positions
        const temp = updatedColumns[currentIndex]
        updatedColumns[currentIndex] = { ...updatedColumns[targetIndex], order: column.order }
        updatedColumns[targetIndex] = { ...temp, order: newOrder }
        // Sort by order
        updatedColumns.sort((a, b) => a.order - b.order)
        setColumns(projectId, updatedColumns)

        // Invalidate column queries to refresh data
        queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })

        toast.success('Column moved', {
          description: `"${column.name}" moved ${direction}`,
        })
      } catch (error) {
        toast.error('Failed to move column', {
          description: error instanceof Error ? error.message : 'An error occurred',
        })
      } finally {
        setMoveLoading(false)
      }
    },
    [allColumns, column, projectId, projectKey, getColumns, setColumns, queryClient],
  )

  // Initialize move target when delete dialog opens
  const handleDeleteOpen = useCallback(() => {
    if (otherColumns.length > 0) {
      setMoveToColumnId(otherColumns[0].id)
    }
    setDeleteOpen(true)
  }, [otherColumns])

  const handleRenameOpen = useCallback(() => {
    setRenameValue(column.name)
    setIconValue(resolveColumnIconName(column.icon, column.name))
    setColorValue(column.color ?? null)
    setRenameOpen(true)
    // Focus the input after the dialog renders
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }, [column.name, column.icon, column.color])

  const handleRename = useCallback(async () => {
    const trimmedName = renameValue.trim()
    const nameChanged = trimmedName && trimmedName !== column.name
    const iconChanged = iconValue !== (column.icon ?? null)
    const colorChanged = colorValue !== (column.color ?? null)

    if (!trimmedName || (!nameChanged && !iconChanged && !colorChanged)) {
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

      const body: { name?: string; icon?: string | null; color?: string | null } = {}
      if (nameChanged) body.name = trimmedName
      body.icon = iconValue
      body.color = colorValue

      const res = await fetch(`/api/projects/${projectKey}/columns/${column.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to update column' }))
        throw new Error(error.error || 'Failed to update column')
      }

      const oldName = column.name
      const oldIcon = column.icon ?? null
      const oldColor = column.color ?? null
      const newName = nameChanged ? trimmedName : column.name
      const newIcon = iconValue
      const newColor = colorValue

      // Update the board store
      const columns = getColumns(projectId)
      const updatedColumns = columns.map((c) =>
        c.id === column.id ? { ...c, name: newName, icon: newIcon, color: newColor } : c,
      )
      setColumns(projectId, updatedColumns)

      // Invalidate column queries to refresh data
      queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })

      const showUndo = useSettingsStore.getState().showUndoButtons
      const description = nameChanged
        ? `"${oldName}" renamed to "${newName}"`
        : 'Column appearance updated'

      const toastId = showUndoRedoToast('success', {
        title: 'Column updated',
        description,
        duration: 5000,
        showUndoButtons: showUndo,
        onUndo: async (id) => {
          // Undo: revert to old name/icon
          const undoEntry = useUndoStore.getState().undoByToastId(id)
          if (!undoEntry) return
          const undoStore = useUndoStore.getState()
          undoStore.setProcessing(true)
          try {
            await fetch(`/api/projects/${projectKey}/columns/${column.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ name: oldName, icon: oldIcon, color: oldColor }),
            })
            const bs = useBoardStore.getState()
            const cols = bs.getColumns(projectId)
            bs.setColumns(
              projectId,
              cols.map((c) =>
                c.id === column.id ? { ...c, name: oldName, icon: oldIcon, color: oldColor } : c,
              ),
            )
            queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
          } catch (err) {
            console.error('Failed to undo column rename:', err)
            toast.error('Failed to undo column update')
          } finally {
            useUndoStore.getState().setProcessing(false)
          }
        },
        onRedo: async (id) => {
          // Redo: re-apply new name/icon
          const undoEntry = useUndoStore.getState().redoByToastId(id)
          if (!undoEntry) return
          const undoStore = useUndoStore.getState()
          undoStore.setProcessing(true)
          try {
            await fetch(`/api/projects/${projectKey}/columns/${column.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ name: newName, icon: newIcon, color: newColor }),
            })
            const bs = useBoardStore.getState()
            const cols = bs.getColumns(projectId)
            bs.setColumns(
              projectId,
              cols.map((c) =>
                c.id === column.id ? { ...c, name: newName, icon: newIcon, color: newColor } : c,
              ),
            )
            queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
          } catch (err) {
            console.error('Failed to redo column rename:', err)
            toast.error('Failed to redo column update')
          } finally {
            useUndoStore.getState().setProcessing(false)
          }
        },
        undoneTitle: 'Column update undone',
        undoneDescription: description,
        redoneTitle: 'Column updated',
        redoneDescription: description,
      })

      useUndoStore
        .getState()
        .pushColumnRename(
          projectId,
          column.id,
          oldName,
          newName,
          oldIcon,
          newIcon,
          oldColor,
          newColor,
          toastId,
        )

      setRenameOpen(false)
    } catch (error) {
      toast.error('Failed to update column', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setRenameLoading(false)
    }
  }, [
    renameValue,
    iconValue,
    colorValue,
    column.id,
    column.name,
    column.icon,
    column.color,
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

      // Snapshot the column (with tickets) before removing from store
      const columns = getColumns(projectId)
      const deletedColumn = columns.find((c) => c.id === column.id)
      const snapshotColumn: ColumnWithTickets = {
        id: column.id,
        name: column.name,
        icon: column.icon,
        color: column.color,
        order: column.order,
        projectId,
        tickets: (deletedColumn?.tickets || []).map((t) => ({ ...t })),
      }
      const ticketsToMove = snapshotColumn.tickets

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
      const showUndo = useSettingsStore.getState().showUndoButtons
      const description =
        ticketsToMove.length > 0
          ? `"${column.name}" deleted. ${ticketsToMove.length} ticket${ticketsToMove.length === 1 ? '' : 's'} moved to "${targetColumn?.name}".`
          : `"${column.name}" deleted.`

      const toastId = showUndoRedoToast('error', {
        title: 'Column deleted',
        description,
        duration: 5000,
        showUndoButtons: showUndo,
        onUndo: async (id) => {
          // Undo: recreate column and move tickets back
          const undoEntry = useUndoStore.getState().undoByToastId(id)
          if (!undoEntry) return
          const undoStore = useUndoStore.getState()
          undoStore.setProcessing(true)
          try {
            // Recreate column via POST
            const createRes = await fetch(`/api/projects/${projectKey}/columns`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tab-Id': getTabId(),
              },
              body: JSON.stringify({ name: snapshotColumn.name }),
            })
            if (!createRes.ok) throw new Error('Failed to recreate column')
            const newCol = await createRes.json()

            // Set icon/color if they were set
            if (snapshotColumn.icon || snapshotColumn.color) {
              await fetch(`/api/projects/${projectKey}/columns/${newCol.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Tab-Id': getTabId(),
                },
                body: JSON.stringify({
                  icon: snapshotColumn.icon,
                  color: snapshotColumn.color,
                  order: snapshotColumn.order,
                }),
              })
            } else if (newCol.order !== snapshotColumn.order) {
              await fetch(`/api/projects/${projectKey}/columns/${newCol.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Tab-Id': getTabId(),
                },
                body: JSON.stringify({ order: snapshotColumn.order }),
              })
            }

            // Move tickets back to restored column
            if (snapshotColumn.tickets.length > 0) {
              for (const ticket of snapshotColumn.tickets) {
                await fetch(`/api/projects/${projectKey}/tickets/${ticket.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Tab-Id': getTabId(),
                  },
                  body: JSON.stringify({ columnId: newCol.id }),
                })
              }
            }

            // Update board store
            const bs = useBoardStore.getState()
            const restoredColumn: ColumnWithTickets = {
              ...snapshotColumn,
              id: newCol.id,
              tickets: snapshotColumn.tickets.map((t) => ({ ...t, columnId: newCol.id })),
            }
            const currentCols = bs.getColumns(projectId)
            // Remove moved tickets from target column and add restored column
            const restoredCols = currentCols.map((c) => {
              if (c.id === moveToColumnId) {
                const movedTicketIds = new Set(snapshotColumn.tickets.map((t) => t.id))
                return { ...c, tickets: c.tickets.filter((t) => !movedTicketIds.has(t.id)) }
              }
              return c
            })
            // Insert at original position
            restoredCols.splice(snapshotColumn.order, 0, restoredColumn)
            bs.setColumns(projectId, restoredCols)

            // Update snapshot column id for future redo
            snapshotColumn.id = newCol.id

            queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
            queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
          } catch (err) {
            console.error('Failed to undo column delete:', err)
            toast.error('Failed to undo column deletion')
          } finally {
            useUndoStore.getState().setProcessing(false)
          }
        },
        onRedo: async (id) => {
          // Redo: delete the column again
          const undoEntry = useUndoStore.getState().redoByToastId(id)
          if (!undoEntry) return
          const undoStore = useUndoStore.getState()
          undoStore.setProcessing(true)
          try {
            const deleteUrl = new URL(
              `/api/projects/${projectKey}/columns/${snapshotColumn.id}`,
              window.location.origin,
            )
            if (snapshotColumn.tickets.length > 0) {
              deleteUrl.searchParams.set('moveTicketsTo', moveToColumnId)
            }
            const delRes = await fetch(deleteUrl.toString(), {
              method: 'DELETE',
              headers: { 'X-Tab-Id': getTabId() },
            })
            if (!delRes.ok) throw new Error('Failed to redo column delete')

            const bs = useBoardStore.getState()
            const cols = bs.getColumns(projectId)
            const deletedCol = cols.find((c) => c.id === snapshotColumn.id)
            const movedTickets = deletedCol?.tickets || []
            bs.setColumns(
              projectId,
              cols
                .filter((c) => c.id !== snapshotColumn.id)
                .map((c) => {
                  if (c.id === moveToColumnId && movedTickets.length > 0) {
                    return {
                      ...c,
                      tickets: [
                        ...c.tickets,
                        ...movedTickets.map((t) => ({ ...t, columnId: moveToColumnId })),
                      ],
                    }
                  }
                  return c
                }),
            )
            queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })
            queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
          } catch (err) {
            console.error('Failed to redo column delete:', err)
            toast.error('Failed to redo column deletion')
          } finally {
            useUndoStore.getState().setProcessing(false)
          }
        },
        undoneTitle: 'Column restored',
        undoneDescription: `"${column.name}" restored`,
        redoneTitle: 'Column deleted',
        redoneDescription: description,
      })

      useUndoStore.getState().pushColumnDelete(projectId, snapshotColumn, moveToColumnId, toastId)

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
          {/* Add ticket */}
          {canCreateTickets && (
            <DropdownMenuItem onClick={handleAddTicket} className="text-zinc-300 focus:bg-zinc-800">
              <Plus className="h-4 w-4 mr-2" />
              Add ticket
            </DropdownMenuItem>
          )}
          {canManageBoard && (
            <DropdownMenuItem
              onClick={handleRenameOpen}
              className="text-zinc-300 focus:bg-zinc-800"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit column
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => toggleColumnCollapsed(column.id)}
            className="text-zinc-300 focus:bg-zinc-800"
          >
            <ChevronsLeftRight className="h-4 w-4 mr-2" />
            Collapse column
          </DropdownMenuItem>
          {/* Move left/right */}
          {canManageBoard && (
            <>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem
                onClick={() => handleMoveColumn('left')}
                disabled={!canMoveLeft || moveLoading}
                className="text-zinc-300 focus:bg-zinc-800 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Move left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMoveColumn('right')}
                disabled={!canMoveRight || moveLoading}
                className="text-zinc-300 focus:bg-zinc-800 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4 mr-2" />
                Move right
              </DropdownMenuItem>
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

      {/* Edit Column Dialog (PUNT-72: uses Dialog for close button + click-outside dismiss) */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Edit column</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update the name and icon for the &quot;{column.name}&quot; column.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(() => {
              const preview = getColumnIcon(iconValue, renameValue, colorValue)
              const PreviewIcon = preview.icon
              const isHex = preview.color.startsWith('#')
              return (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-md bg-zinc-800 border border-zinc-700">
                    <PreviewIcon
                      className={cn('h-4 w-4', isHex ? undefined : preview.color)}
                      style={isHex ? { color: preview.color } : undefined}
                    />
                  </div>
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
              )
            })()}
            <div>
              <span className="text-sm font-medium text-zinc-300 mb-2 block">Icon</span>
              <div className="grid grid-cols-7 gap-1">
                {COLUMN_ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = iconValue === opt.name
                  // Show selected icon in the chosen custom color, or default
                  const isHex = colorValue?.startsWith('#')
                  const iconClass = isSelected ? (isHex ? undefined : opt.color) : 'text-zinc-400'
                  const iconStyle =
                    isSelected && isHex && colorValue ? { color: colorValue } : undefined
                  return (
                    <Tooltip key={opt.name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setIconValue(isSelected ? null : opt.name)}
                          className={cn(
                            'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                            isSelected
                              ? 'bg-amber-600/20 ring-1 ring-amber-500'
                              : 'hover:bg-zinc-800',
                          )}
                          disabled={renameLoading}
                        >
                          <Icon className={cn('h-4 w-4', iconClass)} style={iconStyle} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {opt.name}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {iconValue
                  ? 'Click selected icon to clear'
                  : 'No icon selected \u2014 auto-detected from name'}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-zinc-300 mb-2 block">Color</span>
              {colorValue ? (
                <>
                  <ColorPickerBody
                    activeColor={colorValue}
                    onColorChange={setColorValue}
                    onApply={setColorValue}
                    isDisabled={renameLoading}
                    projectId={projectId}
                  />
                  {/* PUNT-74: Ghost button style for reset */}
                  <button
                    type="button"
                    onClick={() => setColorValue(null)}
                    disabled={renameLoading}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to default color
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 mb-2">
                    Using auto-detected color from icon. Pick a custom color:
                  </p>
                  {/* PUNT-73: Resolve auto-detected color instead of hardcoding #3b82f6 */}
                  <ColorPickerBody
                    activeColor={resolveColumnColor(null, iconValue, renameValue) ?? ''}
                    onColorChange={setColorValue}
                    onApply={setColorValue}
                    isDisabled={renameLoading}
                    projectId={projectId}
                  />
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              disabled={renameLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={
                renameLoading ||
                !renameValue.trim() ||
                (renameValue.trim() === column.name &&
                  iconValue === (column.icon ?? null) &&
                  colorValue === (column.color ?? null))
              }
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {renameLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {column.tickets.length === 0 && ' You can undo this with Ctrl+Z.'}
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
