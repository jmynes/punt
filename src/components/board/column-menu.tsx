'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeftRight,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { ColorPickerBody } from '@/components/tickets/label-select'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { apiFetch, withBasePath } from '@/lib/base-path'
import { PERMISSIONS } from '@/lib/permissions'
import {
  COLUMN_ICON_OPTIONS,
  getColumnIcon,
  resolveColumnColor,
  resolveColumnIconName,
} from '@/lib/status-icons'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useUndoStore } from '@/stores/undo-store'
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

  // Handle moving column left or right
  const handleMoveColumn = useCallback(
    async (direction: 'left' | 'right') => {
      const currentColumns = getColumns(projectId)
      const currentIndex = currentColumns.findIndex((c) => c.id === column.id)
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1

      if (targetIndex < 0 || targetIndex >= currentColumns.length) return

      setMoveLoading(true)

      // Optimistically swap in the store
      const reorderedColumns = [...currentColumns]
      const temp = reorderedColumns[currentIndex]
      reorderedColumns[currentIndex] = { ...reorderedColumns[targetIndex], order: currentIndex }
      reorderedColumns[targetIndex] = { ...temp, order: targetIndex }
      reorderedColumns.sort((a, b) => a.order - b.order)
      setColumns(projectId, reorderedColumns)

      try {
        const tabId = getTabId()
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(tabId && { 'X-Tab-Id': tabId }),
        }

        const res = await apiFetch(`/api/projects/${projectKey}/columns/reorder`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ columnIds: reorderedColumns.map((c) => c.id) }),
        })

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Failed to move column' }))
          throw new Error(error.error ?? 'Failed to move column')
        }

        // Invalidate column queries to refresh data
        queryClient.invalidateQueries({ queryKey: columnKeys.byProject(projectId) })

        showToast.success('Column moved', {
          description: `"${column.name}" moved ${direction}`,
        })
      } catch (error) {
        // Rollback on failure
        setColumns(projectId, currentColumns)
        showToast.error('Failed to move column', {
          description: error instanceof Error ? error.message : 'An error occurred',
        })
      } finally {
        setMoveLoading(false)
      }
    },
    [column, projectId, projectKey, getColumns, setColumns, queryClient],
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

      const res = await apiFetch(`/api/projects/${projectKey}/columns/${column.id}`, {
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

      const description = nameChanged
        ? `"${oldName}" renamed to "${newName}"`
        : 'Column appearance updated'

      showUndoRedoToast('success', {
        title: 'Column updated',
        description,
        duration: 5000,
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
        )

      setRenameOpen(false)
    } catch (error) {
      showToast.error('Failed to update column', {
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
        withBasePath(`/api/projects/${projectKey}/columns/${column.id}`),
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
      const description =
        ticketsToMove.length > 0
          ? `"${column.name}" deleted. ${ticketsToMove.length} ticket${ticketsToMove.length === 1 ? '' : 's'} moved to "${targetColumn?.name}".`
          : `"${column.name}" deleted.`

      showUndoRedoToast('error', {
        title: 'Column deleted',
        description,
        duration: 5000,
      })

      useUndoStore.getState().pushColumnDelete(projectId, snapshotColumn, moveToColumnId)

      setDeleteOpen(false)
    } catch (error) {
      showToast.error('Failed to delete column', {
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
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Column options
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-700">
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (
                renameValue.trim() &&
                !renameLoading &&
                (renameValue.trim() !== column.name ||
                  iconValue !== (column.icon ?? null) ||
                  colorValue !== (column.color ?? null))
              )
                handleRename()
            }}
          >
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
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                disabled={renameLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
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
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete column"
        description={
          <>
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
          </>
        }
        confirmLabel={deleteLoading ? 'Deleting...' : 'Delete column'}
        actionVariant="destructive"
        loading={deleteLoading}
        disabled={column.tickets.length > 0 && !moveToColumnId}
        onConfirm={handleDelete}
      >
        {column.tickets.length > 0 && otherColumns.length > 0 && (
          <div>
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
      </ConfirmDialog>
    </>
  )
}
