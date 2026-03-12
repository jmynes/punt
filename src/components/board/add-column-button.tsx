'use client'

import { useDroppable } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ColorPickerBody } from '@/components/tickets/label-select'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useProjectDetail } from '@/hooks/queries/use-projects'
import { columnKeys } from '@/hooks/queries/use-tickets'
import { useHasPermission } from '@/hooks/use-permissions'
import { getTabId } from '@/hooks/use-realtime'
import { moveTickets as moveTicketsAction } from '@/lib/actions'
import { apiFetch } from '@/lib/base-path'
import { PERMISSIONS } from '@/lib/permissions'
import { COLUMN_ICON_OPTIONS, getColumnIcon, resolveColumnColor } from '@/lib/status-icons'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets } from '@/types'

interface AddColumnButtonProps {
  projectId: string
  projectKey: string
  pendingTicketIds?: string[]
  onPendingTicketsHandled?: () => void
}

export function AddColumnButton({
  projectId,
  projectKey,
  pendingTicketIds,
  onPendingTicketsHandled,
}: AddColumnButtonProps) {
  const queryClient = useQueryClient()
  const { getColumns, setColumns } = useBoardStore()
  const canManageBoard = useHasPermission(projectId, PERMISSIONS.BOARD_MANAGE)
  const dismissedProjects = useSettingsStore((s) => s.dismissedAddColumnProjects)
  const dismissAddColumn = useSettingsStore((s) => s.dismissAddColumn)
  const undismissAddColumn = useSettingsStore((s) => s.undismissAddColumn)

  // Fetch project detail for the effective showAddColumnButton setting
  const { data: projectDetail } = useProjectDetail(projectKey)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [iconValue, setIconValue] = useState<string | null>(null)
  const [colorValue, setColorValue] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDismissed = dismissedProjects.includes(projectId)

  const { setNodeRef, isOver } = useDroppable({
    id: 'add-column-drop',
    data: { type: 'add-column' },
  })

  // Auto-open dialog when tickets are dropped on this zone
  useEffect(() => {
    if (pendingTicketIds && pendingTicketIds.length > 0) {
      setDialogOpen(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [pendingTicketIds])

  // Resolve visibility: server setting + user preference
  const serverEnabled = projectDetail?.effectiveShowAddColumnButton ?? true
  const handleOpenDialog = useCallback(() => {
    setColumnName('')
    setIconValue(null)
    setColorValue(null)
    setDialogOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      dismissAddColumn(projectId)
      showToast.info('Add Column button hidden', {
        description: 'Click the + at the end of the board to show it again',
        duration: 4000,
      })
    },
    [projectId, dismissAddColumn],
  )

  const handleUndismiss = useCallback(() => {
    undismissAddColumn(projectId)
  }, [projectId, undismissAddColumn])

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

      const body: { name: string; icon?: string | null; color?: string | null } = {
        name: trimmedName,
      }
      if (iconValue !== null) body.icon = iconValue
      if (colorValue !== null) body.color = colorValue

      const res = await apiFetch(`/api/projects/${projectKey}/columns`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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

      showUndoRedoToast('success', {
        title: 'Column created',
        description: `"${trimmedName}" added to board`,
        duration: 5000,
      })

      useUndoStore.getState().pushColumnCreate(projectId, newColumn.id, trimmedName)

      // Move pending tickets to the newly created column
      if (pendingTicketIds && pendingTicketIds.length > 0) {
        const tabId = getTabId()
        moveTicketsAction({
          projectId,
          ticketIds: pendingTicketIds,
          toColumnId: newColumn.id,
          tabId,
        })
        onPendingTicketsHandled?.()
      }

      setDialogOpen(false)
      setColumnName('')
      setIconValue(null)
      setColorValue(null)
    } catch (error) {
      showToast.error('Failed to create column', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsCreating(false)
    }
  }, [
    columnName,
    iconValue,
    colorValue,
    projectId,
    projectKey,
    getColumns,
    setColumns,
    queryClient,
    pendingTicketIds,
    onPendingTicketsHandled,
  ])

  // Don't render if user doesn't have permission or server has disabled the feature
  if (!canManageBoard || !serverEnabled) {
    return null
  }

  // Show collapsed "+" button when user has dismissed
  if (isDismissed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleUndismiss}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors self-start mt-2"
          >
            <Plus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Show Add Column</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'relative flex w-72 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed bg-zinc-900/20 min-h-[200px] transition-colors group cursor-pointer',
          isOver
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30',
        )}
        onClick={handleOpenDialog}
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors opacity-0 group-hover:opacity-100"
          title="Hide Add Column button"
        >
          <X className="h-3.5 w-3.5" />
        </button>

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
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) onPendingTicketsHandled?.()
        }}
      >
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Create column</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new column to your board to organize tickets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(() => {
              const preview = getColumnIcon(iconValue, columnName, colorValue)
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
              )
            })()}
            <div>
              <span className="text-sm font-medium text-zinc-300 mb-2 block">Icon</span>
              <div className="grid grid-cols-7 gap-1">
                {COLUMN_ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = iconValue === opt.name
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
                          disabled={isCreating}
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
                    isDisabled={isCreating}
                    projectId={projectId}
                  />
                  <button
                    type="button"
                    onClick={() => setColorValue(null)}
                    disabled={isCreating}
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
                  <ColorPickerBody
                    activeColor={resolveColumnColor(null, iconValue, columnName) ?? ''}
                    onColorChange={setColorValue}
                    onApply={setColorValue}
                    isDisabled={isCreating}
                    projectId={projectId}
                  />
                </>
              )}
            </div>
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
