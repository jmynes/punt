'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Bug,
  CalendarMinus,
  CalendarPlus,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  FolderOpen,
  Hash,
  Layers,
  Lightbulb,
  Pencil,
  Plus,
  Send,
  Shapes,
  Trash2,
  UserCheck,
  User as UserIcon,
  Zap,
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
import { PriorityBadge } from '@/components/common/priority-badge'
import { resolutionConfig } from '@/components/common/resolution-badge'
import { MoveToProjectDialog } from '@/components/tickets/move-to-project-dialog'
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
import { sprintKeys, useProjectSprints } from '@/hooks/queries/use-sprints'
import {
  ticketKeys as ticketQueryKeys,
  updateTicketAPI,
  updateTicketWithActivity,
} from '@/hooks/queries/use-tickets'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { pasteTickets } from '@/lib/actions'
import { deleteTickets } from '@/lib/actions/delete-tickets'
import { isCompletedColumn } from '@/lib/sprint-utils'
import { getStatusIcon } from '@/lib/status-icons'
import { formatTicketIds } from '@/lib/ticket-format'
import { getEffectiveDuration, rawToast, showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSprintStore } from '@/stores/sprint-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type {
  ColumnWithTickets,
  IssueType,
  Resolution,
  SprintSummary,
  TicketWithRelations,
} from '@/types'
import { ISSUE_TYPES, RESOLUTIONS } from '@/types'

const typeMenuConfig: Record<
  IssueType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  epic: { label: 'Epic', icon: Zap, color: 'text-purple-400' },
  story: { label: 'Story', icon: Lightbulb, color: 'text-green-400' },
  task: { label: 'Task', icon: CheckSquare, color: 'text-blue-400' },
  bug: { label: 'Bug', icon: Bug, color: 'text-red-400' },
  subtask: { label: 'Subtask', icon: Layers, color: 'text-cyan-400' },
}

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
  const { getProject } = useProjectsStore()
  // Use the ticket's projectId directly instead of relying on activeProjectId from UI store
  // This ensures we always use the correct project context
  const projectId = ticket.projectId
  const project = getProject(projectId)
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
  const [showMoveToProject, setShowMoveToProject] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
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
    id: 'priority' | 'assign' | 'send' | 'points' | 'sprint' | 'resolution' | 'type' | 'move'
    anchor: { x: number; y: number; height: number; left: number }
  }>(null)

  // Query client for invalidating sprint/ticket queries after sprint changes
  const queryClient = useQueryClient()

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

  // Compute whether selected tickets are in a sprint or backlog (for cross-list menu options)
  const activeSprint = useMemo(() => sprints.find((s) => s.status === 'active') ?? null, [sprints])
  const selectedTicketSprintInfo = useMemo(() => {
    const allTickets = columns.flatMap((c: ColumnWithTickets) => c.tickets)
    const selected = selectedIds
      .map((id: string) => allTickets.find((t: TicketWithRelations) => t.id === id))
      .filter(Boolean) as TicketWithRelations[]
    const anyInSprint = selected.some((t) => t.sprintId != null)
    const anyInBacklog = selected.some((t) => t.sprintId == null)
    return { anyInSprint, anyInBacklog }
  }, [selectedIds, columns])

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
    showToast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, {
      description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: showToast.DURATION.SHORT,
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

    showUndoRedoToast('success', {
      title: toastTitle,
      description: toastDescription,
      duration: getEffectiveDuration(3000),
    })

    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushMove(projectId, moves, fromColumnName, toColumnName, beforeColumns, afterColumns)

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
    if (updates.length === 0) return

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    rawToast.success(
      updates.length === 1 ? 'Priority updated' : `${updates.length} priorities updated`,
      {
        description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
        duration: getEffectiveDuration(3000),
      },
    )
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates)

    // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketWithActivity(projectId, update.ticketId, { priority })
        }
      } catch (err) {
        console.error('Failed to persist priority update:', err)
      }
    })()

    setOpen(false)
    setSubmenu(null)
  }

  const doType = (type: IssueType) => {
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current || current.type === type) continue
      const after = { ...current, type }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, { type })
    }
    if (updates.length === 0) return

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    rawToast.success(updates.length === 1 ? 'Type updated' : `${updates.length} types updated`, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: getEffectiveDuration(3000),
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates)

    // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketWithActivity(projectId, update.ticketId, { type })
        }
      } catch (err) {
        console.error('Failed to persist type update:', err)
      }
    })()

    setOpen(false)
    setSubmenu(null)
  }

  const doResolution = (resolution: Resolution | null) => {
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []

    // Find the first done column for auto-coupling
    const doneCol = columns.find((c: ColumnWithTickets) => isCompletedColumn(c.name))

    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current || current.resolution === resolution) continue

      // Auto-couple: setting resolution moves to done column, clearing it moves out
      const currentCol = columns.find((c: ColumnWithTickets) => c.id === current.columnId)
      const needsMove = resolution && currentCol && !isCompletedColumn(currentCol.name) && doneCol
      const needsClear = !resolution && currentCol && isCompletedColumn(currentCol.name)

      const after: TicketWithRelations = {
        ...current,
        resolution,
        // Sync resolvedAt: update timestamp on any resolution change, clear when unresolved
        resolvedAt: resolution ? new Date() : null,
        ...(needsMove && doneCol ? { columnId: doneCol.id } : {}),
        ...(needsClear ? { resolution: null, resolvedAt: null } : {}),
      }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, {
        resolution: after.resolution,
        resolvedAt: after.resolvedAt,
        ...(needsMove && doneCol ? { columnId: doneCol.id } : {}),
      })
    }
    if (updates.length === 0) return

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    const msg =
      updates.length === 1
        ? resolution
          ? `Resolution set to ${resolution}`
          : 'Resolution cleared'
        : resolution
          ? `${updates.length} tickets set to ${resolution}`
          : `Resolution cleared from ${updates.length} tickets`

    rawToast.success(msg, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: getEffectiveDuration(3000),
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates)

    // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketWithActivity(projectId, update.ticketId, { resolution })
        }
      } catch (err) {
        console.error('Failed to persist resolution update:', err)
      }
    })()

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
    if (updates.length === 0) return

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

    rawToast.success(msg, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: getEffectiveDuration(3000),
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates)

    // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketWithActivity(projectId, update.ticketId, {
            assigneeId: userId,
          })
        }
      } catch (err) {
        console.error('Failed to persist assignee update:', err)
      }
    })()

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
    if (updates.length === 0) return

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

    rawToast.success(msg, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: getEffectiveDuration(3000),
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates)

    // Persist to database
    ;(async () => {
      try {
        for (const update of updates) {
          await updateTicketWithActivity(projectId, update.ticketId, {
            storyPoints: points,
          })
        }
      } catch (err) {
        console.error('Failed to persist points update:', err)
      }
    })()

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

    showUndoRedoToast('success', {
      title:
        count === 1
          ? `${ticketKeys[0]} removed from sprint`
          : `${count} tickets removed from sprint`,
      description: count === 1 ? 'Sent to Backlog' : `${ticketKeys.join(', ')} — sent to Backlog`,
      duration: getEffectiveDuration(5000),
    })

    // Register in undo store
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushSprintMove(projectId, moves, fromLabel, 'Backlog')

    // Persist to API
    ;(async () => {
      try {
        for (const { ticket } of ticketsInSprint) {
          await updateTicketAPI(projectId, ticket.id, { sprintId: null })
        }
        // Invalidate sprint and ticket queries so other views reflect the change
        queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
        queryClient.invalidateQueries({ queryKey: ticketQueryKeys.byProject(projectId) })
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

    showUndoRedoToast('success', {
      title:
        count === 1
          ? `${ticketKeys[0]} added to ${targetSprint.name}`
          : `${count} tickets added to ${targetSprint.name}`,
      description: count === 1 ? undefined : ticketKeys.join(', '),
      duration: getEffectiveDuration(5000),
    })

    // Register in undo store
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushSprintMove(projectId, moves, fromLabel, targetSprint.name)

    // Persist to API
    ;(async () => {
      try {
        for (const { ticket } of ticketsToAdd) {
          await updateTicketAPI(projectId, ticket.id, { sprintId: targetSprint.id })
        }
        // Invalidate sprint and ticket queries so other views reflect the change
        queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
        queryClient.invalidateQueries({ queryKey: ticketQueryKeys.byProject(projectId) })
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

  /**
   * Get all tickets that share the same sprintId, sorted by order.
   * Used for send-to-top/bottom positioning operations.
   */
  const getTicketsInList = (sprintId: string | null): TicketWithRelations[] => {
    const allTickets = columns.flatMap((c: ColumnWithTickets) => c.tickets)
    const sprintIdSet = new Set(sprints.map((s) => s.id))
    return allTickets
      .filter((t: TicketWithRelations) => {
        const tSprint = t.sprintId ?? null
        if (sprintId === null) {
          // Backlog: include tickets with null/undefined sprintId
          // AND tickets whose sprintId points to a non-existent sprint (orphaned)
          return tSprint === null || (tSprint !== null && !sprintIdSet.has(tSprint))
        }
        return tSprint === sprintId
      })
      .sort(
        (a: TicketWithRelations, b: TicketWithRelations) =>
          a.order - b.order || a.number - b.number,
      )
  }

  /**
   * Send selected tickets to the top or bottom of their current list (same sprintId).
   * Preserves relative order of selected tickets when multi-selecting.
   */
  const doSendToPosition = (position: 'top' | 'bottom') => {
    const updateTickets = board.updateTickets || (() => {})
    const { setSprintSort } = useSprintStore.getState()

    // Get selected tickets with their current data
    const allTickets = columns.flatMap((c: ColumnWithTickets) => c.tickets)
    const selectedTickets = selectedIds
      .map((id: string) => allTickets.find((t: TicketWithRelations) => t.id === id))
      .filter(Boolean) as TicketWithRelations[]

    if (selectedTickets.length === 0) return

    // Group by sprintId since selected tickets might be in different lists
    const bySprintId = new Map<string | null, TicketWithRelations[]>()
    for (const t of selectedTickets) {
      const key = t.sprintId ?? null
      const existing = bySprintId.get(key)
      if (existing) {
        existing.push(t)
      } else {
        bySprintId.set(key, [t])
      }
    }

    const allOrderUpdates: { ticketId: string; oldOrder: number; newOrder: number }[] = []
    let backlogReordered: TicketWithRelations[] | null = null

    for (const [sprintId, ticketsInSelection] of bySprintId.entries()) {
      const listTickets = getTicketsInList(sprintId)
      const selectedIdsInList = new Set(ticketsInSelection.map((t) => t.id))

      // Separate selected and non-selected tickets
      const nonSelected = listTickets.filter((t) => !selectedIdsInList.has(t.id))
      // Preserve relative order of selected tickets
      const selected = listTickets.filter((t) => selectedIdsInList.has(t.id))

      // Build new order
      const reordered =
        position === 'top' ? [...selected, ...nonSelected] : [...nonSelected, ...selected]

      // Track backlog reorder for backlogOrder store update
      if (sprintId === null) {
        backlogReordered = reordered
      }

      // Calculate order updates
      reordered.forEach((ticket, index) => {
        if (ticket.order !== index) {
          allOrderUpdates.push({ ticketId: ticket.id, oldOrder: ticket.order, newOrder: index })
        }
      })
    }

    // Clear any active column-header sort so the new order is visible
    for (const sprintId of bySprintId.keys()) {
      setSprintSort(sprintId ?? 'backlog', null)
    }

    // Update backlogOrder in backlog store (used by BacklogTable for display order)
    if (backlogReordered) {
      const { setBacklogOrder } = useBacklogStore.getState()
      setBacklogOrder(
        projectId,
        backlogReordered.map((t) => t.id),
      )
    }

    if (allOrderUpdates.length === 0) {
      setOpen(false)
      setSubmenu(null)
      return
    }

    // Batch update all order changes in a single store update
    updateTickets(
      projectId,
      allOrderUpdates.map(({ ticketId, newOrder }) => ({
        ticketId,
        updates: { order: newOrder },
      })),
    )

    // Build toast message
    const ticketKeys = formatTicketIds(columns, selectedIds)
    const count = selectedTickets.length
    const posLabel = position === 'top' ? 'top' : 'bottom'

    showUndoRedoToast('success', {
      title:
        count === 1
          ? `${ticketKeys[0]} sent to ${posLabel}`
          : `${count} tickets sent to ${posLabel}`,
      description: count === 1 ? `Moved to ${posLabel} of list` : ticketKeys.join(', '),
      duration: getEffectiveDuration(3000),
    })

    // Register in undo store as update actions (order changes)
    const updates = allOrderUpdates
      .map(({ ticketId, oldOrder, newOrder }) => {
        const t = columns
          .flatMap((c: ColumnWithTickets) => c.tickets)
          .find((t: TicketWithRelations) => t.id === ticketId)
        if (!t) return null
        return {
          ticketId,
          before: { ...t, order: oldOrder } as TicketWithRelations,
          after: { ...t, order: newOrder } as TicketWithRelations,
        }
      })
      .filter(
        (u): u is { ticketId: string; before: TicketWithRelations; after: TicketWithRelations } =>
          u !== null,
      )
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(projectId, updates)

    // Persist order changes to API
    ;(async () => {
      try {
        for (const { ticketId, newOrder } of allOrderUpdates) {
          await updateTicketAPI(projectId, ticketId, { order: newOrder })
        }
      } catch (err) {
        console.error('Failed to persist order update:', err)
      }
    })()

    setOpen(false)
    setSubmenu(null)
  }

  /**
   * Send selected tickets to top or bottom of a different list (backlog or sprint).
   * Handles sprint assignment change + order positioning.
   */
  const doSendToListPosition = (
    targetSprintId: string | null,
    targetSprintName: string,
    position: 'top' | 'bottom',
  ) => {
    const updateTickets = board.updateTickets || (() => {})
    const { setSprintSort } = useSprintStore.getState()

    // Clear any active column-header sort on the target section
    setSprintSort(targetSprintId ?? 'backlog', null)

    // Get selected tickets
    const allTickets = columns.flatMap((c: ColumnWithTickets) => c.tickets)
    const selectedTickets = selectedIds
      .map((id: string) => allTickets.find((t: TicketWithRelations) => t.id === id))
      .filter(Boolean) as TicketWithRelations[]

    if (selectedTickets.length === 0) return

    // Filter tickets that actually need to move (not already in target list)
    const ticketsToMove = selectedTickets.filter((t) => (t.sprintId ?? null) !== targetSprintId)
    if (ticketsToMove.length === 0) {
      // All selected tickets are already in the target list, just reposition
      doSendToPosition(position)
      return
    }

    // Get target list tickets (excluding the ones being moved)
    const targetListTickets = getTicketsInList(targetSprintId)
    const movingIds = new Set(ticketsToMove.map((t) => t.id))
    const existingTargetTickets = targetListTickets.filter((t) => !movingIds.has(t.id))

    // Preserve relative order of tickets being moved
    const sortedMovingTickets = [...ticketsToMove].sort((a, b) => a.order - b.order)

    // Build new ordered list
    const reordered =
      position === 'top'
        ? [...sortedMovingTickets, ...existingTargetTickets]
        : [...existingTargetTickets, ...sortedMovingTickets]

    // Capture original state for undo
    const originalSprintIds = ticketsToMove.map((t) => ({
      ticketId: t.id,
      fromSprintId: t.sprintId,
      fromSprintName: t.sprint?.name ?? null,
    }))

    // Get from label
    const uniqueFromNames = [...new Set(originalSprintIds.map((t) => t.fromSprintName))]
    const fromLabel =
      uniqueFromNames.length === 1
        ? (uniqueFromNames[0] ?? 'Backlog')
        : uniqueFromNames.every((n) => n === null)
          ? 'Backlog'
          : 'multiple locations'

    // Find the target sprint object for optimistic update
    const targetSprint = targetSprintId ? sprints.find((s) => s.id === targetSprintId) : null

    // Calculate order updates for all tickets in the reordered list
    const orderUpdates: { ticketId: string; newOrder: number }[] = []
    reordered.forEach((ticket, index) => {
      if (ticket.order !== index || movingIds.has(ticket.id)) {
        orderUpdates.push({ ticketId: ticket.id, newOrder: index })
      }
    })

    // Batch optimistic update - move tickets and reorder in a single store update
    const batchUpdates: { ticketId: string; updates: Partial<TicketWithRelations> }[] = []
    for (const t of ticketsToMove) {
      const newOrder = orderUpdates.find((u) => u.ticketId === t.id)?.newOrder ?? 0
      batchUpdates.push({
        ticketId: t.id,
        updates: {
          sprintId: targetSprintId,
          sprint: targetSprint
            ? {
                id: targetSprint.id,
                name: targetSprint.name,
                status: targetSprint.status,
                startDate: targetSprint.startDate,
                endDate: targetSprint.endDate,
              }
            : null,
          order: newOrder,
        },
      })
    }
    for (const { ticketId, newOrder } of orderUpdates) {
      if (!movingIds.has(ticketId)) {
        batchUpdates.push({ ticketId, updates: { order: newOrder } })
      }
    }
    updateTickets(projectId, batchUpdates)

    // Update backlogOrder when moving to backlog (used by BacklogTable for display order)
    if (targetSprintId === null) {
      const { setBacklogOrder } = useBacklogStore.getState()
      setBacklogOrder(
        projectId,
        reordered.map((t) => t.id),
      )
    }

    // Build toast message
    const ticketKeys = formatTicketIds(
      columns,
      ticketsToMove.map((t) => t.id),
    )
    const count = ticketsToMove.length
    const posLabel = position === 'top' ? 'top' : 'bottom'

    showUndoRedoToast('success', {
      title:
        count === 1
          ? `${ticketKeys[0]} sent to ${posLabel} of ${targetSprintName}`
          : `${count} tickets sent to ${posLabel} of ${targetSprintName}`,
      description: count > 1 ? ticketKeys.join(', ') : undefined,
      duration: getEffectiveDuration(5000),
    })

    // Register sprint move in undo store
    const moves = originalSprintIds.map(({ ticketId, fromSprintId }) => ({
      ticketId,
      fromSprintId,
      toSprintId: targetSprintId,
    }))
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushSprintMove(projectId, moves, fromLabel, targetSprintName)

    // Persist to API
    ;(async () => {
      try {
        for (const t of ticketsToMove) {
          const newOrder = orderUpdates.find((u) => u.ticketId === t.id)?.newOrder ?? 0
          await updateTicketAPI(projectId, t.id, { sprintId: targetSprintId, order: newOrder })
        }
        for (const { ticketId, newOrder } of orderUpdates) {
          if (!movingIds.has(ticketId)) {
            await updateTicketAPI(projectId, ticketId, { order: newOrder })
          }
        }
        queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
        queryClient.invalidateQueries({ queryKey: ticketQueryKeys.byProject(projectId) })
      } catch (err) {
        console.error('Failed to persist send-to-list-position:', err)
      }
    })()

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
      queryClient,
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
    (id: 'priority' | 'assign' | 'send' | 'points' | 'sprint' | 'resolution' | 'type' | 'move') =>
    (e: React.MouseEvent) => {
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
      // Stop click propagation so React's synthetic event bubbling through the portal
      // doesn't reach parent click handlers (e.g. backlog table's click-to-deselect)
      <div onClick={(e) => e.stopPropagation()}>
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
              icon={<Shapes className="h-4 w-4" />}
              label="Type"
              trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
              onMouseEnter={openSubmenu('type')}
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
            <MenuButton
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Resolution"
              trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
              onMouseEnter={openSubmenu('resolution')}
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

            <MenuSection title="Position">
              <MenuButton
                icon={<ArrowUpToLine className="h-4 w-4" />}
                label="Move"
                trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                onMouseEnter={openSubmenu('move')}
              />
            </MenuSection>

            <MenuSection title="Operations">
              {!multi && ticket.type !== 'subtask' && (
                <MenuButton
                  icon={<Plus className="h-4 w-4" />}
                  label="Add Subtask"
                  onMouseEnter={closeSubmenu}
                  onClick={() => {
                    uiStore.openCreateTicketWithData({
                      type: 'subtask',
                      parentId: ticket.id,
                    })
                    setOpen(false)
                    setSubmenu(null)
                  }}
                />
              )}
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
              {!multi && (
                <MenuButton
                  icon={<FolderOpen className="h-4 w-4" />}
                  label="Move to Project"
                  onMouseEnter={closeSubmenu}
                  onClick={() => {
                    setShowMoveToProject(true)
                    setOpen(false)
                    setSubmenu(null)
                  }}
                />
              )}
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
                          {ticket.priority === p && !multi && (
                            <Check className="size-4 text-zinc-400 ml-auto" />
                          )}
                        </button>
                      ),
                    )}

                  {submenu.id === 'type' &&
                    ISSUE_TYPES.map((t) => {
                      const cfg = typeMenuConfig[t]
                      const TypeIcon = cfg.icon
                      return (
                        <button
                          key={t}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doType(t)}
                        >
                          <TypeIcon className={`h-4 w-4 ${cfg.color}`} />
                          <span>{cfg.label}</span>
                          {ticket.type === t && !multi && (
                            <Check className="size-4 text-zinc-400 ml-auto" />
                          )}
                        </button>
                      )
                    })}

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
                            {ticket.assigneeId === currentUser.id && !multi && (
                              <Check className="size-4 text-zinc-400 ml-auto" />
                            )}
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
                          {ticket.assigneeId === m.id && !multi && (
                            <Check className="size-4 text-zinc-400 ml-auto" />
                          )}
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
                          {ticket.columnId === col.id && !multi && (
                            <Check className="size-4 text-zinc-400 ml-auto" />
                          )}
                        </button>
                      )
                    })}

                  {submenu.id === 'resolution' &&
                    (() => {
                      return (
                        <>
                          {RESOLUTIONS.map((r) => {
                            const config = resolutionConfig[r]
                            const Icon = config.icon
                            return (
                              <button
                                key={r}
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                                onClick={() => doResolution(r)}
                              >
                                <Icon className="h-4 w-4" style={{ color: config.color }} />
                                <span>{r}</span>
                                {ticket.resolution === r && !multi && (
                                  <Check className="size-4 text-zinc-400 ml-auto" />
                                )}
                              </button>
                            )
                          })}
                        </>
                      )
                    })()}

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
                          {ticket.storyPoints === p && !multi && (
                            <Check className="size-4 text-zinc-400 ml-auto" />
                          )}
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
                          {ticket.sprintId === sprint.id && !multi ? (
                            <Check className="size-4 text-zinc-400 ml-auto" />
                          ) : (
                            sprint.status === 'active' && (
                              <span className="ml-auto text-[10px] text-emerald-400 uppercase">
                                Active
                              </span>
                            )
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

                  {submenu.id === 'move' && (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                        onClick={() => doSendToPosition('top')}
                      >
                        <ArrowUpToLine className="h-4 w-4" />
                        <span>Top</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                        onClick={() => doSendToPosition('bottom')}
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                        <span>Bottom</span>
                      </button>
                      {selectedTicketSprintInfo.anyInSprint && (
                        <>
                          <div className="my-1 border-t border-zinc-800" />
                          <div className="px-3 py-1 text-xs uppercase text-zinc-500">Backlog</div>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => doSendToListPosition(null, 'Backlog', 'top')}
                          >
                            <ArrowUpToLine className="h-4 w-4" />
                            <span>Top</span>
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => doSendToListPosition(null, 'Backlog', 'bottom')}
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                            <span>Bottom</span>
                          </button>
                        </>
                      )}
                      {selectedTicketSprintInfo.anyInBacklog && activeSprint && (
                        <>
                          <div className="my-1 border-t border-zinc-800" />
                          <div className="px-3 py-1 text-xs uppercase text-zinc-500">
                            {activeSprint.name}
                          </div>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() =>
                              doSendToListPosition(activeSprint.id, activeSprint.name, 'top')
                            }
                          >
                            <ArrowUpToLine className="h-4 w-4" />
                            <span>Top</span>
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() =>
                              doSendToListPosition(activeSprint.id, activeSprint.name, 'bottom')
                            }
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                            <span>Bottom</span>
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
      </div>,
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
          <AlertDialogContent
            className="bg-zinc-950 border-zinc-800"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              deleteButtonRef.current?.focus()
            }}
          >
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
                ref={deleteButtonRef}
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
      {isMounted && (
        <MoveToProjectDialog
          open={showMoveToProject}
          onOpenChange={setShowMoveToProject}
          ticket={ticket}
          projectKey={project?.key || ''}
          projectId={projectId}
        />
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
