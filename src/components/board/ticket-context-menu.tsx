'use client'

import {
  CalendarMinus,
  CalendarPlus,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Hash,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserCheck,
  User as UserIcon,
} from 'lucide-react'
import {
  cloneElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { PriorityBadge } from '@/components/common/priority-badge'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useProjectSprints } from '@/hooks/queries/use-sprints'
import { updateTicketAPI } from '@/hooks/queries/use-tickets'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { pasteTickets } from '@/lib/actions'
import { deleteTickets } from '@/lib/actions/delete-tickets'
import { getStatusIcon } from '@/lib/status-icons'
import { formatTicketIds } from '@/lib/ticket-format'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, SprintSummary, TicketWithRelations } from '@/types'

type MenuProps = {
  ticket: TicketWithRelations
  children: React.ReactElement
}

export function TicketContextMenu({ ticket, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [adjustedCoords, setAdjustedCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [adjustedSubmenuCoords, setAdjustedSubmenuCoords] = useState<{
    x: number
    y: number
  } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const submenuRef = useRef<HTMLDivElement | null>(null)

  const { getColumns } = useBoardStore()
  // Use the ticket's projectId directly instead of relying on activeProjectId from UI store
  // This ensures we always use the correct project context
  const projectId = ticket.projectId
  const columns = getColumns(projectId)
  // Call hooks unconditionally at top level for reactivity
  const _boardState = useBoardStore()
  const _undoStoreState = useUndoStore()
  const _uiStoreState = useUIStore()
  const selection = useSelectionStore()
  // Use static getState() for imperative API access
  const board = useBoardStore.getState()
  const undoStore = useUndoStore.getState()
  const uiStore = useUIStore.getState()
  const selectionApi = useSelectionStore.getState()
  const _shortcutsApi = uiStore
  const currentUser = useCurrentUser()
  const members = useProjectMembers(projectId)
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TicketWithRelations[]>([])
  // Track if component has mounted to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false)

  const selectedIds = useMemo(() => {
    const selectionState = useSelectionStore.getState ? useSelectionStore.getState() : selection
    const getIds =
      (selectionState as { getSelectedIds?: () => string[] }).getSelectedIds || (() => [])
    const ids = getIds()
    return ids.length > 0 ? ids : [ticket.id]
  }, [selection, ticket.id])

  const multi = selectedIds.length > 1
  const [submenu, setSubmenu] = useState<null | {
    id: 'priority' | 'assign' | 'send' | 'points' | 'sprint'
    anchor: { x: number; y: number; height: number; left: number }
  }>(null)

  // Fetch sprints for add to sprint menu
  const { data: sprints = [] } = useProjectSprints(projectId)
  const hasActiveSprint = useMemo(() => sprints.some((s) => s.status === 'active'), [sprints])
  const availableSprints = useMemo(() => {
    const activePlanningsprints = sprints.filter(
      (s) => s.status === 'active' || s.status === 'planning',
    )
    // Filter out sprints where ALL selected tickets are already in that sprint
    return activePlanningsprints.filter((sprint) => {
      const allTicketsInThisSprint = selectedIds.every((id: string) => {
        const t = columns
          .flatMap((c: ColumnWithTickets) => c.tickets)
          .find((t: TicketWithRelations) => t.id === id)
        return t?.sprintId === sprint.id
      })
      return !allTicketsInThisSprint
    })
  }, [sprints, selectedIds, columns])

  // Set mounted state after hydration to enable client-only features
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Adjust main menu position to stay within viewport
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 8

    let x = coords.x
    let y = coords.y

    // Flip horizontally if menu extends beyond right edge
    if (x + rect.width > viewportWidth - padding) {
      x = Math.max(padding, viewportWidth - rect.width - padding)
    }

    // Flip vertically if menu extends beyond bottom edge
    if (y + rect.height > viewportHeight - padding) {
      y = Math.max(padding, viewportHeight - rect.height - padding)
    }

    setAdjustedCoords({ x, y })
  }, [open, coords])

  // Adjust submenu position to stay within viewport
  useLayoutEffect(() => {
    if (!submenu || !submenuRef.current) {
      setAdjustedSubmenuCoords(null)
      return
    }

    const menu = submenuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 8

    let x = submenu.anchor.x + 2
    let y = submenu.anchor.y

    // Flip horizontally if submenu extends beyond right edge
    if (x + rect.width > viewportWidth - padding) {
      // Position to the left of the parent menu instead (left edge of parent - submenu width - gap)
      x = submenu.anchor.left - rect.width - 2
      // Ensure it doesn't go off the left edge
      if (x < padding) {
        x = padding
      }
    }

    // Flip vertically if submenu extends beyond bottom edge
    if (y + rect.height > viewportHeight - padding) {
      y = Math.max(padding, viewportHeight - rect.height - padding)
    }

    setAdjustedSubmenuCoords({ x, y })
  }, [submenu])

  // Close on escape key
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const ensureSelection = useCallback(() => {
    const isSelected = selectionApi.isSelected || (() => false)
    const selectTicket = selectionApi.selectTicket || (() => {})
    if (!isSelected(ticket.id)) {
      selectTicket(ticket.id)
    }
  }, [selectionApi, ticket.id])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      ensureSelection()
      setOpen(true)
      setCoords({ x: e.clientX, y: e.clientY })
      setSubmenu(null)
      ;(children.props as { onContextMenu?: (e: React.MouseEvent) => void })?.onContextMenu?.(e)
    },
    [children, ensureSelection],
  )

  const doCopy = () => {
    const copySelected = selectionApi.copySelected || (() => {})
    const getIds = selectionApi.getSelectedIds || (() => [])
    copySelected()
    const ids = getIds()
    const ticketKeys = formatTicketIds(columns, ids)
    const count = ids.length
    toast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, {
      description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 2000,
    })
    setOpen(false)
    setSubmenu(null)
  }

  const doPaste = () => {
    pasteTickets({
      projectId,
      columns,
      onComplete: () => {
        setOpen(false)
        setSubmenu(null)
      },
    })
  }

  const doSendTo = (toColumnId: string) => {
    const column = columns.find((c: ColumnWithTickets) => c.id === toColumnId)
    if (!column) return
    const toOrder = column.tickets.length
    const moveTickets = board.moveTickets || (() => {})
    const moveTicket = board.moveTicket || (() => {})

    const movableIds = selectedIds.filter((id: string) => {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      return current && current.columnId !== toColumnId
    })
    if (movableIds.length === 0) return

    const beforeColumns = columns.map((col: ColumnWithTickets) => ({
      ...col,
      tickets: col.tickets.map((t) => ({ ...t })),
    }))

    if (movableIds.length > 1) {
      moveTickets(projectId, movableIds, toColumnId, toOrder)
    } else {
      const from = ticket.columnId
      moveTicket(projectId, movableIds[0], from, toColumnId, toOrder)
    }

    const boardStateAfter = useBoardStore.getState ? useBoardStore.getState() : board
    const afterColumns = boardStateAfter.getColumns(projectId).map((col: ColumnWithTickets) => ({
      ...col,
      tickets: col.tickets.map((t: TicketWithRelations) => ({ ...t })),
    }))

    const moves = movableIds.map((id: string) => ({
      ticketId: id,
      fromColumnId:
        beforeColumns.find((c: ColumnWithTickets) => c.tickets.some((t) => t.id === id))?.id || '',
      toColumnId: toColumnId,
    }))
    const fromColumnName =
      moves.length === 1
        ? beforeColumns.find((c: ColumnWithTickets) => c.id === moves[0].fromColumnId)?.name ||
          'Source'
        : 'Multiple'
    const toColumnName = column.name

    // Persist move to database
    ;(async () => {
      try {
        for (const move of moves) {
          await updateTicketAPI(projectId, move.ticketId, {
            columnId: move.toColumnId,
          })
        }
      } catch (err) {
        console.error('Failed to persist move:', err)
      }
    })()

    const ticketKeys = formatTicketIds(
      afterColumns,
      moves.map((m: { ticketId: string }) => m.ticketId),
    )

    const toastTitle =
      moves.length === 1
        ? `Ticket moved from ${fromColumnName}`
        : `${moves.length} tickets moved from ${fromColumnName}`
    const { icon: StatusIcon, color: statusColor } = getStatusIcon(toColumnName)
    const toastDescription =
      moves.length === 1 ? (
        <div className="flex items-center gap-1.5">
          <span>{`${ticketKeys[0]} Moved to`}</span>
          <StatusIcon className={`h-4 w-4 ${statusColor}`} aria-hidden />
          <span>{toColumnName}</span>
        </div>
      ) : (
        <div className="space-y-1">
          {ticketKeys.map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span>{`${k} Moved to`}</span>
              <StatusIcon className={`h-4 w-4 ${statusColor}`} aria-hidden />
              <span>{toColumnName}</span>
            </div>
          ))}
        </div>
      )

    const uiState = useUIStore.getState ? useUIStore.getState() : uiStore
    const showUndo = useSettingsStore.getState().showUndoButtons ?? true
    const boardStateMove = useBoardStore.getState ? useBoardStore.getState() : board
    const toastId = showUndoRedoToast('success', {
      title: toastTitle,
      description: toastDescription,
      duration: 3000,
      showUndoButtons: showUndo,
      onUndo: async () => {
        boardStateMove.setColumns(projectId, beforeColumns)
        // Persist undo to database
        try {
          for (const move of moves) {
            await updateTicketAPI(projectId, move.ticketId, {
              columnId: move.fromColumnId,
            })
          }
        } catch (err) {
          console.error('Failed to persist move undo:', err)
        }
      },
      onRedo: async () => {
        boardStateMove.setColumns(projectId, afterColumns)
        // Persist redo to database
        try {
          for (const move of moves) {
            await updateTicketAPI(projectId, move.ticketId, {
              columnId: move.toColumnId,
            })
          }
        } catch (err) {
          console.error('Failed to persist move redo:', err)
        }
      },
      undoneTitle: 'Move undone',
      redoneTitle: toastTitle,
      redoneDescription: toastDescription,
    })

    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushMove(
      projectId,
      moves,
      fromColumnName,
      toColumnName,
      toastId,
      beforeColumns,
      afterColumns,
    )

    setOpen(false)
    setSubmenu(null)
  }

  const doDelete = () => {
    const ticketsToDelete: TicketWithRelations[] = []
    for (const col of columns) {
      for (const t of col.tickets) {
        if (selectedIds.includes(t.id)) ticketsToDelete.push(t)
      }
    }
    if (ticketsToDelete.length === 0) return
    setPendingDelete(ticketsToDelete)
    setShowDeleteConfirm(true)
    setOpen(false)
    setSubmenu(null)
  }

  const doPriority = (priority: TicketWithRelations['priority']) => {
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current || current.priority === priority) continue
      const after = { ...current, priority }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, { priority })
    }
    if (updates.length === 0) return // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketAPI(projectId, update.ticketId, { priority })
        }
      } catch (err) {
        console.error('Failed to persist priority update:', err)
      }
    })()

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    const toastId = toast.success(
      updates.length === 1 ? 'Priority updated' : `${updates.length} priorities updated`,
      { description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '), duration: 3000 },
    )
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates, toastId)

    setOpen(false)
    setSubmenu(null)
  }

  const doAssign = (userId: string | null) => {
    const user = members.find((m) => m.id === userId) || null
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current) continue
      const currentAssignee = current.assigneeId || null
      if (currentAssignee === userId) continue
      const after: TicketWithRelations = {
        ...current,
        assignee: user ?? null,
        assigneeId: user?.id ?? null,
      }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, { assignee: user ?? null, assigneeId: user?.id ?? null })
    }
    if (updates.length === 0) return // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketAPI(projectId, update.ticketId, { assigneeId: userId })
        }
      } catch (err) {
        console.error('Failed to persist assignee update:', err)
      }
    })()

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    const msg =
      updates.length === 1
        ? user
          ? `Assigned to ${user.name}`
          : 'Unassigned'
        : user
          ? `Assigned ${updates.length} tickets to ${user.name}`
          : `Unassigned ${updates.length} tickets`

    const toastId = toast.success(msg, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 3000,
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates, toastId)

    setOpen(false)
    setSubmenu(null)
  }

  const doPoints = (points: number | null) => {
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current) continue
      const currentPoints = current.storyPoints ?? null
      if (currentPoints === points) continue
      const after: TicketWithRelations = {
        ...current,
        storyPoints: points,
      }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, { storyPoints: points })
    }
    if (updates.length === 0) return // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketAPI(projectId, update.ticketId, { storyPoints: points })
        }
      } catch (err) {
        console.error('Failed to persist points update:', err)
      }
    })()

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    const msg =
      updates.length === 1
        ? points !== null
          ? `Set to ${points} point${points === 1 ? '' : 's'}`
          : 'Points cleared'
        : points !== null
          ? `Set ${updates.length} tickets to ${points} point${points === 1 ? '' : 's'}`
          : `Cleared points from ${updates.length} tickets`

    const toastId = toast.success(msg, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 3000,
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates, toastId)

    setOpen(false)
    setSubmenu(null)
  }

  const doRemoveFromSprint = () => {
    const updateTicket = board.updateTicket || (() => {})

    // Get tickets that are in a sprint
    const ticketsInSprint: { ticket: TicketWithRelations; sprintName: string }[] = []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (current?.sprintId && current.sprint?.name) {
        ticketsInSprint.push({ ticket: current, sprintName: current.sprint.name })
      }
    }

    if (ticketsInSprint.length === 0) return

    // Capture original sprint IDs for undo (sprintId is guaranteed non-null since we filtered above)
    const originalSprintIds = ticketsInSprint.map(({ ticket, sprintName }) => ({
      ticketId: ticket.id,
      sprintId: ticket.sprintId as string,
      sprintName,
    }))

    // Get the sprint name(s) for the toast message
    const uniqueSprintNames = [...new Set(originalSprintIds.map((t) => t.sprintName))]
    const fromLabel =
      uniqueSprintNames.length === 1 ? uniqueSprintNames[0] : `${uniqueSprintNames.length} sprints`

    // Optimistic update - remove sprint from all selected tickets
    for (const { ticket } of ticketsInSprint) {
      updateTicket(projectId, ticket.id, { sprintId: null, sprint: null })
    }

    const ticketKeys = formatTicketIds(
      columns,
      ticketsInSprint.map(({ ticket }) => ticket.id),
    )
    const count = ticketsInSprint.length

    // Prepare sprint moves for undo store
    const moves = originalSprintIds.map(({ ticketId, sprintId }) => ({
      ticketId,
      fromSprintId: sprintId,
      toSprintId: null,
    }))

    const uiState = useUIStore.getState ? useUIStore.getState() : uiStore
    const showUndo = useSettingsStore.getState().showUndoButtons ?? true

    const toastId = showUndoRedoToast('success', {
      title: count === 1 ? 'Removed from sprint' : `${count} tickets removed from sprint`,
      description: count === 1 ? `${ticketKeys[0]} sent to Backlog` : `Sent to Backlog`,
      duration: 5000,
      showUndoButtons: showUndo,
      onUndo: async (id) => {
        // Move to redo stack
        useUndoStore.getState().undoByToastId(id)
        // Restore original sprint IDs
        for (const { ticketId, sprintId, sprintName } of originalSprintIds) {
          const originalTicket = ticketsInSprint.find(({ ticket }) => ticket.id === ticketId)
          updateTicket(projectId, ticketId, {
            sprintId,
            sprint: originalTicket?.ticket.sprint ?? {
              id: sprintId,
              name: sprintName,
              status: 'planning',
              startDate: null,
              endDate: null,
            },
          })
        }
        // Persist to API
        try {
          for (const { ticketId, sprintId } of originalSprintIds) {
            await updateTicketAPI(projectId, ticketId, { sprintId })
          }
        } catch (err) {
          console.error('Failed to persist sprint restore:', err)
        }
      },
      onRedo: async (id) => {
        useUndoStore.getState().redoByToastId(id)
        // Remove from sprint again
        for (const { ticket } of ticketsInSprint) {
          updateTicket(projectId, ticket.id, { sprintId: null, sprint: null })
        }
        // Persist to API
        try {
          for (const { ticket } of ticketsInSprint) {
            await updateTicketAPI(projectId, ticket.id, { sprintId: null })
          }
        } catch (err) {
          console.error('Failed to persist sprint removal:', err)
        }
      },
      undoneTitle: 'Restored to sprint',
      undoneDescription:
        count === 1 ? `${ticketKeys[0]} returned to ${fromLabel}` : `${count} tickets returned`,
      redoneTitle: count === 1 ? 'Removed from sprint' : `${count} tickets removed from sprint`,
      redoneDescription: count === 1 ? `${ticketKeys[0]} sent to Backlog` : 'Sent to Backlog',
    })

    // Register in undo store
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushSprintMove(projectId, moves, fromLabel, 'Backlog', toastId)

    // Persist to API
    ;(async () => {
      try {
        for (const { ticket } of ticketsInSprint) {
          await updateTicketAPI(projectId, ticket.id, { sprintId: null })
        }
      } catch (err) {
        console.error('Failed to persist sprint removal:', err)
      }
    })()

    setOpen(false)
    setSubmenu(null)
  }

  const doAddToSprint = (targetSprint: SprintSummary) => {
    const updateTicket = board.updateTicket || (() => {})

    // Get tickets that are NOT already in the target sprint
    const ticketsToAdd: {
      ticket: TicketWithRelations
      fromSprintId: string | null
      fromSprintName: string | null
    }[] = []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (current && current.sprintId !== targetSprint.id) {
        ticketsToAdd.push({
          ticket: current,
          fromSprintId: current.sprintId,
          fromSprintName: current.sprint?.name ?? null,
        })
      }
    }

    if (ticketsToAdd.length === 0) return

    // Capture original sprint IDs for undo
    const originalSprintIds = ticketsToAdd.map(({ ticket, fromSprintId, fromSprintName }) => ({
      ticketId: ticket.id,
      fromSprintId,
      fromSprintName,
    }))

    // Get the from label for the toast message
    const uniqueFromNames = [...new Set(originalSprintIds.map((t) => t.fromSprintName))]
    const fromLabel =
      uniqueFromNames.length === 1
        ? (uniqueFromNames[0] ?? 'Backlog')
        : uniqueFromNames.every((n) => n === null)
          ? 'Backlog'
          : 'multiple locations'

    // Optimistic update - add to sprint
    for (const { ticket } of ticketsToAdd) {
      updateTicket(projectId, ticket.id, {
        sprintId: targetSprint.id,
        sprint: {
          id: targetSprint.id,
          name: targetSprint.name,
          status: targetSprint.status,
          startDate: targetSprint.startDate,
          endDate: targetSprint.endDate,
        },
      })
    }

    const ticketKeys = formatTicketIds(
      columns,
      ticketsToAdd.map(({ ticket }) => ticket.id),
    )
    const count = ticketsToAdd.length

    // Prepare sprint moves for undo store
    const moves = originalSprintIds.map(({ ticketId, fromSprintId }) => ({
      ticketId,
      fromSprintId,
      toSprintId: targetSprint.id,
    }))

    const uiState = useUIStore.getState ? useUIStore.getState() : uiStore
    const showUndo = useSettingsStore.getState().showUndoButtons ?? true

    const toastId = showUndoRedoToast('success', {
      title:
        count === 1
          ? `Added to ${targetSprint.name}`
          : `${count} tickets added to ${targetSprint.name}`,
      description: count === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 5000,
      showUndoButtons: showUndo,
      onUndo: async (id) => {
        // Move to redo stack
        useUndoStore.getState().undoByToastId(id)
        // Restore original sprint IDs
        for (const { ticketId, fromSprintId, fromSprintName } of originalSprintIds) {
          const originalTicket = ticketsToAdd.find(({ ticket }) => ticket.id === ticketId)
          if (fromSprintId && fromSprintName) {
            updateTicket(projectId, ticketId, {
              sprintId: fromSprintId,
              sprint: originalTicket?.ticket.sprint ?? {
                id: fromSprintId,
                name: fromSprintName,
                status: 'planning',
                startDate: null,
                endDate: null,
              },
            })
          } else {
            updateTicket(projectId, ticketId, { sprintId: null, sprint: null })
          }
        }
        // Persist to API
        try {
          for (const { ticketId, fromSprintId } of originalSprintIds) {
            await updateTicketAPI(projectId, ticketId, { sprintId: fromSprintId })
          }
        } catch (err) {
          console.error('Failed to persist sprint restore:', err)
        }
      },
      onRedo: async (id) => {
        useUndoStore.getState().redoByToastId(id)
        // Add to sprint again
        for (const { ticket } of ticketsToAdd) {
          updateTicket(projectId, ticket.id, {
            sprintId: targetSprint.id,
            sprint: {
              id: targetSprint.id,
              name: targetSprint.name,
              status: targetSprint.status,
              startDate: targetSprint.startDate,
              endDate: targetSprint.endDate,
            },
          })
        }
        // Persist to API
        try {
          for (const { ticket } of ticketsToAdd) {
            await updateTicketAPI(projectId, ticket.id, { sprintId: targetSprint.id })
          }
        } catch (err) {
          console.error('Failed to persist sprint addition:', err)
        }
      },
      undoneTitle: `Restored to ${fromLabel}`,
      undoneDescription:
        count === 1
          ? `${ticketKeys[0]} removed from ${targetSprint.name}`
          : `${count} tickets removed`,
      redoneTitle:
        count === 1
          ? `Added to ${targetSprint.name}`
          : `${count} tickets added to ${targetSprint.name}`,
      redoneDescription: count === 1 ? ticketKeys[0] : ticketKeys.join(', '),
    })

    // Register in undo store
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushSprintMove(projectId, moves, fromLabel, targetSprint.name, toastId)

    // Persist to API
    ;(async () => {
      try {
        for (const { ticket } of ticketsToAdd) {
          await updateTicketAPI(projectId, ticket.id, { sprintId: targetSprint.id })
        }
      } catch (err) {
        console.error('Failed to persist sprint addition:', err)
      }
    })()

    setOpen(false)
    setSubmenu(null)
  }

  const doCreateSprint = () => {
    uiStore.setSprintCreateOpen(true)
    setOpen(false)
    setSubmenu(null)
  }

  const confirmDeleteNow = async () => {
    const ticketsToDelete = pendingDelete
    if (ticketsToDelete.length === 0) return

    // Prepare tickets with column IDs for the action
    const tickets = ticketsToDelete.map((t) => ({ ticket: t, columnId: t.columnId }))

    await deleteTickets({
      projectId,
      tickets,
      onComplete: () => {
        setPendingDelete([])
        setShowDeleteConfirm(false)
      },
    })
  }

  const contextChild = useMemo(
    () =>
      cloneElement(
        children as React.ReactElement<{ onContextMenu?: (e: React.MouseEvent) => void }>,
        { onContextMenu: handleContextMenu },
      ),
    [children, handleContextMenu],
  )

  const openSubmenu =
    (id: 'priority' | 'assign' | 'send' | 'points' | 'sprint') => (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setSubmenu({
        id,
        anchor: { x: rect.right, y: rect.top, height: rect.height, left: rect.left },
      })
    }

  const closeSubmenu = () => setSubmenu(null)

  // Handle backdrop click: close menu without propagating to elements behind
  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
  }, [])

  // Render portal content only after mount to avoid hydration mismatch
  let portalContent: ReactNode = null
  if (isMounted && open) {
    portalContent = createPortal(
      <>
        {/* Invisible backdrop to block clicks on elements behind the menu */}
        <div
          className="fixed inset-0 z-[199]"
          onMouseDown={handleBackdropMouseDown}
          role="presentation"
        />
        <div
          ref={menuRef}
          className="z-[200] min-w-[220px] rounded-md border border-zinc-800 bg-zinc-900 shadow-lg"
          style={{ position: 'fixed', left: adjustedCoords.x, top: adjustedCoords.y }}
        >
          <div className="py-1 text-sm text-zinc-200 relative">
            <div className="px-3 pb-1 pt-2 text-xs uppercase text-zinc-500">
              {multi ? `Modify ${selectedIds.length} Tasks` : 'Modify Task'}
            </div>
            <MenuButton
              icon={<UserIcon className="h-4 w-4" />}
              label="Assign"
              trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
              onMouseEnter={openSubmenu('assign')}
            />
            <MenuButton
              icon={<UserCheck className="h-4 w-4" />}
              label="Priority"
              trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
              onMouseEnter={openSubmenu('priority')}
            />
            <MenuButton
              icon={<Hash className="h-4 w-4" />}
              label="Points"
              trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
              onMouseEnter={openSubmenu('points')}
            />
            <MenuButton
              icon={<Send className="h-4 w-4" />}
              label="Status"
              trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
              onMouseEnter={openSubmenu('send')}
            />

            <MenuSection title="Sprint">
              {/* Show Remove from Sprint if any selected ticket is in a sprint */}
              {selectedIds.some((id: string) => {
                const t = columns
                  .flatMap((c: ColumnWithTickets) => c.tickets)
                  .find((t: TicketWithRelations) => t.id === id)
                return t?.sprintId
              }) && (
                <MenuButton
                  icon={<CalendarMinus className="h-4 w-4" />}
                  label="Remove from Sprint"
                  onMouseEnter={closeSubmenu}
                  onClick={doRemoveFromSprint}
                />
              )}
              {/* Show Add to Sprint if available sprints exist */}
              {availableSprints.length > 0 &&
                (availableSprints.length === 1 ? (
                  <MenuButton
                    icon={<CalendarPlus className="h-4 w-4" />}
                    label={`Add to ${availableSprints[0].name}`}
                    onMouseEnter={closeSubmenu}
                    onClick={() => doAddToSprint(availableSprints[0])}
                  />
                ) : (
                  <MenuButton
                    icon={<CalendarPlus className="h-4 w-4" />}
                    label="Add to Sprint"
                    trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                    onMouseEnter={openSubmenu('sprint')}
                  />
                ))}
              {/* Show Create Sprint only when no active sprint exists */}
              {!hasActiveSprint && (
                <MenuButton
                  icon={<Plus className="h-4 w-4" />}
                  label="Create Sprint"
                  onMouseEnter={closeSubmenu}
                  onClick={doCreateSprint}
                />
              )}
            </MenuSection>

            <MenuSection title="Operations">
              <MenuButton
                icon={<ClipboardCopy className="h-4 w-4" />}
                label="Copy"
                shortcut="Ctrl/Cmd + C"
                onMouseEnter={closeSubmenu}
                onClick={doCopy}
              />
              <MenuButton
                icon={<ClipboardPaste className="h-4 w-4" />}
                label="Paste"
                shortcut="Ctrl/Cmd + V"
                onMouseEnter={closeSubmenu}
                onClick={doPaste}
              />
              <MenuButton
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete"
                shortcut="Del"
                destructive
                onMouseEnter={closeSubmenu}
                onClick={doDelete}
              />
            </MenuSection>

            {submenu && (
              <div
                ref={submenuRef}
                className="fixed z-[201] min-w-[200px] rounded-md border border-zinc-800 bg-zinc-900 shadow-lg"
                style={{
                  left: adjustedSubmenuCoords?.x ?? submenu.anchor.x + 2,
                  top: adjustedSubmenuCoords?.y ?? submenu.anchor.y,
                }}
              >
                <div className="py-1 text-sm text-zinc-200">
                  {submenu.id === 'priority' &&
                    (['critical', 'highest', 'high', 'medium', 'low', 'lowest'] as const).map(
                      (p) => (
                        <button
                          key={p}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doPriority(p)}
                        >
                          <PriorityBadge priority={p} size="sm" />
                        </button>
                      ),
                    )}

                  {submenu.id === 'assign' && (
                    <>
                      {currentUser && (
                        <>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => doAssign(currentUser.id)}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback
                                className="text-[10px] text-white font-medium"
                                style={{
                                  backgroundColor:
                                    currentUser.avatarColor || getAvatarColor(currentUser.id),
                                }}
                              >
                                {getInitials(currentUser.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>Assign to me</span>
                          </button>
                          <div className="my-1 border-t border-zinc-800" />
                        </>
                      )}
                      {sortedMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doAssign(m.id)}
                        >
                          <Avatar className="h-5 w-5">
                            {m.avatar && <AvatarImage src={m.avatar} />}
                            <AvatarFallback
                              className="text-[10px] text-white font-medium"
                              style={{ backgroundColor: m.avatarColor || getAvatarColor(m.id) }}
                            >
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{m.name}</span>
                        </button>
                      ))}
                      <div className="my-1 border-t border-zinc-800" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                        onClick={() => doAssign(null)}
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                            <UserIcon className="h-3 w-3 text-zinc-500" />
                          </AvatarFallback>
                        </Avatar>
                        <span>Unassign</span>
                      </button>
                    </>
                  )}

                  {submenu.id === 'send' &&
                    columns.map((col) => {
                      const { icon: StatusIcon, color } = getStatusIcon(col.name)
                      return (
                        <button
                          key={col.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doSendTo(col.id)}
                        >
                          <StatusIcon className={`h-4 w-4 ${color}`} />
                          <span>{col.name}</span>
                        </button>
                      )
                    })}

                  {submenu.id === 'points' && (
                    <>
                      {[1, 2, 3, 4, 5].map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doPoints(p)}
                        >
                          <Hash className="h-4 w-4 text-green-400" />
                          <span>
                            {p} point{p === 1 ? '' : 's'}
                          </span>
                        </button>
                      ))}
                      {!multi && (
                        <>
                          <div className="my-1 border-t border-zinc-800" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => {
                              uiStore.openTicketWithFocus(ticket.id, 'storyPoints')
                              setOpen(false)
                              setSubmenu(null)
                            }}
                          >
                            <Pencil className="h-4 w-4 text-amber-400" />
                            <span>Custom...</span>
                          </button>
                        </>
                      )}
                      <div className="my-1 border-t border-zinc-800" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                        onClick={() => doPoints(null)}
                      >
                        <Hash className="h-4 w-4 text-zinc-500" />
                        <span className="text-zinc-400">Clear points</span>
                      </button>
                    </>
                  )}

                  {submenu.id === 'sprint' && (
                    <>
                      {availableSprints.map((sprint) => (
                        <button
                          key={sprint.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doAddToSprint(sprint)}
                        >
                          <CalendarPlus className="h-4 w-4 text-blue-400" />
                          <span>{sprint.name}</span>
                          {sprint.status === 'active' && (
                            <span className="ml-auto text-[10px] text-emerald-400 uppercase">
                              Active
                            </span>
                          )}
                        </button>
                      ))}
                      {!hasActiveSprint && (
                        <>
                          <div className="my-1 border-t border-zinc-800" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={doCreateSprint}
                          >
                            <Plus className="h-4 w-4 text-zinc-400" />
                            <span className="text-zinc-400">Create new sprint...</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </>,
      document.body,
    )
  }

  return (
    <>
      {contextChild}
      {portalContent}
      {isMounted && (
        <AlertDialog
          open={showDeleteConfirm}
          onOpenChange={(open) => {
            setShowDeleteConfirm(open)
            if (!open) setPendingDelete([])
          }}
        >
          <AlertDialogContent className="bg-zinc-950 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-zinc-100">
                Delete {pendingDelete.length === 1 ? 'ticket' : `${pendingDelete.length} tickets`}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {pendingDelete.length === 1 ? (
                  <>
                    Are you sure you want to delete{' '}
                    <span className="font-semibold text-zinc-300">{pendingDelete[0]?.title}</span>?
                  </>
                ) : (
                  <>
                    Are you sure you want to delete these {pendingDelete.length} tickets? This
                    action can be undone with Ctrl+Z.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteNow}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label: string
  trailing?: React.ReactNode
  shortcut?: string
  destructive?: boolean
}

function MenuButton({
  icon,
  label,
  trailing,
  shortcut,
  destructive,
  className,
  ...rest
}: MenuButtonProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800',
        destructive && 'text-red-400 hover:bg-red-900/20',
        className,
      )}
      {...rest}
    >
      {icon && <span className={destructive ? 'text-red-400' : 'text-zinc-400'}>{icon}</span>}
      <span className={cn('flex-1', destructive && 'text-red-400')}>{label}</span>
      {shortcut && (
        <span className={cn('text-[10px] text-zinc-500 ml-3', destructive && 'text-red-400/70')}>
          {shortcut}
        </span>
      )}
      {trailing && <span className="text-zinc-500">{trailing}</span>}
    </button>
  )
}

interface MenuSectionProps {
  title: string
  children: React.ReactNode
}

function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <>
      <div className="my-1 border-t border-zinc-800" />
      <div className="px-3 py-1 text-xs uppercase text-zinc-500">{title}</div>
      {children}
    </>
  )
}
