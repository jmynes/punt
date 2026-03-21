'use client'

import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { activityKeys } from '@/hooks/queries/use-activity'
import { attachmentKeys } from '@/hooks/queries/use-attachments'
import { ticketLinkKeys } from '@/hooks/queries/use-ticket-links'
import {
  batchCreateTicketsAPI,
  batchDeleteTicketsAPI,
  columnKeys,
  createTicketAPI,
  deleteTicketAPI,
  ticketKeys,
  updateTicketAPI,
} from '@/hooks/queries/use-tickets'
import { getTabId } from '@/hooks/use-realtime'
import {
  moveTickets as moveTicketsAction,
  pasteTickets,
  reorderTickets as reorderTicketsAction,
} from '@/lib/actions'
import { deleteActivityEntries } from '@/lib/actions/activity-utils'
import {
  deleteTickets,
  restoreAttachments,
  restoreCommentsAndLinks,
} from '@/lib/actions/delete-tickets'
import { apiFetch, withBasePath } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { isEditableTarget } from '@/lib/keyboard-utils'
import { formatTicketId, formatTicketIds } from '@/lib/ticket-format'
import { getEffectiveDuration, rawToast, showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { type LinkAction, useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'
import { LINK_TYPE_LABELS } from '@/types'

export function KeyboardShortcuts() {
  const queryClient = useQueryClient()
  // Only subscribe to reactive state we need for re-renders
  const { getColumns } = useBoardStore()
  const activeProjectId = useUIStore((state) => state.activeProjectId)
  const selectedTicketIds = useSelectionStore((state) => state.selectedTicketIds)
  const activeTicketId = useUIStore((state) => state.activeTicketId)
  const createTicketOpen = useUIStore((state) => state.createTicketOpen)
  const openSinglePastedTicket = useSettingsStore((state) => state.openSinglePastedTicket)

  // Get columns for the active project
  const projectId = activeProjectId || ''
  const columns = getColumns(projectId)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [ticketsToDelete, setTicketsToDelete] = useState<TicketWithRelations[]>([])
  // Track the current attachment toast to dismiss it when a new one is shown
  const lastAttachmentToastRef = useRef<string | number | undefined>(undefined)

  // Handle Ctrl+click to close modals/drawers (workaround for Radix not handling modifier clicks)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Check if clicking on an overlay (outside modal content)
        const target = e.target as HTMLElement
        const isOverlay = target.matches(
          '[data-slot="sheet-overlay"], [data-slot="dialog-overlay"]',
        )

        if (isOverlay) {
          // Close any open drawer/modal
          if (activeTicketId) {
            useUIStore.getState().setActiveTicketId(null)
          }
          if (createTicketOpen) {
            useUIStore.getState().setCreateTicketOpen(false)
          }
        }
      }
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [activeTicketId, createTicketOpen])

  // Get all tickets flat from columns (with defensive checks for corrupted data)
  const allTickets = columns?.flatMap((col) => col?.tickets ?? []) ?? []

  const handleDeleteSelected = useCallback(() => {
    const selectedIds = useSelectionStore.getState().getSelectedIds()
    const tickets = allTickets.filter((t) => selectedIds.includes(t.id))

    if (tickets.length === 0) return

    setTicketsToDelete(tickets)
    setShowDeleteConfirm(true)
  }, [allTickets])

  const confirmDelete = async () => {
    // Prepare tickets with column IDs for the action
    const tickets = ticketsToDelete.map((ticket) => ({
      ticket,
      columnId: ticket.columnId,
    }))

    await deleteTickets({
      queryClient,
      projectId,
      tickets,
      onComplete: () => {
        setShowDeleteConfirm(false)
        setTicketsToDelete([])
      },
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (isEditableTarget(e)) {
        return
      }

      // ? key: show keyboard shortcuts
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      // Delete key: prompt to delete selected tickets
      if (e.key === 'Delete' && selectedTicketIds.size > 0) {
        e.preventDefault()
        handleDeleteSelected()
        return
      }

      // Escape: clear selection or close delete dialog
      // Precedence: modal/drawer close (handled by Radix) > delete dialog > ticket deselection > role preview exit
      if (e.key === 'Escape') {
        // Skip if already handled by a Radix dialog/drawer
        if (e.defaultPrevented) return

        // Skip if a modal or drawer is open (they handle their own Escape)
        const uiState = useUIStore.getState()
        if (
          uiState.activeTicketId ||
          uiState.createTicketOpen ||
          uiState.createProjectOpen ||
          uiState.editProjectOpen ||
          uiState.sprintCreateOpen ||
          uiState.sprintEditOpen ||
          uiState.sprintCompleteOpen ||
          uiState.sprintStartOpen
        ) {
          return
        }

        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
          return
        }
        if (selectedTicketIds.size > 0) {
          useSelectionStore.getState().clearSelection()
          return
        }
      }

      // Arrow keys: move selected tickets up/down within their column
      if (selectedTicketIds.size > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()

        const selectedIds = useSelectionStore.getState().getSelectedIds()
        if (selectedIds.length === 0) return

        // Find all selected tickets and their columns
        const selectedTicketsWithColumns: Array<{
          ticket: TicketWithRelations
          columnId: string
          currentIndex: number
        }> = []

        for (const column of columns) {
          for (let i = 0; i < column.tickets.length; i++) {
            const ticket = column.tickets[i]
            if (selectedIds.includes(ticket.id)) {
              selectedTicketsWithColumns.push({ ticket, columnId: column.id, currentIndex: i })
            }
          }
        }

        if (selectedTicketsWithColumns.length === 0) return

        // Group tickets by column
        const ticketsByColumn = new Map<string, typeof selectedTicketsWithColumns>()
        for (const item of selectedTicketsWithColumns) {
          const existing = ticketsByColumn.get(item.columnId) || []
          existing.push(item)
          ticketsByColumn.set(item.columnId, existing)
        }

        const tabId = getTabId()
        let reorderHappened = false
        const reorderedTicketIds: string[] = []

        // Reorder tickets in each column via unified action
        for (const [columnId, columnTickets] of ticketsByColumn.entries()) {
          const column = columns.find((c) => c.id === columnId)
          if (!column) continue

          columnTickets.sort((a, b) => a.currentIndex - b.currentIndex)
          const ticketIds = columnTickets.map((item) => item.ticket.id)
          const firstTicketIndex = columnTickets[0].currentIndex
          const lastTicketIndex = columnTickets[columnTickets.length - 1].currentIndex

          let targetIndex: number | null = null
          if (e.key === 'ArrowUp') {
            if (firstTicketIndex === 0) continue
            targetIndex = firstTicketIndex - 1
          } else {
            if (lastTicketIndex >= column.tickets.length - 1) continue
            targetIndex = ticketIds.length === 1 ? lastTicketIndex + 1 : lastTicketIndex + 2
          }

          if (targetIndex !== null) {
            reorderHappened = true
            reorderedTicketIds.push(...ticketIds)
            // Action handles: optimistic update, undo registration, API persistence, error rollback
            reorderTicketsAction({ projectId, columnId, ticketIds, targetIndex, tabId })
          }
        }

        // Show toast (action's toast is off by default for reorder)
        if (reorderHappened) {
          const allTickets = useBoardStore
            .getState()
            .getColumns(projectId)
            .flatMap((col) => col.tickets)
          const ticketKeys = reorderedTicketIds
            .map((id) => {
              const ticket = allTickets.find((t) => t.id === id)
              return ticket ? formatTicketId(ticket) : id
            })
            .filter(Boolean)

          const direction = e.key === 'ArrowUp' ? 'up' : 'down'
          showUndoRedoToast('success', {
            title:
              reorderedTicketIds.length === 1
                ? 'Ticket reordered'
                : `${reorderedTicketIds.length} tickets reordered`,
            description:
              reorderedTicketIds.length === 1
                ? `${ticketKeys[0]} moved ${direction}`
                : `${ticketKeys.join(', ')} moved ${direction}`,
            duration: getEffectiveDuration(5000),
          })
        }

        return
      }

      // Arrow keys: move selected tickets left/right between columns
      if (selectedTicketIds.size > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()

        const selectionStore = useSelectionStore.getState()
        const selectedIds = selectionStore.getSelectedIds()
        if (selectedIds.length === 0) return

        // Find all selected tickets and their columns, tracking origin for position restoration
        const selectedTicketsWithColumns: Array<{
          ticket: TicketWithRelations
          columnId: string
          currentIndex: number
        }> = []

        for (const column of columns) {
          for (let i = 0; i < column.tickets.length; i++) {
            const ticket = column.tickets[i]
            if (selectedIds.includes(ticket.id)) {
              const origin = selectionStore.getTicketOrigin(ticket.id)
              if (!origin) {
                selectionStore.setTicketOrigin(ticket.id, { columnId: column.id, position: i })
              }
              selectedTicketsWithColumns.push({ ticket, columnId: column.id, currentIndex: i })
            }
          }
        }

        if (selectedTicketsWithColumns.length === 0) return

        // Group tickets by column
        const ticketsByColumn = new Map<string, typeof selectedTicketsWithColumns>()
        for (const item of selectedTicketsWithColumns) {
          const existing = ticketsByColumn.get(item.columnId) || []
          existing.push(item)
          ticketsByColumn.set(item.columnId, existing)
        }

        const tabId = getTabId()

        // Move tickets in each column via unified action
        for (const [columnId, columnTickets] of ticketsByColumn.entries()) {
          const column = columns.find((c) => c.id === columnId)
          if (!column) continue

          columnTickets.sort((a, b) => a.currentIndex - b.currentIndex)
          const ticketIds = columnTickets.map((item) => item.ticket.id)
          const sortedColumns = [...columns].sort((a, b) => a.order - b.order)
          const currentColumnIndex = sortedColumns.findIndex((c) => c.id === columnId)

          const direction = e.key === 'ArrowLeft' ? -1 : 1
          const targetColumnIndex = currentColumnIndex + direction
          if (targetColumnIndex < 0 || targetColumnIndex >= sortedColumns.length) continue

          const targetColumn = sortedColumns[targetColumnIndex]

          // Check if tickets are returning to their origin column for position restoration
          const allHaveOriginInTarget = ticketIds.every((id) => {
            const origin = selectionStore.getTicketOrigin(id)
            return origin?.columnId === targetColumn.id
          })

          let targetPosition: number
          if (allHaveOriginInTarget && ticketIds.length > 0) {
            const firstTicketOrigin = selectionStore.getTicketOrigin(ticketIds[0])
            targetPosition = firstTicketOrigin?.position ?? targetColumn.tickets.length
          } else {
            targetPosition = targetColumn.tickets.length
          }

          // Action handles: optimistic update, resolution coupling, undo, toast, API, error rollback
          moveTicketsAction({
            projectId,
            ticketIds,
            toColumnId: targetColumn.id,
            toIndex: targetPosition,
            tabId,
          })
        }

        return
      }

      // Ctrl/Cmd + C: Copy selected tickets
      // Skip if drawer is open to allow normal text selection/copying in the drawer
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'c' || e.key === 'C') &&
        selectedTicketIds.size > 0 &&
        !activeTicketId // Don't copy tickets if drawer is open
      ) {
        e.preventDefault()
        useSelectionStore.getState().copySelected()
        const columnsSnapshot = useBoardStore.getState().getColumns(projectId)
        const ticketKeys = formatTicketIds(columnsSnapshot, Array.from(selectedTicketIds))
        const count = selectedTicketIds.size
        showToast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, {
          description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
          duration: showToast.DURATION.SHORT,
        })
        return
      }

      // Ctrl/Cmd + V: Paste copied tickets
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        pasteTickets({
          projectId,
          columns,
          openSinglePastedTicket,
        })
        return
      }

      // Ctrl/Cmd + I: Toggle Claude Chat panel
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        useUIStore.getState().toggleChatPanel()
        return
      }

      // Block undo/redo when a modal is open to prevent accidental
      // board modifications while the user is interacting with overlay content.
      // The ticket detail drawer is excluded — drawer edits push to the undo
      // store, so Ctrl+Z/Y should work while the drawer is open.
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')
      ) {
        const uiState = useUIStore.getState()
        if (
          uiState.createTicketOpen ||
          uiState.createProjectOpen ||
          uiState.editProjectOpen ||
          uiState.sprintCreateOpen ||
          uiState.sprintEditOpen ||
          uiState.sprintCompleteOpen ||
          uiState.sprintStartOpen
        ) {
          e.preventDefault()
          return
        }
      }

      // Check for Ctrl/Cmd + Z (Undo) - must check before redo to avoid conflicts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        const undoStore = useUndoStore.getState()
        // Atomically acquire processing lock BEFORE any stack manipulation
        if (!undoStore.tryStartProcessing()) return
        const entry = undoStore.popUndo()
        if (!entry) {
          undoStore.setProcessing(false)
          return
        }

        if (entry.action.type === 'delete') {
          const action = entry.action
          // Restore all deleted tickets optimistically
          const { addTicket } = useBoardStore.getState()
          for (const { ticket, columnId } of action.tickets) {
            addTicket(entry.projectId, columnId, ticket)
          }
          const deletedIds = new Set(action.tickets.map(({ ticket }) => ticket.id))
          const activeId = useUIStore.getState().activeTicketId
          if (activeId && deletedIds.has(activeId)) {
            useUIStore.getState().setActiveTicketId(null)
          }
          useSelectionStore.getState().clearSelection()
          undoStore.pushRedo(entry)

          // Recreate tickets in database
          ;(async () => {
            try {
              const ticketsToCreate = action.tickets.map(({ ticket, columnId }) => ({
                tempId: ticket.id,
                columnId,
                ticketData: {
                  title: ticket.title,
                  description: ticket.description,
                  type: ticket.type,
                  priority: ticket.priority,
                  storyPoints: ticket.storyPoints,
                  estimate: ticket.estimate,
                  resolution: ticket.resolution,
                  resolvedAt: ticket.resolvedAt,
                  startDate: ticket.startDate,
                  dueDate: ticket.dueDate,
                  environment: ticket.environment,
                  affectedVersion: ticket.affectedVersion,
                  fixVersion: ticket.fixVersion,
                  assigneeId: ticket.assigneeId,
                  sprintId: ticket.sprintId,
                  parentId: ticket.parentId,
                  labels: ticket.labels,
                  watchers: ticket.watchers,
                  // Preserve original creation timestamp on restore
                  createdAt: ticket.createdAt,
                },
              }))
              const serverTickets = await batchCreateTicketsAPI(entry.projectId, ticketsToCreate)
              // Replace temp tickets with server tickets
              const boardState = useBoardStore.getState()
              for (const { ticket: tempTicket, columnId, restoreData } of action.tickets) {
                const serverTicket = serverTickets.get(tempTicket.id)
                if (serverTicket) {
                  boardState.removeTicket(entry.projectId, tempTicket.id)
                  boardState.addTicket(entry.projectId, columnId, serverTicket)
                  // Extract activity IDs from server response to delete before restoring originals
                  // biome-ignore lint/suspicious/noExplicitAny: accessing internal server response field
                  const activityIdsToDelete = (serverTicket as any)._activity?.activityIds ?? []
                  // Restore attachments, comments, links, and activities
                  await restoreAttachments(entry.projectId, serverTicket.id, tempTicket.attachments)
                  await restoreCommentsAndLinks(
                    entry.projectId,
                    serverTicket.id,
                    restoreData,
                    activityIdsToDelete,
                  )
                  // Invalidate activity cache to show restored activities
                  queryClient.invalidateQueries({
                    queryKey: activityKeys.forTicket(entry.projectId, serverTicket.id),
                  })
                }
              }
            } catch (err) {
              console.error('Failed to restore tickets:', err)
              showToast.error('Failed to restore tickets')
            }
          })()

          const ticketKeys = action.tickets.map(({ ticket }) => formatTicketId(ticket))

          showUndoRedoToast('success', {
            title:
              action.tickets.length === 1
                ? 'Ticket restored'
                : `${action.tickets.length} tickets restored`,
            description: action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            duration: 3000,
          })
        } else if (entry.action.type === 'update') {
          const action = entry.action
          const boardStore = useBoardStore.getState()
          for (const item of action.tickets) {
            boardStore.updateTicket(entry.projectId, item.ticketId, item.before)
          }
          undoStore.pushRedo(entry)

          // Persist undo to database
          ;(async () => {
            try {
              // Delete activity entries from the original action
              if (entry.activityMeta) {
                await deleteActivityEntries(entry.projectId, entry.activityMeta)
              }
              for (const item of action.tickets) {
                await updateTicketAPI(entry.projectId, item.ticketId, item.before)
              }
            } catch (err) {
              console.error('Failed to persist update undo:', err)
            }
          })()

          const ticketKeys = action.tickets
            .map((item) => {
              const t = boardStore
                .getColumns(entry.projectId)
                .flatMap((c) => c.tickets)
                .find((tk) => tk.id === item.ticketId)
              return t ? formatTicketId(t) : item.ticketId
            })
            .filter(Boolean)

          showUndoRedoToast('success', {
            title:
              action.tickets.length === 1
                ? 'Change undone'
                : `${action.tickets.length} changes undone`,
            description: action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            duration: 3000,
          })
        } else if (entry.action.type === 'move') {
          const action = entry.action
          // Restore the exact column state from before the move
          const moveBoardStore = useBoardStore.getState()
          if (action.originalColumns) {
            // Use the stored original column state for precise undo
            const restoredColumns = action.originalColumns.map((col) => ({
              ...col,
              tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
            }))
            moveBoardStore.setColumns(entry.projectId, restoredColumns)
          } else {
            // Fallback: move tickets back one by one (legacy behavior)
            for (const move of action.moves) {
              moveBoardStore.moveTicket(
                entry.projectId,
                move.ticketId,
                move.toColumnId,
                move.fromColumnId,
                0,
              )
            }
          }

          // Push to redo stack (same entry, will restore to afterColumns when redoing)
          undoStore.pushRedo(entry)

          // Persist move undo to database
          ;(async () => {
            try {
              // Delete activity entries from the original action
              if (entry.activityMeta) {
                await deleteActivityEntries(entry.projectId, entry.activityMeta)
              }
              // Update each moved ticket's columnId back to original,
              // including resolution/resolvedAt to keep them in sync
              for (const move of action.moves) {
                // Look up the original ticket state to restore resolution/resolvedAt
                const originalTicket = action.originalColumns
                  ?.flatMap((col) => col.tickets)
                  .find((t) => t.id === move.ticketId)
                const updates: Partial<TicketWithRelations> = {
                  columnId: move.fromColumnId,
                }
                if (originalTicket) {
                  updates.resolution = originalTicket.resolution
                  updates.resolvedAt = originalTicket.resolvedAt
                }
                await updateTicketAPI(entry.projectId, move.ticketId, updates)
              }
            } catch (err) {
              console.error('Failed to persist move undo:', err)
            }
          })()

          // Look up ticket IDs from columns
          const moveAllTickets = moveBoardStore
            .getColumns(entry.projectId)
            .flatMap((col) => col.tickets)
          const moveTicketKeys = action.moves
            .map((move) => {
              const ticket = moveAllTickets.find((t) => t.id === move.ticketId)
              return ticket ? formatTicketId(ticket) : move.ticketId
            })
            .filter(Boolean)

          showUndoRedoToast('success', {
            title:
              action.moves.length === 1 ? 'Move undone' : `${action.moves.length} moves undone`,
            description: action.moves.length === 1 ? moveTicketKeys[0] : moveTicketKeys.join(', '),
            duration: 3000,
          })
        } else if (entry.action.type === 'paste') {
          const action = entry.action
          // Remove all pasted tickets from store and database
          const { removeTicket } = useBoardStore.getState()
          const ticketIdsToDelete: string[] = []

          for (const { ticket } of action.tickets) {
            // Use the stored ticket ID (which is now the server ID after updatePastedTicketId)
            removeTicket(entry.projectId, ticket.id)
            ticketIdsToDelete.push(ticket.id)
          }

          // Close drawer if viewing one of the deleted tickets
          const pasteActiveId = useUIStore.getState().activeTicketId
          if (pasteActiveId && ticketIdsToDelete.includes(pasteActiveId)) {
            useUIStore.getState().setActiveTicketId(null)
          }
          useSelectionStore.getState().clearSelection()
          undoStore.pushRedo(entry)

          // Delete from database
          if (ticketIdsToDelete.length > 0) {
            batchDeleteTicketsAPI(entry.projectId, ticketIdsToDelete).catch((err) => {
              console.error('Failed to delete pasted tickets on undo:', err)
            })
          }

          // Format ticket IDs for notification
          const pasteTicketKeys = action.tickets.map(({ ticket }) => formatTicketId(ticket))

          showUndoRedoToast('success', {
            title:
              action.tickets.length === 1
                ? 'Paste undone'
                : `${action.tickets.length} pastes undone`,
            description:
              action.tickets.length === 1 ? pasteTicketKeys[0] : pasteTicketKeys.join(', '),
            duration: 3000,
          })
        } else if (entry.action.type === 'ticketCreate') {
          const action = entry.action
          // Undo ticket creation = delete the ticket
          const { removeTicket } = useBoardStore.getState()
          removeTicket(entry.projectId, action.ticket.id)
          undoStore.pushRedo(entry)

          // Delete from server (await to block next undo/redo)
          undoStore.setProcessing(true)
          deleteTicketAPI(entry.projectId, action.ticket.id)
            .catch((err) => {
              console.error('Failed to delete ticket on undo:', err)
            })
            .finally(() => {
              useUndoStore.getState().setProcessing(false)
            })

          const ticketKey = formatTicketId(action.ticket)

          showUndoRedoToast('success', {
            title: 'Ticket creation undone',
            description: ticketKey,
            duration: 3000,
          })
        } else if (entry.action.type === 'sprintMove') {
          const action = entry.action
          // Undo sprint move = move tickets back to original sprint
          const boardStore = useBoardStore.getState()

          // Move tickets back to original sprint in store
          // Clear the sprint relation object so the UI doesn't show stale sprint data
          for (const move of action.moves) {
            boardStore.updateTicket(entry.projectId, move.ticketId, {
              sprintId: move.fromSprintId,
              sprint: null,
            })
          }

          undoStore.pushRedo(entry)

          // Persist undo to database
          ;(async () => {
            try {
              for (const move of action.moves) {
                await updateTicketAPI(entry.projectId, move.ticketId, {
                  sprintId: move.fromSprintId,
                })
              }
            } catch (err) {
              console.error('Failed to persist sprint move undo:', err)
            }
          })()

          showUndoRedoToast('success', {
            title:
              action.moves.length === 1
                ? 'Sprint move undone'
                : `${action.moves.length} sprint moves undone`,
            description: `Moved back to ${action.fromSprintName}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'columnCreate') {
          const action = entry.action
          // Undo column create: move tickets back (if any) and delete the column
          const boardStore = useBoardStore.getState()
          const cols = boardStore.getColumns(entry.projectId)

          // Move tickets back to their original columns first
          if (action.movedTickets && action.movedTickets.length > 0) {
            const col = cols.find((c) => c.id === action.columnId)
            const updatedCols = cols.map((c) => {
              if (c.id === action.columnId) {
                // Remove moved tickets from this column
                const movedIds = new Set(action.movedTickets?.map((t) => t.ticketId))
                return { ...c, tickets: c.tickets.filter((t) => !movedIds.has(t.id)) }
              }
              // Add tickets back to their original columns
              const returningTickets =
                action.movedTickets?.filter((t) => t.fromColumnId === c.id) ?? []
              if (returningTickets.length > 0 && col) {
                const ticketsToReturn = returningTickets
                  .map((rt) => col.tickets.find((t) => t.id === rt.ticketId))
                  .filter((t): t is typeof t & {} => t != null)
                  .map((t) => ({ ...t, columnId: c.id }))
                return { ...c, tickets: [...c.tickets, ...ticketsToReturn] }
              }
              return c
            })
            boardStore.setColumns(
              entry.projectId,
              updatedCols.filter((c) => c.id !== action.columnId),
            )
          } else {
            boardStore.setColumns(
              entry.projectId,
              cols.filter((c) => c.id !== action.columnId),
            )
          }
          undoStore.pushRedo(entry)

          // Persist to server
          undoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                // Move tickets back first
                if (action.movedTickets && action.movedTickets.length > 0) {
                  for (const moved of action.movedTickets) {
                    await apiFetch(`/api/projects/${entry.projectId}/tickets/${moved.ticketId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(tabId && { 'X-Tab-Id': tabId }),
                      },
                      body: JSON.stringify({ columnId: moved.fromColumnId }),
                    })
                  }
                }
                // Then delete the column
                const res = await apiFetch(
                  `/api/projects/${entry.projectId}/columns/${action.columnId}`,
                  {
                    method: 'DELETE',
                    headers: {
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                  },
                )
                if (!res.ok) throw new Error('Failed to delete column')
                queryClient.invalidateQueries({ queryKey: columnKeys.byProject(entry.projectId) })
              }
            } catch (err) {
              console.error('Failed to undo column create:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Column creation undone',
            description: `Removed "${action.columnName}"`,
            duration: 3000,
          })
        } else if (entry.action.type === 'columnRename') {
          const action = entry.action
          // Undo column rename: revert to old name/icon
          const boardStore = useBoardStore.getState()
          const cols = boardStore.getColumns(entry.projectId)
          boardStore.setColumns(
            entry.projectId,
            cols.map((c) =>
              c.id === action.columnId
                ? { ...c, name: action.oldName, icon: action.oldIcon, color: action.oldColor }
                : c,
            ),
          )
          undoStore.pushRedo(entry)

          // Persist to server
          undoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                await apiFetch(`/api/projects/${entry.projectId}/columns/${action.columnId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(tabId && { 'X-Tab-Id': tabId }),
                  },
                  body: JSON.stringify({
                    name: action.oldName,
                    icon: action.oldIcon,
                    color: action.oldColor,
                  }),
                })
                queryClient.invalidateQueries({ queryKey: columnKeys.byProject(entry.projectId) })
              }
            } catch (err) {
              console.error('Failed to undo column rename:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Column update undone',
            description: `Reverted to "${action.oldName}"`,
            duration: 3000,
          })
        } else if (entry.action.type === 'columnDelete') {
          const action = entry.action
          // Undo column delete: recreate column and move tickets back
          undoStore.pushRedo(entry)
          undoStore.setProcessing(true)
          ;(async () => {
            try {
              let newColId: string

              if (isDemoMode()) {
                newColId = `column-${Date.now()}`
              } else {
                const tabId = getTabId()
                // Recreate column
                const createRes = await apiFetch(`/api/projects/${entry.projectId}/columns`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(tabId && { 'X-Tab-Id': tabId }),
                  },
                  body: JSON.stringify({ name: action.column.name }),
                })
                if (!createRes.ok) throw new Error('Failed to recreate column')
                const newCol = await createRes.json()
                newColId = newCol.id

                // Set icon and order if needed
                if (action.column.icon || newCol.order !== action.column.order) {
                  await apiFetch(`/api/projects/${entry.projectId}/columns/${newCol.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                    body: JSON.stringify({
                      ...(action.column.icon && { icon: action.column.icon }),
                      order: action.column.order,
                    }),
                  })
                }

                // Move tickets back
                for (const ticket of action.column.tickets) {
                  await apiFetch(`/api/projects/${entry.projectId}/tickets/${ticket.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                    body: JSON.stringify({ columnId: newCol.id }),
                  })
                }

                queryClient.invalidateQueries({ queryKey: columnKeys.byProject(entry.projectId) })
                queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(entry.projectId) })
              }

              // Update board store
              const bs = useBoardStore.getState()
              const restoredColumn = {
                ...action.column,
                id: newColId,
                tickets: action.column.tickets.map((t) => ({ ...t, columnId: newColId })),
              }
              const currentCols = bs.getColumns(entry.projectId)
              const restoredCols = currentCols.map((c) => {
                if (c.id === action.movedToColumnId) {
                  const movedTicketIds = new Set(action.column.tickets.map((t) => t.id))
                  return { ...c, tickets: c.tickets.filter((t) => !movedTicketIds.has(t.id)) }
                }
                return c
              })
              restoredCols.splice(action.column.order, 0, restoredColumn)
              bs.setColumns(entry.projectId, restoredCols)

              // Update the action's column id for future redo
              action.column.id = newColId
            } catch (err) {
              console.error('Failed to undo column delete:', err)
              showToast.error('Failed to restore column')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Column restored',
            description: `"${action.column.name}" restored`,
            duration: 3000,
          })
        } else if (entry.action.type === 'attachmentAdd') {
          const action = entry.action
          // Undo attachment add: delete the added attachments
          // Set processing to block subsequent Ctrl+Z/Y during async operation
          undoStore.setProcessing(true)
          undoStore.pushRedo(entry)

          const fileNames =
            action.attachments.length === 1
              ? `"${action.attachments[0].attachment.originalName}"`
              : `${action.attachments.length} files`
          const attTicketKey = action.attachments[0]?.ticketKey ?? ''

          // Create toast FIRST so we capture the correct toast ID for the async IIFE
          if (lastAttachmentToastRef.current) rawToast.dismiss(lastAttachmentToastRef.current)
          const attAddToastId = showUndoRedoToast('error', {
            title:
              action.attachments.length === 1
                ? 'Attachment removed'
                : `${action.attachments.length} attachments removed`,
            description: `${fileNames} from ${attTicketKey}`,
            duration: 3000,
          })
          lastAttachmentToastRef.current = attAddToastId

          // Delete the attachments asynchronously
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                for (const att of action.attachments) {
                  await fetch(
                    `/api/projects/${att.projectId}/tickets/${att.ticketId}/attachments/${att.attachment.id}`,
                    {
                      method: 'DELETE',
                      headers: { ...(tabId && { 'X-Tab-Id': tabId }) },
                    },
                  )
                  queryClient.invalidateQueries({
                    queryKey: attachmentKeys.forTicket(att.projectId, att.ticketId),
                  })
                }
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to undo attachment add:', err)
              showToast.error('Failed to undo attachment add')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()
        } else if (entry.action.type === 'attachmentDelete') {
          const action = entry.action
          // Undo attachment delete: re-add the deleted attachments
          // Set processing to block subsequent Ctrl+Z/Y during async operation
          undoStore.setProcessing(true)
          undoStore.pushRedo(entry)

          const fileNames =
            action.attachments.length === 1
              ? `"${action.attachments[0].attachment.originalName}"`
              : `${action.attachments.length} files`
          const attTicketKey = action.attachments[0]?.ticketKey ?? ''

          // Create toast FIRST, then dismiss previous attachment toast
          if (lastAttachmentToastRef.current) rawToast.dismiss(lastAttachmentToastRef.current)
          const attDelToastId = showUndoRedoToast('success', {
            title:
              action.attachments.length === 1
                ? 'Attachment restored'
                : `${action.attachments.length} attachments restored`,
            description: `${fileNames} to ${attTicketKey}`,
            duration: 3000,
          })
          lastAttachmentToastRef.current = attDelToastId

          // Re-add the attachments asynchronously
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                for (const att of action.attachments) {
                  const res = await fetch(
                    `/api/projects/${att.projectId}/tickets/${att.ticketId}/attachments`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(tabId && { 'X-Tab-Id': tabId }),
                      },
                      body: JSON.stringify({
                        attachments: [
                          {
                            filename: att.attachment.filename,
                            originalName: att.attachment.originalName,
                            mimeType: att.attachment.mimetype,
                            size: att.attachment.size,
                            url: att.attachment.url,
                          },
                        ],
                      }),
                    },
                  )
                  if (res.ok) {
                    await res.json()
                  }
                  queryClient.invalidateQueries({
                    queryKey: attachmentKeys.forTicket(att.projectId, att.ticketId),
                  })
                }
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to undo attachment delete:', err)
              showToast.error('Failed to restore attachments')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()
        } else if (entry.action.type === 'backlogReorder') {
          const action = entry.action
          const { setBacklogOrder } = useBacklogStore.getState()
          setBacklogOrder(entry.projectId, action.beforeOrder)
          undoStore.pushRedo(entry)

          showUndoRedoToast('success', {
            title: 'Reorder undone',
            description: 'Backlog order restored',
            duration: 3000,
          })
        } else if (entry.action.type === 'linkCreate') {
          // Undo link create: delete the created link
          const action = entry.action
          undoStore.setProcessing(true)
          undoStore.pushRedo(entry)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                const res = await apiFetch(
                  `/api/projects/${action.link.projectId}/tickets/${action.link.ticketId}/links/${action.link.linkId}`,
                  {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                  },
                )
                if (!res.ok) throw new Error('Failed to delete link')
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(action.link.projectId, action.link.ticketId),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.link.projectId,
                    action.link.targetTicketId,
                  ),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to undo link create:', err)
              showToast.error('Failed to undo link creation')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('error', {
            title: 'Link removed',
            description: `${action.link.ticketKey} ${LINK_TYPE_LABELS[action.link.linkType].toLowerCase()} ${action.link.targetTicketKey}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'bulkLinkCreate') {
          // Undo bulk link create: delete all created links
          const action = entry.action
          undoStore.setProcessing(true)
          undoStore.pushRedo(entry)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                const headers: HeadersInit = {
                  'Content-Type': 'application/json',
                  ...(tabId && { 'X-Tab-Id': tabId }),
                }
                await Promise.allSettled(
                  action.links.map((link) =>
                    apiFetch(
                      `/api/projects/${link.projectId}/tickets/${link.ticketId}/links/${link.linkId}`,
                      { method: 'DELETE', headers },
                    ),
                  ),
                )
                // Invalidate source ticket
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.links[0].projectId,
                    action.links[0].ticketId,
                  ),
                })
                // Invalidate all target tickets
                for (const link of action.links) {
                  queryClient.invalidateQueries({
                    queryKey: ticketLinkKeys.byTicket(link.projectId, link.targetTicketId),
                  })
                }
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to undo bulk link create:', err)
              showToast.error('Failed to undo link creation')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('error', {
            title: `${action.links.length} link${action.links.length === 1 ? '' : 's'} removed`,
            description: `Unlinked from ${action.links[0].ticketKey}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'linkDelete') {
          // Undo link delete: re-create the link
          const action = entry.action
          undoStore.setProcessing(true)
          ;(async () => {
            try {
              if (isDemoMode()) {
                undoStore.pushRedo(entry)
              } else {
                const tabId = getTabId()
                const res = await apiFetch(
                  `/api/projects/${action.link.projectId}/tickets/${action.link.ticketId}/links`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                    body: JSON.stringify({
                      linkType: action.link.linkType,
                      targetTicketId: action.link.targetTicketId,
                    }),
                  },
                )
                if (!res.ok) throw new Error('Failed to re-create link')
                const newLink = await res.json()
                // Update the link ID in the undo entry for future redo
                const updatedEntry = {
                  ...entry,
                  action: {
                    ...action,
                    link: { ...action.link, linkId: newLink.id },
                  },
                }
                undoStore.pushRedo(updatedEntry)
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(action.link.projectId, action.link.ticketId),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.link.projectId,
                    action.link.targetTicketId,
                  ),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to undo link delete:', err)
              showToast.error('Failed to restore link')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Link restored',
            description: `${action.link.ticketKey} ${LINK_TYPE_LABELS[action.link.linkType].toLowerCase()} ${action.link.targetTicketKey}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'linkUpdate') {
          // Undo link update: revert to previous link type
          const action = entry.action
          undoStore.setProcessing(true)
          undoStore.pushRedo(entry)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                const res = await apiFetch(
                  `/api/projects/${action.link.projectId}/tickets/${action.link.ticketId}/links/${action.link.linkId}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                    body: JSON.stringify({ linkType: action.oldLinkType }),
                  },
                )
                if (!res.ok) throw new Error('Failed to revert link type')
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(action.link.projectId, action.link.ticketId),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.link.projectId,
                    action.link.targetTicketId,
                  ),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to undo link update:', err)
              showToast.error('Failed to revert link type')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Link type reverted',
            description: `${action.link.ticketKey}: ${LINK_TYPE_LABELS[action.oldLinkType]}`,
            duration: 3000,
          })
        }

        // Release processing lock for types that don't have their own async lock management
        // (ticketCreate, columnRename, columnDelete, attachment*, link* handlers manage their own lock)
        const selfManagedTypes = [
          'ticketCreate',
          'columnCreate',
          'columnRename',
          'columnDelete',
          'attachmentAdd',
          'attachmentDelete',
          'linkCreate',
          'bulkLinkCreate',
          'linkDelete',
          'linkUpdate',
        ]
        if (!selfManagedTypes.includes(entry.action.type)) {
          undoStore.setProcessing(false)
        }
      }

      // Check for Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (Redo)
      // Note: When Shift is pressed, the key is uppercase 'Z', so we check for that
      const isRedo =
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')

      if (isRedo) {
        e.preventDefault()
        const redoStore = useUndoStore.getState()
        // Atomically acquire processing lock BEFORE any stack manipulation
        if (!redoStore.tryStartProcessing()) return
        const entry = redoStore.popRedo()
        if (!entry) {
          redoStore.setProcessing(false)
          return
        }

        if (entry.action.type === 'delete') {
          const action = entry.action
          const { removeTicket } = useBoardStore.getState()

          // Find and delete tickets (they may have been replaced with server tickets)
          const boardState = useBoardStore.getState()
          const ticketIdsToDelete: string[] = []
          for (const { ticket } of action.tickets) {
            const cols = boardState.getColumns(entry.projectId)
            const foundTicket = cols
              .flatMap((c) => c.tickets)
              .find((t) => t.id === ticket.id || t.title === ticket.title)
            if (foundTicket) {
              removeTicket(entry.projectId, foundTicket.id)
              ticketIdsToDelete.push(foundTicket.id)
            }
          }

          // Delete from database
          if (ticketIdsToDelete.length > 0) {
            batchDeleteTicketsAPI(entry.projectId, ticketIdsToDelete).catch((err) => {
              console.error('Failed to delete tickets on redo:', err)
            })
          }

          const delTicketKeys = action.tickets.map(({ ticket }) => formatTicketId(ticket))

          showUndoRedoToast('error', {
            title:
              action.tickets.length === 1
                ? 'Ticket deleted'
                : `${action.tickets.length} tickets deleted`,
            description: action.tickets.length === 1 ? delTicketKeys[0] : delTicketKeys.join(', '),
            duration: getEffectiveDuration(5000),
          })

          redoStore.pushDeletedBatch(entry.projectId, action.tickets, true)
        } else if (entry.action.type === 'update') {
          const action = entry.action
          const boardStore = useBoardStore.getState()
          for (const item of action.tickets) {
            boardStore.updateTicket(entry.projectId, item.ticketId, item.after)
          }
          // Persist redo to database
          ;(async () => {
            try {
              for (const item of action.tickets) {
                await updateTicketAPI(entry.projectId, item.ticketId, item.after)
              }
            } catch (err) {
              console.error('Failed to persist update redo:', err)
            }
          })()

          const swappedTickets = action.tickets.map((item) => ({
            ticketId: item.ticketId,
            before: item.before,
            after: item.after,
          }))
          const ticketKeys = swappedTickets
            .map((item) => {
              const t = boardStore
                .getColumns(entry.projectId)
                .flatMap((c) => c.tickets)
                .find((tk) => tk.id === item.ticketId)
              return t ? formatTicketId(t) : item.ticketId
            })
            .filter(Boolean)

          showUndoRedoToast('success', {
            title:
              swappedTickets.length === 1
                ? 'Change redone'
                : `${swappedTickets.length} changes redone`,
            description: swappedTickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            duration: 3000,
          })

          redoStore.pushUpdate(entry.projectId, swappedTickets, true)
        } else if (entry.action.type === 'move') {
          const action = entry.action
          const boardStore = useBoardStore.getState()
          const currentStateBeforeRedo = boardStore.getColumns(entry.projectId).map((col) => ({
            ...col,
            tickets: col.tickets.map((t) => ({ ...t })),
          }))

          if (action.afterColumns) {
            const restoredColumns = action.afterColumns.map((col) => ({
              ...col,
              tickets: col.tickets.map((t) => ({ ...t })),
            }))
            boardStore.setColumns(entry.projectId, restoredColumns)
          } else {
            for (const move of action.moves) {
              boardStore.moveTicket(
                entry.projectId,
                move.ticketId,
                move.fromColumnId,
                move.toColumnId,
                0,
              )
            }
          }
          // Persist move redo to database
          ;(async () => {
            try {
              for (const move of action.moves) {
                // Look up the after-move ticket state to restore resolution/resolvedAt
                const afterTicket = action.afterColumns
                  ?.flatMap((col) => col.tickets)
                  .find((t) => t.id === move.ticketId)
                const updates: Partial<TicketWithRelations> = {
                  columnId: move.toColumnId,
                }
                if (afterTicket) {
                  updates.resolution = afterTicket.resolution
                  updates.resolvedAt = afterTicket.resolvedAt
                }
                await updateTicketAPI(entry.projectId, move.ticketId, updates)
              }
            } catch (err) {
              console.error('Failed to persist move redo:', err)
            }
          })()

          const allTickets = boardStore.getColumns(entry.projectId).flatMap((col) => col.tickets)
          const ticketKeys = action.moves
            .map((move) => {
              const ticket = allTickets.find((t) => t.id === move.ticketId)
              return ticket ? formatTicketId(ticket) : move.ticketId
            })
            .filter(Boolean)

          showUndoRedoToast('success', {
            title:
              action.moves.length === 1 ? 'Ticket moved' : `${action.moves.length} tickets moved`,
            description:
              action.moves.length === 1
                ? `${ticketKeys[0]} moved to ${action.toColumnName}`
                : `${ticketKeys.join(', ')} moved to ${action.toColumnName}`,
            duration: getEffectiveDuration(5000),
          })

          useUndoStore
            .getState()
            .pushMove(
              entry.projectId,
              action.moves,
              action.toColumnName,
              action.fromColumnName,
              currentStateBeforeRedo,
              action.afterColumns,
              true,
            )
        } else if (entry.action.type === 'paste') {
          const action = entry.action
          const { addTicket: redoAddTicket, removeTicket: redoRemoveTicket } =
            useBoardStore.getState()

          // Generate new temp IDs for redo
          const redoTickets: Array<{ ticket: TicketWithRelations; columnId: string }> = []
          for (const { ticket, columnId } of action.tickets) {
            const tempId = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            const redoTicket = { ...ticket, id: tempId }
            redoTickets.push({ ticket: redoTicket, columnId })
            redoAddTicket(entry.projectId, columnId, redoTicket)
          }
          // Persist to database
          ;(async () => {
            try {
              const ticketsToCreate = redoTickets.map(({ ticket, columnId }) => ({
                tempId: ticket.id,
                columnId,
                ticketData: {
                  title: ticket.title,
                  description: ticket.description,
                  type: ticket.type,
                  priority: ticket.priority,
                  storyPoints: ticket.storyPoints,
                  estimate: ticket.estimate,
                  resolution: ticket.resolution,
                  resolvedAt: ticket.resolvedAt,
                  startDate: ticket.startDate,
                  dueDate: ticket.dueDate,
                  environment: ticket.environment,
                  affectedVersion: ticket.affectedVersion,
                  fixVersion: ticket.fixVersion,
                  assigneeId: ticket.assigneeId,
                  sprintId: ticket.sprintId,
                  parentId: ticket.parentId,
                  labels: ticket.labels,
                  watchers: ticket.watchers,
                },
              }))
              const serverTickets = await batchCreateTicketsAPI(entry.projectId, ticketsToCreate)
              const boardState = useBoardStore.getState()
              const undoState = useUndoStore.getState()
              for (const { ticket: tempTicket, columnId } of redoTickets) {
                const serverTicket = serverTickets.get(tempTicket.id)
                if (serverTicket) {
                  boardState.removeTicket(entry.projectId, tempTicket.id)
                  boardState.addTicket(entry.projectId, columnId, serverTicket)
                  undoState.updatePastedTicketId(entry.projectId, tempTicket.id, serverTicket)
                }
              }
            } catch (err) {
              console.error('Failed to persist pasted tickets on redo:', err)
              // Rollback on error
              for (const { ticket } of redoTickets) {
                redoRemoveTicket(entry.projectId, ticket.id)
              }
              rawToast.error('Failed to redo paste')
            }
          })()

          const redoPasteTicketKeys = redoTickets.map(({ ticket }) => formatTicketId(ticket))
          showUndoRedoToast('success', {
            title:
              redoTickets.length === 1 ? 'Ticket pasted' : `${redoTickets.length} tickets pasted`,
            description:
              redoTickets.length === 1 ? redoPasteTicketKeys[0] : redoPasteTicketKeys.join(', '),
            duration: getEffectiveDuration(5000),
          })
          redoStore.pushPaste(entry.projectId, redoTickets, true)
        } else if (entry.action.type === 'ticketCreate') {
          const action = entry.action
          // Redo ticket creation = add the ticket back
          const { addTicket } = useBoardStore.getState()
          addTicket(entry.projectId, action.columnId, action.ticket)

          // Re-create on server (await to block next undo/redo)
          redoStore.setProcessing(true)
          createTicketAPI(entry.projectId, action.columnId, action.ticket)
            .then((serverTicket) => {
              const bs = useBoardStore.getState()
              bs.removeTicket(entry.projectId, action.ticket.id)
              bs.addTicket(entry.projectId, action.columnId, serverTicket)
              useUndoStore.getState().updateTicketCreateEntry(action.ticket.id, serverTicket)
              action.ticket = serverTicket
            })
            .catch((err) => {
              console.error('Failed to recreate ticket on redo:', err)
            })
            .finally(() => {
              useUndoStore.getState().setProcessing(false)
            })

          const ticketKey = formatTicketId(action.ticket)
          showUndoRedoToast('success', {
            title: 'Ticket created',
            description: ticketKey,
            duration: getEffectiveDuration(5000),
          })

          redoStore.pushTicketCreate(entry.projectId, action.ticket, action.columnId, true)
        } else if (entry.action.type === 'sprintMove') {
          const action = entry.action
          // Redo sprint move = move tickets to target sprint again
          const boardStore = useBoardStore.getState()

          // Clear the sprint relation object so the UI doesn't show stale sprint data
          for (const move of action.moves) {
            boardStore.updateTicket(entry.projectId, move.ticketId, {
              sprintId: move.toSprintId,
              sprint: null,
            })
          }
          // Persist redo to database
          ;(async () => {
            try {
              for (const move of action.moves) {
                await updateTicketAPI(entry.projectId, move.ticketId, {
                  sprintId: move.toSprintId,
                })
              }
            } catch (err) {
              console.error('Failed to persist sprint move redo:', err)
            }
          })()

          showUndoRedoToast('success', {
            title:
              action.moves.length === 1 ? 'Ticket moved' : `${action.moves.length} tickets moved`,
            description: `Moved to ${action.toSprintName}`,
            duration: getEffectiveDuration(5000),
          })

          redoStore.pushSprintMove(
            entry.projectId,
            action.moves,
            action.fromSprintName,
            action.toSprintName,
            true,
          )
        } else if (entry.action.type === 'columnCreate') {
          const action = entry.action
          // Redo column create: recreate column and move tickets back into it
          redoStore.setProcessing(true)
          ;(async () => {
            try {
              let newColId: string

              if (isDemoMode()) {
                newColId = `column-${Date.now()}`
                const bs = useBoardStore.getState()
                const currentCols = bs.getColumns(entry.projectId)
                const newCol = {
                  id: newColId,
                  name: action.columnName,
                  icon: null,
                  color: null,
                  order: currentCols.length,
                  projectId: entry.projectId,
                  tickets: [] as TicketWithRelations[],
                }
                bs.setColumns(entry.projectId, [...currentCols, newCol])
              } else {
                const tabId = getTabId()
                const res = await apiFetch(`/api/projects/${entry.projectId}/columns`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(tabId && { 'X-Tab-Id': tabId }),
                  },
                  body: JSON.stringify({ name: action.columnName }),
                })
                if (!res.ok) throw new Error('Failed to recreate column')
                const newCol = await res.json()
                newColId = newCol.id

                // Update board store
                const bs = useBoardStore.getState()
                const currentCols = bs.getColumns(entry.projectId)
                bs.setColumns(entry.projectId, [...currentCols, { ...newCol, tickets: [] }])

                // Move tickets back into the recreated column
                if (action.movedTickets && action.movedTickets.length > 0) {
                  for (const moved of action.movedTickets) {
                    await apiFetch(`/api/projects/${entry.projectId}/tickets/${moved.ticketId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(tabId && { 'X-Tab-Id': tabId }),
                      },
                      body: JSON.stringify({ columnId: newCol.id }),
                    })
                  }
                }

                queryClient.invalidateQueries({ queryKey: columnKeys.byProject(entry.projectId) })
              }

              // Move tickets in store (works for both demo and production)
              if (action.movedTickets && action.movedTickets.length > 0) {
                for (const moved of action.movedTickets) {
                  const updatedBs = useBoardStore.getState()
                  updatedBs.moveTicket(
                    entry.projectId,
                    moved.ticketId,
                    moved.fromColumnId,
                    newColId,
                    0,
                  )
                }
              }

              // Push to undo with new column ID and moved ticket info
              redoStore.pushColumnCreate(
                entry.projectId,
                newColId,
                action.columnName,
                true,
                action.movedTickets?.map((t) => ({
                  ticketId: t.ticketId,
                  fromColumnId: t.fromColumnId,
                })),
              )
            } catch (err) {
              console.error('Failed to redo column create:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Column recreated',
            description: `"${action.columnName}" added back`,
            duration: getEffectiveDuration(5000),
          })
        } else if (entry.action.type === 'columnRename') {
          const action = entry.action
          // Redo column rename: re-apply new name/icon
          const boardStore = useBoardStore.getState()
          const cols = boardStore.getColumns(entry.projectId)
          boardStore.setColumns(
            entry.projectId,
            cols.map((c) =>
              c.id === action.columnId
                ? { ...c, name: action.newName, icon: action.newIcon, color: action.newColor }
                : c,
            ),
          )

          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                await apiFetch(`/api/projects/${entry.projectId}/columns/${action.columnId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(tabId && { 'X-Tab-Id': tabId }),
                  },
                  body: JSON.stringify({
                    name: action.newName,
                    icon: action.newIcon,
                    color: action.newColor,
                  }),
                })
                queryClient.invalidateQueries({ queryKey: columnKeys.byProject(entry.projectId) })
              }
            } catch (err) {
              console.error('Failed to redo column rename:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Column updated',
            description: `Renamed to "${action.newName}"`,
            duration: getEffectiveDuration(5000),
          })
          redoStore.pushColumnRename(
            entry.projectId,
            action.columnId,
            action.oldName,
            action.newName,
            action.oldIcon,
            action.newIcon,
            action.oldColor,
            action.newColor,
            true,
          )
        } else if (entry.action.type === 'columnDelete') {
          const action = entry.action
          // Redo column delete: delete column again
          const boardStore = useBoardStore.getState()
          const cols = boardStore.getColumns(entry.projectId)
          const delCol = cols.find((c) => c.id === action.column.id)
          const movedTickets = delCol?.tickets || []
          boardStore.setColumns(
            entry.projectId,
            cols
              .filter((c) => c.id !== action.column.id)
              .map((c) => {
                if (c.id === action.movedToColumnId && movedTickets.length > 0) {
                  return {
                    ...c,
                    tickets: [
                      ...c.tickets,
                      ...movedTickets.map((t) => ({ ...t, columnId: action.movedToColumnId })),
                    ],
                  }
                }
                return c
              }),
          )

          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                const deleteUrl = new URL(
                  withBasePath(`/api/projects/${entry.projectId}/columns/${action.column.id}`),
                  window.location.origin,
                )
                if (action.column.tickets.length > 0) {
                  deleteUrl.searchParams.set('moveTicketsTo', action.movedToColumnId)
                }
                await fetch(deleteUrl.toString(), {
                  method: 'DELETE',
                  headers: { ...(tabId && { 'X-Tab-Id': tabId }) },
                })
                queryClient.invalidateQueries({ queryKey: columnKeys.byProject(entry.projectId) })
                queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(entry.projectId) })
              }
            } catch (err) {
              console.error('Failed to redo column delete:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('error', {
            title: 'Column deleted',
            description: `"${action.column.name}" deleted`,
            duration: getEffectiveDuration(5000),
          })
          redoStore.pushColumnDelete(entry.projectId, action.column, action.movedToColumnId, true)
        } else if (entry.action.type === 'attachmentAdd') {
          const action = entry.action
          // Redo attachment add: re-add the attachments
          // Set processing to block subsequent Ctrl+Z/Y during async operation
          redoStore.setProcessing(true)

          const fileNames =
            action.attachments.length === 1
              ? `"${action.attachments[0].attachment.originalName}"`
              : `${action.attachments.length} files`
          const attTicketKey = action.attachments[0]?.ticketKey ?? ''

          if (lastAttachmentToastRef.current) rawToast.dismiss(lastAttachmentToastRef.current)
          const redoAttAddToastId = showUndoRedoToast('success', {
            title:
              action.attachments.length === 1
                ? 'Attachment re-added'
                : `${action.attachments.length} attachments re-added`,
            description: `${fileNames} to ${attTicketKey}`,
            duration: 3000,
          })
          lastAttachmentToastRef.current = redoAttAddToastId

          // Re-add the attachments and update IDs
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                for (const att of action.attachments) {
                  const res = await fetch(
                    `/api/projects/${att.projectId}/tickets/${att.ticketId}/attachments`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(tabId && { 'X-Tab-Id': tabId }),
                      },
                      body: JSON.stringify({
                        attachments: [
                          {
                            filename: att.attachment.filename,
                            originalName: att.attachment.originalName,
                            mimeType: att.attachment.mimetype,
                            size: att.attachment.size,
                            url: att.attachment.url,
                          },
                        ],
                      }),
                    },
                  )
                  if (res.ok) {
                    await res.json()
                  }
                  queryClient.invalidateQueries({
                    queryKey: attachmentKeys.forTicket(att.projectId, att.ticketId),
                  })
                }
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to redo attachment add:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          redoStore.pushAttachmentAdd(entry.projectId, action.attachments, true)
        } else if (entry.action.type === 'attachmentDelete') {
          const action = entry.action
          // Redo attachment delete: re-delete the attachments
          // Set processing to block subsequent Ctrl+Z/Y during async operation
          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                for (const att of action.attachments) {
                  await fetch(
                    `/api/projects/${att.projectId}/tickets/${att.ticketId}/attachments/${att.attachment.id}`,
                    {
                      method: 'DELETE',
                      headers: { ...(tabId && { 'X-Tab-Id': tabId }) },
                    },
                  )
                  queryClient.invalidateQueries({
                    queryKey: attachmentKeys.forTicket(att.projectId, att.ticketId),
                  })
                }
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to redo attachment delete:', err)
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          const fileNames =
            action.attachments.length === 1
              ? `"${action.attachments[0].attachment.originalName}"`
              : `${action.attachments.length} files`
          const attTicketKey = action.attachments[0]?.ticketKey ?? ''

          if (lastAttachmentToastRef.current) rawToast.dismiss(lastAttachmentToastRef.current)
          const redoAttDelToastId = showUndoRedoToast('error', {
            title:
              action.attachments.length === 1
                ? 'Attachment deleted'
                : `${action.attachments.length} attachments deleted`,
            description: `${fileNames} from ${attTicketKey}`,
            duration: 3000,
          })
          lastAttachmentToastRef.current = redoAttDelToastId

          redoStore.pushAttachmentDelete(entry.projectId, action.attachments, true)
        } else if (entry.action.type === 'backlogReorder') {
          const action = entry.action
          const { setBacklogOrder } = useBacklogStore.getState()
          setBacklogOrder(entry.projectId, action.afterOrder)
          redoStore.pushBacklogReorder(entry.projectId, action.beforeOrder, action.afterOrder, true)

          showUndoRedoToast('success', {
            title: 'Reorder redone',
            description: 'Backlog order restored',
            duration: 3000,
          })
        } else if (entry.action.type === 'linkCreate') {
          // Redo link create: re-create the link
          const action = entry.action
          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (isDemoMode()) {
                redoStore.pushLinkCreate(entry.projectId, action.link, true)
              } else {
                const tabId = getTabId()
                const res = await apiFetch(
                  `/api/projects/${action.link.projectId}/tickets/${action.link.ticketId}/links`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                    body: JSON.stringify({
                      linkType: action.link.linkType,
                      targetTicketId: action.link.targetTicketId,
                    }),
                  },
                )
                if (!res.ok) throw new Error('Failed to re-create link')
                const newLink = await res.json()
                // Push with updated link ID
                redoStore.pushLinkCreate(
                  entry.projectId,
                  { ...action.link, linkId: newLink.id },
                  true,
                )
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(action.link.projectId, action.link.ticketId),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.link.projectId,
                    action.link.targetTicketId,
                  ),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to redo link create:', err)
              showToast.error('Failed to redo link creation')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: 'Link re-created',
            description: `${action.link.ticketKey} ${LINK_TYPE_LABELS[action.link.linkType].toLowerCase()} ${action.link.targetTicketKey}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'bulkLinkCreate') {
          // Redo bulk link create: re-create all links
          const action = entry.action
          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (isDemoMode()) {
                redoStore.pushBulkLinkCreate(entry.projectId, action.links, true)
              } else {
                const tabId = getTabId()
                const headers: HeadersInit = {
                  'Content-Type': 'application/json',
                  ...(tabId && { 'X-Tab-Id': tabId }),
                }
                const results = await Promise.allSettled(
                  action.links.map(async (link) => {
                    const res = await apiFetch(
                      `/api/projects/${link.projectId}/tickets/${link.ticketId}/links`,
                      {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                          linkType: link.linkType,
                          targetTicketId: link.targetTicketId,
                        }),
                      },
                    )
                    if (!res.ok) throw new Error('Failed to re-create link')
                    const newLink = await res.json()
                    return { ...link, linkId: newLink.id }
                  }),
                )
                const updatedLinks = results
                  .filter((r): r is PromiseFulfilledResult<LinkAction> => r.status === 'fulfilled')
                  .map((r) => r.value)
                if (updatedLinks.length > 0) {
                  redoStore.pushBulkLinkCreate(entry.projectId, updatedLinks, true)
                }
                // Invalidate source ticket
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.links[0].projectId,
                    action.links[0].ticketId,
                  ),
                })
                for (const link of action.links) {
                  queryClient.invalidateQueries({
                    queryKey: ticketLinkKeys.byTicket(link.projectId, link.targetTicketId),
                  })
                }
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to redo bulk link create:', err)
              showToast.error('Failed to redo link creation')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          showUndoRedoToast('success', {
            title: `${action.links.length} link${action.links.length === 1 ? '' : 's'} re-created`,
            description: `Linked to ${action.links[0].ticketKey}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'linkDelete') {
          // Redo link delete: re-delete the link
          const action = entry.action
          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                const res = await apiFetch(
                  `/api/projects/${action.link.projectId}/tickets/${action.link.ticketId}/links/${action.link.linkId}`,
                  {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                  },
                )
                if (!res.ok) throw new Error('Failed to re-delete link')
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(action.link.projectId, action.link.ticketId),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.link.projectId,
                    action.link.targetTicketId,
                  ),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to redo link delete:', err)
              showToast.error('Failed to redo link deletion')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          redoStore.pushLinkDelete(entry.projectId, action.link, true)

          showUndoRedoToast('error', {
            title: 'Link removed',
            description: `${action.link.ticketKey} ${LINK_TYPE_LABELS[action.link.linkType].toLowerCase()} ${action.link.targetTicketKey}`,
            duration: 3000,
          })
        } else if (entry.action.type === 'linkUpdate') {
          // Redo link update: re-apply the new link type
          const action = entry.action
          redoStore.setProcessing(true)
          ;(async () => {
            try {
              if (!isDemoMode()) {
                const tabId = getTabId()
                const res = await apiFetch(
                  `/api/projects/${action.link.projectId}/tickets/${action.link.ticketId}/links/${action.link.linkId}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tabId && { 'X-Tab-Id': tabId }),
                    },
                    body: JSON.stringify({ linkType: action.newLinkType }),
                  },
                )
                if (!res.ok) throw new Error('Failed to re-apply link type')
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(action.link.projectId, action.link.ticketId),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketLinkKeys.byTicket(
                    action.link.projectId,
                    action.link.targetTicketId,
                  ),
                })
                queryClient.invalidateQueries({
                  queryKey: ticketKeys.byProject(entry.projectId),
                })
              }
            } catch (err) {
              console.error('Failed to redo link update:', err)
              showToast.error('Failed to redo link type change')
            } finally {
              useUndoStore.getState().setProcessing(false)
            }
          })()

          redoStore.pushLinkUpdate(
            entry.projectId,
            action.link,
            action.oldLinkType,
            action.newLinkType,
            true,
          )

          showUndoRedoToast('success', {
            title: 'Link type changed',
            description: `${action.link.ticketKey}: ${LINK_TYPE_LABELS[action.newLinkType]}`,
            duration: 3000,
          })
        }

        // Release processing lock for types that don't have their own async lock management
        // (ticketCreate, columnRename, columnDelete, attachment*, link* handlers manage their own lock)
        const selfManagedTypes = [
          'ticketCreate',
          'columnCreate',
          'columnRename',
          'columnDelete',
          'attachmentAdd',
          'attachmentDelete',
          'linkCreate',
          'bulkLinkCreate',
          'linkDelete',
          'linkUpdate',
        ]
        if (!selfManagedTypes.includes(entry.action.type)) {
          redoStore.setProcessing(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Note: Don't copy tickets if drawer is open
  }, [
    selectedTicketIds,
    openSinglePastedTicket,
    showDeleteConfirm,
    columns,
    handleDeleteSelected,
    activeTicketId,
    projectId,
    queryClient,
  ])

  return (
    <>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${ticketsToDelete.length === 1 ? 'ticket' : `${ticketsToDelete.length} tickets`}?`}
        description={
          ticketsToDelete.length === 1 ? (
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-zinc-300">{ticketsToDelete[0]?.title}</span>?
            </>
          ) : (
            <>
              Are you sure you want to delete these {ticketsToDelete.length} tickets? This action
              can be undone with Ctrl+Z.
            </>
          )
        }
        confirmLabel="Delete"
        actionVariant="destructive"
        onConfirm={confirmDelete}
      />

      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Keyboard Shortcuts</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Press{' '}
              <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                ?
              </kbd>{' '}
              to toggle this dialog
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-6">
            {/* Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Navigation</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex-1">Search tickets</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">K</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Switch between view tabs</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Shift
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="p-1 bg-zinc-800 border border-zinc-700 rounded inline-flex items-center justify-center">
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Left</span>
                    </kbd>
                    <span className="text-zinc-400">/</span>
                    <kbd className="p-1 bg-zinc-800 border border-zinc-700 rounded inline-flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Right</span>
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Selection */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Selection</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex-1">Select multiple tickets</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Click
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Select range</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Shift
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Click
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Clear selection</span>
                  <kbd className="shrink-0 px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Actions</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex-1">Copy selected tickets</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">C</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Paste copied tickets</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">V</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Open Claude Chat</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">I</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Delete selected tickets</span>
                  <kbd className="shrink-0 px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Delete
                  </kbd>
                </div>
              </div>
            </div>

            {/* Move Tickets */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Move Tickets</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex-1">Reorder selected tickets up/down</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="p-1 bg-zinc-800 border border-zinc-700 rounded inline-flex items-center justify-center">
                      <ArrowUp className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Up</span>
                    </kbd>
                    <span className="text-zinc-400">/</span>
                    <kbd className="p-1 bg-zinc-800 border border-zinc-700 rounded inline-flex items-center justify-center">
                      <ArrowDown className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Down</span>
                    </kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Move selected tickets between columns</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="p-1 bg-zinc-800 border border-zinc-700 rounded inline-flex items-center justify-center">
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Left</span>
                    </kbd>
                    <span className="text-zinc-400">/</span>
                    <kbd className="p-1 bg-zinc-800 border border-zinc-700 rounded inline-flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Right</span>
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Save / Undo / Redo */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Save / Undo / Redo</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex-1">Save changes (in forms/drawers)</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">S</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Undo last action</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">Z</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Redo</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">Y</kbd>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex-1">Redo (alternative)</span>
                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Ctrl / Cmd
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">
                      Shift
                    </kbd>
                    <span className="text-sm text-zinc-400">+</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded">Z</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Help */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Help</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex-1">Show keyboard shortcuts</span>
                  <kbd className="shrink-0 px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    ?
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
