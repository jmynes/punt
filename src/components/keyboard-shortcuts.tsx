'use client'

import { Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  batchCreateTicketsAPI,
  batchDeleteTicketsAPI,
  createTicketAPI,
  deleteTicketAPI,
  updateTicketAPI,
} from '@/hooks/queries/use-tickets'
import { pasteTickets } from '@/lib/actions'
import { deleteTickets } from '@/lib/actions/delete-tickets'
import { formatTicketId, formatTicketIds } from '@/lib/ticket-format'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'

export function KeyboardShortcuts() {
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
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  // Focus delete button when dialog opens
  useEffect(() => {
    if (showDeleteConfirm) {
      setTimeout(() => {
        deleteButtonRef.current?.focus()
      }, 0)
    }
  }, [showDeleteConfirm])

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
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
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
      if (e.key === 'Escape') {
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

        // Get all selected ticket IDs
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
              selectedTicketsWithColumns.push({
                ticket,
                columnId: column.id,
                currentIndex: i,
              })
            }
          }
        }

        if (selectedTicketsWithColumns.length === 0) return

        // Store original column state for undo
        const boardStore = useBoardStore.getState()
        const originalColumns = boardStore.getColumns(projectId).map((col) => ({
          ...col,
          tickets: col.tickets.map((t) => ({ ...t })),
        }))

        // Group tickets by column
        const ticketsByColumn = new Map<string, typeof selectedTicketsWithColumns>()
        for (const item of selectedTicketsWithColumns) {
          const existing = ticketsByColumn.get(item.columnId) || []
          existing.push(item)
          ticketsByColumn.set(item.columnId, existing)
        }

        // Track if any reorder actually happened
        let reorderHappened = false
        const reorderedTicketIds: string[] = []

        // Move tickets in each column
        for (const [columnId, columnTickets] of ticketsByColumn.entries()) {
          const column = columns.find((c) => c.id === columnId)
          if (!column) continue

          // Sort tickets by their current index to preserve relative order
          columnTickets.sort((a, b) => a.currentIndex - b.currentIndex)

          const ticketIds = columnTickets.map((item) => item.ticket.id)
          const firstTicketIndex = columnTickets[0].currentIndex
          const lastTicketIndex = columnTickets[columnTickets.length - 1].currentIndex

          const { reorderTicket, reorderTickets } = boardStore

          if (e.key === 'ArrowUp') {
            // Move up: move to position before the first selected ticket
            if (firstTicketIndex === 0) {
              // Already at top, can't move up
              continue
            }

            reorderHappened = true
            reorderedTicketIds.push(...ticketIds)

            if (ticketIds.length === 1) {
              // Single ticket: move up by 1 position
              reorderTicket(projectId, columnId, ticketIds[0], firstTicketIndex - 1)
            } else {
              // Multiple tickets: move the group up by 1 position
              reorderTickets(projectId, columnId, ticketIds, firstTicketIndex - 1)
            }
          } else if (e.key === 'ArrowDown') {
            // Move down: move to position after the last selected ticket
            if (lastTicketIndex >= column.tickets.length - 1) {
              // Already at bottom, can't move down
              continue
            }

            reorderHappened = true
            reorderedTicketIds.push(...ticketIds)

            if (ticketIds.length === 1) {
              // Single ticket: move down by 1 position
              reorderTicket(projectId, columnId, ticketIds[0], lastTicketIndex + 1)
            } else {
              // Multiple tickets: move the group down by 1 position
              reorderTickets(projectId, columnId, ticketIds, lastTicketIndex + 2)
            }
          }
        }

        // If reorder happened, register undo
        if (reorderHappened) {
          const afterColumns = useBoardStore
            .getState()
            .getColumns(projectId)
            .map((col) => ({
              ...col,
              tickets: col.tickets.map((t) => ({ ...t })),
            }))

          // Look up ticket keys for toast
          const allTickets = afterColumns.flatMap((col) => col.tickets)
          const ticketKeys = reorderedTicketIds
            .map((id) => {
              const ticket = allTickets.find((t) => t.id === id)
              return ticket ? formatTicketId(ticket) : id
            })
            .filter(Boolean)

          const direction = e.key === 'ArrowUp' ? 'up' : 'down'

          let currentId: string | number | undefined

          const toastId = showUndoRedoToast('success', {
            title:
              reorderedTicketIds.length === 1
                ? 'Ticket reordered'
                : `${reorderedTicketIds.length} tickets reordered`,
            description:
              reorderedTicketIds.length === 1
                ? `${ticketKeys[0]} moved ${direction}`
                : `${ticketKeys.join(', ')} moved ${direction}`,
            duration: 5000,
            showUndoButtons: useSettingsStore.getState().showUndoButtons,
            onUndo: async (id) => {
              const undoEntry = useUndoStore.getState().undoByToastId(id)
              if (undoEntry) {
                // Restore original state
                const board = useBoardStore.getState()
                board.setColumns(undoEntry.projectId, originalColumns)

                // Persist to database
                try {
                  // For reordering, we need to update the order field of affected tickets
                  // Since we're restoring full column state, just update all ticket orders
                  for (const col of originalColumns) {
                    for (let i = 0; i < col.tickets.length; i++) {
                      const ticket = col.tickets[i]
                      if (reorderedTicketIds.includes(ticket.id)) {
                        await updateTicketAPI(undoEntry.projectId, ticket.id, { order: i })
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to persist reorder undo:', err)
                }
              }
            },
            onUndoneToast: (newId) => {
              if (currentId) {
                useUndoStore.getState().updateRedoToastId(currentId, newId)
                currentId = newId
              }
            },
            onRedo: async (id) => {
              const undoEntry = useUndoStore.getState().redoByToastId(id)
              if (undoEntry) {
                // Restore after state
                const board = useBoardStore.getState()
                board.setColumns(undoEntry.projectId, afterColumns)

                // Persist to database
                try {
                  for (const col of afterColumns) {
                    for (let i = 0; i < col.tickets.length; i++) {
                      const ticket = col.tickets[i]
                      if (reorderedTicketIds.includes(ticket.id)) {
                        await updateTicketAPI(undoEntry.projectId, ticket.id, { order: i })
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to persist reorder redo:', err)
                }
              }
            },
            onRedoneToast: (newId) => {
              if (currentId) {
                useUndoStore.getState().updateUndoToastId(currentId, newId)
                currentId = newId
              }
            },
            undoneTitle: 'Reorder undone',
            redoneTitle:
              reorderedTicketIds.length === 1
                ? 'Ticket reordered'
                : `${reorderedTicketIds.length} tickets reordered`,
            redoneDescription:
              reorderedTicketIds.length === 1
                ? `${ticketKeys[0]} moved ${direction}`
                : `${ticketKeys.join(', ')} moved ${direction}`,
          })

          currentId = toastId

          // Push to undo stack using move action (reorder is conceptually a move within same column)
          // We use fake "moves" since it's actually a reorder, but the column state restoration works
          const fakeMoves = reorderedTicketIds.map((ticketId) => ({
            ticketId,
            fromColumnId: selectedTicketsWithColumns[0].columnId,
            toColumnId: selectedTicketsWithColumns[0].columnId,
          }))

          useUndoStore
            .getState()
            .pushMove(
              projectId,
              fakeMoves,
              'same position',
              'same position',
              toastId,
              originalColumns,
              afterColumns,
            )
        }

        return
      }

      // Arrow keys: move selected tickets left/right between columns
      if (selectedTicketIds.size > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()

        // Get all selected ticket IDs
        const selectionStore = useSelectionStore.getState()
        const selectedIds = selectionStore.getSelectedIds()
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
              // Track origin if not already tracked
              const origin = selectionStore.getTicketOrigin(ticket.id)
              if (!origin) {
                selectionStore.setTicketOrigin(ticket.id, { columnId: column.id, position: i })
              }

              selectedTicketsWithColumns.push({
                ticket,
                columnId: column.id,
                currentIndex: i,
              })
            }
          }
        }

        if (selectedTicketsWithColumns.length === 0) return

        // Store original column state for undo
        const boardStore = useBoardStore.getState()
        const originalColumns = boardStore.getColumns(projectId).map((col) => ({
          ...col,
          tickets: col.tickets.map((t) => ({ ...t })),
        }))

        // Group tickets by column
        const ticketsByColumn = new Map<string, typeof selectedTicketsWithColumns>()
        for (const item of selectedTicketsWithColumns) {
          const existing = ticketsByColumn.get(item.columnId) || []
          existing.push(item)
          ticketsByColumn.set(item.columnId, existing)
        }

        const moves: Array<{ ticketId: string; fromColumnId: string; toColumnId: string }> = []

        // Move tickets in each column
        for (const [columnId, columnTickets] of ticketsByColumn.entries()) {
          const column = columns.find((c) => c.id === columnId)
          if (!column) continue

          // Sort tickets by their current index to preserve relative order
          columnTickets.sort((a, b) => a.currentIndex - b.currentIndex)

          const ticketIds = columnTickets.map((item) => item.ticket.id)
          const sortedColumns = [...columns].sort((a, b) => a.order - b.order)
          const currentColumnIndex = sortedColumns.findIndex((c) => c.id === columnId)

          if (e.key === 'ArrowLeft') {
            // Move left: move to the previous column
            if (currentColumnIndex === 0) {
              // Already at leftmost column, can't move left
              continue
            }

            const targetColumn = sortedColumns[currentColumnIndex - 1]

            // Check if all tickets have this as their origin column
            const allHaveOriginInTarget = ticketIds.every((id) => {
              const origin = selectionStore.getTicketOrigin(id)
              return origin?.columnId === targetColumn.id
            })

            let targetPosition: number
            if (allHaveOriginInTarget && ticketIds.length > 0) {
              // All tickets originated from target column - restore to the first ticket's original position
              // (they'll be placed together as a group at that position)
              const firstTicketOrigin = selectionStore.getTicketOrigin(ticketIds[0])
              targetPosition = firstTicketOrigin?.position ?? targetColumn.tickets.length
            } else {
              // Default to bottom when moving left (unless all tickets are returning to origin)
              targetPosition = targetColumn.tickets.length
            }

            const { moveTicket, moveTickets } = boardStore

            if (ticketIds.length === 1) {
              moveTicket(projectId, ticketIds[0], columnId, targetColumn.id, targetPosition)
              moves.push({
                ticketId: ticketIds[0],
                fromColumnId: columnId,
                toColumnId: targetColumn.id,
              })
            } else {
              moveTickets(projectId, ticketIds, targetColumn.id, targetPosition)
              for (const ticketId of ticketIds) {
                moves.push({ ticketId, fromColumnId: columnId, toColumnId: targetColumn.id })
              }
            }
          } else if (e.key === 'ArrowRight') {
            // Move right: move to the next column
            if (currentColumnIndex >= sortedColumns.length - 1) {
              // Already at rightmost column, can't move right
              continue
            }

            const targetColumn = sortedColumns[currentColumnIndex + 1]

            // Check if all tickets have this as their origin column
            const allHaveOriginInTarget = ticketIds.every((id) => {
              const origin = selectionStore.getTicketOrigin(id)
              return origin?.columnId === targetColumn.id
            })

            let targetPosition: number
            if (allHaveOriginInTarget && ticketIds.length > 0) {
              // All tickets originated from target column - restore to the first ticket's original position
              // (they'll be placed together as a group at that position)
              const firstTicketOrigin = selectionStore.getTicketOrigin(ticketIds[0])
              targetPosition = firstTicketOrigin?.position ?? targetColumn.tickets.length
            } else {
              // Default to bottom when moving right (unless all tickets are returning to origin)
              targetPosition = targetColumn.tickets.length
            }

            const { moveTicket, moveTickets } = boardStore

            if (ticketIds.length === 1) {
              moveTicket(projectId, ticketIds[0], columnId, targetColumn.id, targetPosition)
              moves.push({
                ticketId: ticketIds[0],
                fromColumnId: columnId,
                toColumnId: targetColumn.id,
              })
            } else {
              moveTickets(projectId, ticketIds, targetColumn.id, targetPosition)
              for (const ticketId of ticketIds) {
                moves.push({ ticketId, fromColumnId: columnId, toColumnId: targetColumn.id })
              }
            }
          }
        }

        // If there were moves, create undo entry and persist to database
        if (moves.length > 0) {
          const fromColumn = columns.find((c) => c.id === moves[0].fromColumnId)
          const toColumn = columns.find((c) => c.id === moves[0].toColumnId)
          const fromName = fromColumn?.name || 'Unknown'
          const toName = toColumn?.name || 'Unknown'

          // Get current state after move for undo
          const afterColumns = boardStore.getColumns(projectId).map((col) => ({
            ...col,
            tickets: col.tickets.map((t) => ({ ...t })),
          }))

          // Look up ticket IDs from columns for toast
          const allTickets = afterColumns.flatMap((col) => col.tickets)
          const ticketKeys = moves
            .map((move) => {
              const ticket = allTickets.find((t) => t.id === move.ticketId)
              return ticket ? formatTicketId(ticket) : move.ticketId
            })
            .filter(Boolean)

          // Persist to database
          ;(async () => {
            try {
              for (const move of moves) {
                // Find the ticket's new position in the target column
                const targetCol = afterColumns.find((c) => c.id === move.toColumnId)
                const newOrder = targetCol?.tickets.findIndex((t) => t.id === move.ticketId) ?? 0
                await updateTicketAPI(projectId, move.ticketId, {
                  columnId: move.toColumnId,
                  order: newOrder,
                })
              }
            } catch (err) {
              console.error('Failed to persist arrow key move:', err)
              // Rollback on error
              boardStore.setColumns(projectId, originalColumns)
              toast.error('Failed to move ticket(s)')
            }
          })()

          let currentId: string | number | undefined

          const toastId = showUndoRedoToast('success', {
            title: moves.length === 1 ? 'Ticket moved' : `${moves.length} tickets moved`,
            description:
              moves.length === 1
                ? `${ticketKeys[0]} moved to ${toName}`
                : `${ticketKeys.join(', ')} moved to ${toName}`,
            duration: 5000,
            showUndoButtons: useSettingsStore.getState().showUndoButtons,
            onUndo: async (id) => {
              const undoEntry = useUndoStore.getState().undoByToastId(id)
              if (undoEntry) {
                // Restore state
                const board = useBoardStore.getState()
                board.setColumns(undoEntry.projectId, originalColumns)

                // Persist undo to database
                try {
                  for (const move of moves) {
                    const sourceCol = originalColumns.find((c) => c.id === move.fromColumnId)
                    const originalOrder =
                      sourceCol?.tickets.findIndex((t) => t.id === move.ticketId) ?? 0
                    await updateTicketAPI(undoEntry.projectId, move.ticketId, {
                      columnId: move.fromColumnId,
                      order: originalOrder,
                    })
                  }
                } catch (err) {
                  console.error('Failed to persist move undo:', err)
                }
              }
            },
            onUndoneToast: (newId) => {
              if (currentId) {
                useUndoStore.getState().updateRedoToastId(currentId, newId)
                currentId = newId
              }
            },
            onRedo: async (id) => {
              const undoEntry = useUndoStore.getState().redoByToastId(id)
              if (undoEntry) {
                // Redo state
                const board = useBoardStore.getState()
                board.setColumns(undoEntry.projectId, afterColumns)

                // Persist redo to database
                try {
                  for (const move of moves) {
                    const targetCol = afterColumns.find((c) => c.id === move.toColumnId)
                    const newOrder =
                      targetCol?.tickets.findIndex((t) => t.id === move.ticketId) ?? 0
                    await updateTicketAPI(undoEntry.projectId, move.ticketId, {
                      columnId: move.toColumnId,
                      order: newOrder,
                    })
                  }
                } catch (err) {
                  console.error('Failed to persist move redo:', err)
                }
              }
            },
            onRedoneToast: (newId) => {
              if (currentId) {
                useUndoStore.getState().updateUndoToastId(currentId, newId)
                currentId = newId
              }
            },
            undoneTitle: 'Move undone',
            redoneTitle: moves.length === 1 ? 'Ticket moved' : `${moves.length} tickets moved`,
            redoneDescription:
              moves.length === 1
                ? `${ticketKeys[0]} moved to ${toName}`
                : `${ticketKeys.join(', ')} moved to ${toName}`,
          })

          currentId = toastId

          // Push to undo stack
          useUndoStore
            .getState()
            .pushMove(projectId, moves, fromName, toName, toastId, originalColumns, afterColumns)
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
        toast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, {
          description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
          duration: 2000,
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

      // Check for Ctrl/Cmd + Z (Undo) - must check before redo to avoid conflicts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        const undoStore = useUndoStore.getState()
        if (undoStore.isProcessing) return // Block while API call is in flight
        const entry = undoStore.popUndo()
        if (entry) {
          toast.dismiss(entry.toastId)

          const showUndo = useSettingsStore.getState().showUndoButtons

          if (entry.action.type === 'delete') {
            const action = entry.action
            // Restore all deleted tickets optimistically
            const { addTicket } = useBoardStore.getState()
            for (const { ticket, columnId } of action.tickets) {
              addTicket(entry.projectId, columnId, ticket)
            }
            useUIStore.getState().setActiveTicketId(null)
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
                // Replace temp tickets with server tickets
                const boardState = useBoardStore.getState()
                for (const { ticket: tempTicket, columnId } of action.tickets) {
                  const serverTicket = serverTickets.get(tempTicket.id)
                  if (serverTicket) {
                    boardState.removeTicket(entry.projectId, tempTicket.id)
                    boardState.addTicket(entry.projectId, columnId, serverTicket)
                  }
                }
              } catch (err) {
                console.error('Failed to restore tickets:', err)
                toast.error('Failed to restore tickets')
              }
            })()

            const ticketKeys = action.tickets.map(({ ticket }) => formatTicketId(ticket))

            let currentId = entry.toastId

            const toastId = showUndoRedoToast('success', {
              title:
                action.tickets.length === 1
                  ? 'Ticket restored'
                  : `${action.tickets.length} tickets restored`,
              description: action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              // In this "undo toast", the primary action should re-delete (redo)
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: async (id) => {
                // Redo (delete)
                const undoEntry = useUndoStore.getState().redoByToastId(id)
                if (undoEntry) {
                  const boardState = useBoardStore.getState()
                  const ticketIdsToDelete: string[] = []
                  for (const { ticket } of action.tickets) {
                    // Find ticket (may have been replaced with server ticket)
                    const cols = boardState.getColumns(undoEntry.projectId)
                    const foundTicket = cols
                      .flatMap((c) => c.tickets)
                      .find((t) => t.id === ticket.id || t.title === ticket.title)
                    if (foundTicket) {
                      boardState.removeTicket(undoEntry.projectId, foundTicket.id)
                      ticketIdsToDelete.push(foundTicket.id)
                    }
                  }
                  // Delete from database
                  if (ticketIdsToDelete.length > 0) {
                    batchDeleteTicketsAPI(undoEntry.projectId, ticketIdsToDelete).catch((err) => {
                      console.error('Failed to delete tickets on redo:', err)
                    })
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                // Undo (restore)
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  const boardState = useBoardStore.getState()
                  for (const { ticket, columnId } of action.tickets) {
                    boardState.addTicket(undoEntry.projectId, columnId, ticket)
                  }
                  // Recreate in database
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
                    const serverTickets = await batchCreateTicketsAPI(
                      undoEntry.projectId,
                      ticketsToCreate,
                    )
                    for (const { ticket: tempTicket, columnId } of action.tickets) {
                      const serverTicket = serverTickets.get(tempTicket.id)
                      if (serverTicket) {
                        boardState.removeTicket(undoEntry.projectId, tempTicket.id)
                        boardState.addTicket(undoEntry.projectId, columnId, serverTicket)
                      }
                    }
                  } catch (err) {
                    console.error('Failed to restore tickets:', err)
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle:
                action.tickets.length === 1
                  ? 'Delete redone'
                  : `${action.tickets.length} deletes redone`,
              redoneTitle:
                action.tickets.length === 1
                  ? 'Ticket restored'
                  : `${action.tickets.length} tickets restored`,
              redoneDescription:
                action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            })

            // Update the entry we just pushed to Redo with the new toast ID
            undoStore.updateRedoToastId(currentId, toastId)
            currentId = toastId
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

            let currentId = entry.toastId

            const toastId = showUndoRedoToast('success', {
              title:
                action.tickets.length === 1
                  ? 'Change undone'
                  : `${action.tickets.length} changes undone`,
              description: action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: async (id) => {
                const undoEntry = useUndoStore.getState().redoByToastId(id)
                if (undoEntry) {
                  for (const item of action.tickets) {
                    boardStore.updateTicket(undoEntry.projectId, item.ticketId, item.after)
                  }
                  // Persist to database
                  try {
                    for (const item of action.tickets) {
                      await updateTicketAPI(undoEntry.projectId, item.ticketId, item.after)
                    }
                  } catch (err) {
                    console.error('Failed to persist update redo:', err)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  for (const item of action.tickets) {
                    boardStore.updateTicket(undoEntry.projectId, item.ticketId, item.before)
                  }
                  // Persist to database
                  try {
                    for (const item of action.tickets) {
                      await updateTicketAPI(undoEntry.projectId, item.ticketId, item.before)
                    }
                  } catch (err) {
                    console.error('Failed to persist update undo:', err)
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle:
                action.tickets.length === 1
                  ? 'Change redone'
                  : `${action.tickets.length} changes redone`,
              redoneTitle:
                action.tickets.length === 1
                  ? 'Change undone'
                  : `${action.tickets.length} changes undone`,
              redoneDescription:
                action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            })

            undoStore.updateRedoToastId(currentId, toastId)
            currentId = toastId
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
                // Update each moved ticket's columnId back to original
                for (const move of action.moves) {
                  await updateTicketAPI(entry.projectId, move.ticketId, {
                    columnId: move.fromColumnId,
                  })
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

            const moveTitle =
              action.moves.length === 1 ? 'Ticket moved' : `${action.moves.length} tickets moved`
            const moveDesc =
              action.moves.length === 1
                ? `${moveTicketKeys[0]} moved to ${action.toColumnName}`
                : `${moveTicketKeys.join(', ')} moved to ${action.toColumnName}`

            let currentId = entry.toastId

            const toastId = showUndoRedoToast('success', {
              title:
                action.moves.length === 1 ? 'Move undone' : `${action.moves.length} moves undone`,
              description:
                action.moves.length === 1 ? moveTicketKeys[0] : moveTicketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: async (id) => {
                const undoEntry = useUndoStore.getState().redoByToastId(id)
                if (undoEntry) {
                  if (action.afterColumns) {
                    const restoredColumns = action.afterColumns.map((col) => ({
                      ...col,
                      tickets: col.tickets.map((t) => ({ ...t })),
                    }))
                    moveBoardStore.setColumns(undoEntry.projectId, restoredColumns)
                  } else {
                    for (const move of action.moves) {
                      moveBoardStore.moveTicket(
                        undoEntry.projectId,
                        move.ticketId,
                        move.fromColumnId,
                        move.toColumnId,
                        0,
                      )
                    }
                  }
                  // Persist to database
                  try {
                    for (const move of action.moves) {
                      await updateTicketAPI(undoEntry.projectId, move.ticketId, {
                        columnId: move.toColumnId,
                      })
                    }
                  } catch (err) {
                    console.error('Failed to persist move redo:', err)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  if (action.originalColumns) {
                    const restoredColumns = action.originalColumns.map((col) => ({
                      ...col,
                      tickets: col.tickets.map((t) => ({ ...t })),
                    }))
                    moveBoardStore.setColumns(undoEntry.projectId, restoredColumns)
                  }
                  // Persist to database
                  try {
                    for (const move of action.moves) {
                      await updateTicketAPI(undoEntry.projectId, move.ticketId, {
                        columnId: move.fromColumnId,
                      })
                    }
                  } catch (err) {
                    console.error('Failed to persist move undo:', err)
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle: moveTitle,
              undoneDescription: moveDesc,
              redoneTitle:
                action.moves.length === 1 ? 'Move undone' : `${action.moves.length} moves undone`,
              redoneDescription:
                action.moves.length === 1 ? moveTicketKeys[0] : moveTicketKeys.join(', '),
            })

            undoStore.updateRedoToastId(currentId, toastId)
            currentId = toastId
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

            // Ensure drawer is closed and selection cleared
            useUIStore.getState().setActiveTicketId(null)
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

            let currentId = entry.toastId

            const toastId = showUndoRedoToast('success', {
              title:
                action.tickets.length === 1
                  ? 'Paste undone'
                  : `${action.tickets.length} pastes undone`,
              description:
                action.tickets.length === 1 ? pasteTicketKeys[0] : pasteTicketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: async (id) => {
                // Redo paste: re-create the tickets
                const undoEntry = useUndoStore.getState().redoByToastId(id)
                if (undoEntry) {
                  const pasteBoard = useBoardStore.getState()
                  const pasteUndoStore = useUndoStore.getState()
                  const redoTickets: Array<{ ticket: TicketWithRelations; columnId: string }> = []

                  for (const { ticket, columnId } of action.tickets) {
                    const tempId = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                    const redoTicket = { ...ticket, id: tempId }
                    redoTickets.push({ ticket: redoTicket, columnId })
                    pasteBoard.addTicket(undoEntry.projectId, columnId, redoTicket)
                  }

                  // Persist to database
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
                    const serverTickets = await batchCreateTicketsAPI(
                      undoEntry.projectId,
                      ticketsToCreate,
                    )
                    for (const { ticket: tempTicket, columnId } of redoTickets) {
                      const serverTicket = serverTickets.get(tempTicket.id)
                      if (serverTicket) {
                        pasteBoard.removeTicket(undoEntry.projectId, tempTicket.id)
                        pasteBoard.addTicket(undoEntry.projectId, columnId, serverTicket)
                        pasteUndoStore.updatePastedTicketId(
                          undoEntry.projectId,
                          tempTicket.id,
                          serverTicket,
                        )
                      }
                    }
                  } catch (err) {
                    console.error('Failed to recreate pasted tickets:', err)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                // Undo paste again: delete the tickets
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  const pasteBoard = useBoardStore.getState()
                  const idsToDelete: string[] = []
                  for (const { ticket } of action.tickets) {
                    pasteBoard.removeTicket(undoEntry.projectId, ticket.id)
                    idsToDelete.push(ticket.id)
                  }
                  if (idsToDelete.length > 0) {
                    batchDeleteTicketsAPI(undoEntry.projectId, idsToDelete).catch((err) => {
                      console.error('Failed to delete pasted tickets:', err)
                    })
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle:
                action.tickets.length === 1
                  ? 'Paste redone'
                  : `${action.tickets.length} pastes redone`,
              redoneTitle:
                action.tickets.length === 1
                  ? 'Paste undone'
                  : `${action.tickets.length} pastes undone`,
              redoneDescription:
                action.tickets.length === 1 ? pasteTicketKeys[0] : pasteTicketKeys.join(', '),
            })

            undoStore.updateRedoToastId(currentId, toastId)
            currentId = toastId
          } else if (entry.action.type === 'ticketCreate') {
            const action = entry.action
            // Undo ticket creation = delete the ticket
            const { removeTicket, addTicket } = useBoardStore.getState()
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
            let currentId = entry.toastId

            const toastId = showUndoRedoToast('success', {
              title: 'Ticket creation undone',
              description: ticketKey,
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: async (id) => {
                // Redo (re-create) - await to prevent race conditions
                const store = useUndoStore.getState()
                if (store.isProcessing) return
                const undoEntry = store.redoByToastId(id)
                if (undoEntry) {
                  addTicket(undoEntry.projectId, action.columnId, action.ticket)
                  store.setProcessing(true)
                  try {
                    const serverTicket = await createTicketAPI(
                      undoEntry.projectId,
                      action.columnId,
                      action.ticket,
                    )
                    const bs = useBoardStore.getState()
                    bs.removeTicket(undoEntry.projectId, action.ticket.id)
                    bs.addTicket(undoEntry.projectId, action.columnId, serverTicket)
                    useUndoStore.getState().updateTicketCreateEntry(action.ticket.id, serverTicket)
                    action.ticket = serverTicket
                  } catch (err) {
                    console.error('Failed to recreate ticket on redo:', err)
                  } finally {
                    useUndoStore.getState().setProcessing(false)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                // Undo (delete again) - await to prevent race conditions
                const store = useUndoStore.getState()
                if (store.isProcessing) return
                const undoEntry = store.undoByToastId(id)
                if (undoEntry) {
                  removeTicket(undoEntry.projectId, action.ticket.id)
                  store.setProcessing(true)
                  deleteTicketAPI(undoEntry.projectId, action.ticket.id)
                    .catch((err) => {
                      console.error('Failed to delete ticket on undo:', err)
                    })
                    .finally(() => {
                      useUndoStore.getState().setProcessing(false)
                    })
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle: 'Ticket created',
              undoneDescription: ticketKey,
              redoneTitle: 'Ticket creation undone',
              redoneDescription: ticketKey,
            })

            undoStore.updateRedoToastId(currentId, toastId)
            currentId = toastId
          } else if (entry.action.type === 'sprintMove') {
            const action = entry.action
            // Undo sprint move = move tickets back to original sprint
            const boardStore = useBoardStore.getState()

            // Move tickets back to original sprint in store
            for (const move of action.moves) {
              boardStore.updateTicket(entry.projectId, move.ticketId, {
                sprintId: move.fromSprintId,
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

            let currentId = entry.toastId

            const toastId = showUndoRedoToast('success', {
              title:
                action.moves.length === 1
                  ? 'Sprint move undone'
                  : `${action.moves.length} sprint moves undone`,
              description: `Moved back to ${action.fromSprintName}`,
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: async (id) => {
                // Redo (move to target sprint again)
                const redoEntry = useUndoStore.getState().redoByToastId(id)
                if (redoEntry) {
                  const bs = useBoardStore.getState()
                  for (const move of action.moves) {
                    bs.updateTicket(redoEntry.projectId, move.ticketId, {
                      sprintId: move.toSprintId,
                    })
                  }
                  // Persist to database
                  try {
                    for (const move of action.moves) {
                      await updateTicketAPI(redoEntry.projectId, move.ticketId, {
                        sprintId: move.toSprintId,
                      })
                    }
                  } catch (err) {
                    console.error('Failed to persist sprint move redo:', err)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                // Undo again (move back to original sprint)
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  const bs = useBoardStore.getState()
                  for (const move of action.moves) {
                    bs.updateTicket(undoEntry.projectId, move.ticketId, {
                      sprintId: move.fromSprintId,
                    })
                  }
                  // Persist to database
                  try {
                    for (const move of action.moves) {
                      await updateTicketAPI(undoEntry.projectId, move.ticketId, {
                        sprintId: move.fromSprintId,
                      })
                    }
                  } catch (err) {
                    console.error('Failed to persist sprint move undo:', err)
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle:
                action.moves.length === 1 ? 'Ticket moved' : `${action.moves.length} tickets moved`,
              undoneDescription: `Moved to ${action.toSprintName}`,
              redoneTitle:
                action.moves.length === 1
                  ? 'Sprint move undone'
                  : `${action.moves.length} sprint moves undone`,
              redoneDescription: `Moved back to ${action.fromSprintName}`,
            })

            undoStore.updateRedoToastId(currentId, toastId)
            currentId = toastId
          }
          // Note: projectCreate and projectDelete undo/redo are not supported
          // since projects are now server-backed and require API calls
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
        if (redoStore.isProcessing) return // Block while API call is in flight
        const entry = redoStore.popRedo()
        if (entry) {
          const showUndo = useSettingsStore.getState().showUndoButtons

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

            let currentId: string | number | undefined

            const newToastId = showUndoRedoToast('error', {
              title:
                action.tickets.length === 1
                  ? 'Ticket deleted'
                  : `${action.tickets.length} tickets deleted`,
              description:
                action.tickets.length === 1 ? delTicketKeys[0] : delTicketKeys.join(', '),
              duration: 5000,
              showUndoButtons: showUndo,
              onUndo: async (id) => {
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  const boardState = useBoardStore.getState()
                  for (const { ticket, columnId } of action.tickets) {
                    boardState.addTicket(undoEntry.projectId, columnId, ticket)
                  }
                  // Recreate in database
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
                    const serverTickets = await batchCreateTicketsAPI(
                      undoEntry.projectId,
                      ticketsToCreate,
                    )
                    for (const { ticket: tempTicket, columnId } of action.tickets) {
                      const serverTicket = serverTickets.get(tempTicket.id)
                      if (serverTicket) {
                        boardState.removeTicket(undoEntry.projectId, tempTicket.id)
                        boardState.addTicket(undoEntry.projectId, columnId, serverTicket)
                      }
                    }
                  } catch (err) {
                    console.error('Failed to restore tickets:', err)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                const undoEntry = useUndoStore.getState().redoByToastId(id)
                if (undoEntry) {
                  const boardState = useBoardStore.getState()
                  const idsToDelete: string[] = []
                  for (const { ticket } of action.tickets) {
                    const cols = boardState.getColumns(undoEntry.projectId)
                    const foundTicket = cols
                      .flatMap((c) => c.tickets)
                      .find((t) => t.id === ticket.id || t.title === ticket.title)
                    if (foundTicket) {
                      boardState.removeTicket(undoEntry.projectId, foundTicket.id)
                      idsToDelete.push(foundTicket.id)
                    }
                  }
                  if (idsToDelete.length > 0) {
                    batchDeleteTicketsAPI(undoEntry.projectId, idsToDelete).catch((err) => {
                      console.error('Failed to delete tickets on redo:', err)
                    })
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle: 'Ticket restored',
              redoneTitle: 'Delete redone',
            })

            currentId = newToastId

            redoStore.pushDeletedBatch(entry.projectId, action.tickets, newToastId, true)
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

            let currentId: string | number | undefined

            const newToastId = showUndoRedoToast('success', {
              title:
                swappedTickets.length === 1
                  ? 'Change redone'
                  : `${swappedTickets.length} changes redone`,
              description: swappedTickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Undo', // Normal Undo
              onUndo: async (id) => {
                const undoEntry = useUndoStore.getState().undoByToastId(id)
                if (undoEntry) {
                  for (const item of swappedTickets) {
                    boardStore.updateTicket(undoEntry.projectId, item.ticketId, item.before)
                  }
                  // Persist to database
                  try {
                    for (const item of swappedTickets) {
                      await updateTicketAPI(undoEntry.projectId, item.ticketId, item.before)
                    }
                  } catch (err) {
                    console.error('Failed to persist update undo:', err)
                  }
                }
              },
              onUndoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateRedoToastId(currentId, newId)
                  currentId = newId
                }
              },
              onRedo: async (id) => {
                const undoEntry = useUndoStore.getState().redoByToastId(id)
                if (undoEntry) {
                  for (const item of swappedTickets) {
                    boardStore.updateTicket(undoEntry.projectId, item.ticketId, item.after)
                  }
                  // Persist to database
                  try {
                    for (const item of swappedTickets) {
                      await updateTicketAPI(undoEntry.projectId, item.ticketId, item.after)
                    }
                  } catch (err) {
                    console.error('Failed to persist update redo:', err)
                  }
                }
              },
              onRedoneToast: (newId) => {
                if (currentId) {
                  useUndoStore.getState().updateUndoToastId(currentId, newId)
                  currentId = newId
                }
              },
              undoneTitle:
                swappedTickets.length === 1
                  ? 'Change undone'
                  : `${swappedTickets.length} changes undone`,
              redoneTitle:
                swappedTickets.length === 1
                  ? 'Change redone'
                  : `${swappedTickets.length} changes redone`,
              redoneDescription:
                swappedTickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            })

            currentId = newToastId

            redoStore.pushUpdate(entry.projectId, swappedTickets, newToastId, true)
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
                  await updateTicketAPI(entry.projectId, move.ticketId, {
                    columnId: move.toColumnId,
                  })
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

            const newToastId = toast.success(
              action.moves.length === 1 ? 'Ticket moved' : `${action.moves.length} tickets moved`,
              {
                description:
                  action.moves.length === 1
                    ? `${ticketKeys[0]} moved to ${action.toColumnName}`
                    : `${ticketKeys.join(', ')} moved to ${action.toColumnName}`,
                duration: 5000,
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: async () => {
                        const bs = useBoardStore.getState()
                        bs.setColumns(entry.projectId, currentStateBeforeRedo)
                        redoStore.pushRedo(entry)
                        // Persist undo to database
                        try {
                          for (const move of action.moves) {
                            await updateTicketAPI(entry.projectId, move.ticketId, {
                              columnId: move.fromColumnId,
                            })
                          }
                        } catch (err) {
                          console.error('Failed to persist move undo:', err)
                        }
                        toast.success(
                          action.moves.length === 1
                            ? 'Move undone'
                            : `${action.moves.length} moves undone`,
                          { duration: 2000 },
                        )
                      },
                    }
                  : undefined,
              },
            )

            useUndoStore
              .getState()
              .pushMove(
                entry.projectId,
                action.moves,
                action.toColumnName,
                action.fromColumnName,
                newToastId,
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
                toast.error('Failed to redo paste')
              }
            })()

            const redoPasteTicketKeys = redoTickets.map(({ ticket }) => formatTicketId(ticket))
            const newPasteToastId = toast.success(
              redoTickets.length === 1 ? 'Ticket pasted' : `${redoTickets.length} tickets pasted`,
              {
                description:
                  redoTickets.length === 1
                    ? redoPasteTicketKeys[0]
                    : redoPasteTicketKeys.join(', '),
                duration: 5000,
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: async () => {
                        const boardState = useBoardStore.getState()
                        const idsToDelete: string[] = []
                        for (const { ticket } of redoTickets) {
                          // Find the ticket (may have been replaced with server ticket)
                          const cols = boardState.getColumns(entry.projectId)
                          const foundTicket = cols
                            .flatMap((c) => c.tickets)
                            .find((t) => t.id === ticket.id)
                          if (foundTicket) {
                            boardState.removeTicket(entry.projectId, foundTicket.id)
                            idsToDelete.push(foundTicket.id)
                          }
                        }
                        redoStore.pushRedo(entry)
                        if (idsToDelete.length > 0) {
                          batchDeleteTicketsAPI(entry.projectId, idsToDelete).catch((err) => {
                            console.error('Failed to delete tickets on undo:', err)
                          })
                        }
                        toast.success(
                          redoTickets.length === 1
                            ? 'Paste undone'
                            : `${redoTickets.length} pastes undone`,
                          { duration: 2000 },
                        )
                      },
                    }
                  : undefined,
              },
            )
            redoStore.pushPaste(entry.projectId, redoTickets, newPasteToastId, true)
          } else if (entry.action.type === 'ticketCreate') {
            const action = entry.action
            // Redo ticket creation = add the ticket back
            const { addTicket, removeTicket } = useBoardStore.getState()
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
            const newToastId = toast.success('Ticket created', {
              description: ticketKey,
              duration: 5000,
              action: showUndo
                ? {
                    label: 'Undo',
                    onClick: async () => {
                      const store = useUndoStore.getState()
                      if (store.isProcessing) return
                      removeTicket(entry.projectId, action.ticket.id)
                      store.pushRedo(entry)
                      // Delete from server
                      store.setProcessing(true)
                      deleteTicketAPI(entry.projectId, action.ticket.id)
                        .catch((err) => {
                          console.error('Failed to delete ticket on undo:', err)
                        })
                        .finally(() => {
                          useUndoStore.getState().setProcessing(false)
                        })
                      toast.success('Ticket creation undone', { duration: 2000 })
                    },
                  }
                : undefined,
            })

            redoStore.pushTicketCreate(
              entry.projectId,
              action.ticket,
              action.columnId,
              newToastId,
              true,
            )
          } else if (entry.action.type === 'sprintMove') {
            const action = entry.action
            // Redo sprint move = move tickets to target sprint again
            const boardStore = useBoardStore.getState()

            for (const move of action.moves) {
              boardStore.updateTicket(entry.projectId, move.ticketId, {
                sprintId: move.toSprintId,
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

            const newToastId = toast.success(
              action.moves.length === 1 ? 'Ticket moved' : `${action.moves.length} tickets moved`,
              {
                description: `Moved to ${action.toSprintName}`,
                duration: 5000,
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: async () => {
                        const bs = useBoardStore.getState()
                        for (const move of action.moves) {
                          bs.updateTicket(entry.projectId, move.ticketId, {
                            sprintId: move.fromSprintId,
                          })
                        }
                        redoStore.pushRedo(entry)
                        // Persist undo to database
                        try {
                          for (const move of action.moves) {
                            await updateTicketAPI(entry.projectId, move.ticketId, {
                              sprintId: move.fromSprintId,
                            })
                          }
                        } catch (err) {
                          console.error('Failed to persist sprint move undo:', err)
                        }
                        toast.success(
                          action.moves.length === 1
                            ? 'Sprint move undone'
                            : `${action.moves.length} sprint moves undone`,
                          { duration: 2000 },
                        )
                      },
                    }
                  : undefined,
              },
            )

            redoStore.pushSprintMove(
              entry.projectId,
              action.moves,
              action.fromSprintName,
              action.toSprintName,
              newToastId,
              true,
            )
          }
          // Note: projectCreate and projectDelete redo are not supported
          // since projects are now server-backed and require API calls
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
  ])

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Delete {ticketsToDelete.length === 1 ? 'ticket' : `${ticketsToDelete.length} tickets`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {ticketsToDelete.length === 1 ? (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-zinc-300">{ticketsToDelete[0]?.title}</span>?
                </>
              ) : (
                <>
                  Are you sure you want to delete these {ticketsToDelete.length} tickets? This
                  action can be undone with Ctrl+Z.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              ref={deleteButtonRef}
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            {/* Selection */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Selection</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Select multiple tickets</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Ctrl / Cmd + Click
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Select range</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Shift + Click
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Clear selection</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Actions</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Copy selected tickets</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Ctrl / Cmd + C
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Paste copied tickets</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Ctrl / Cmd + V
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delete selected tickets</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Delete
                  </kbd>
                </div>
              </div>
            </div>

            {/* Undo/Redo */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Undo / Redo</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Undo last action</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Ctrl / Cmd + Z
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Redo</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Ctrl / Cmd + Y
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Redo (alternative)</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
                    Ctrl / Cmd + Shift + Z
                  </kbd>
                </div>
              </div>
            </div>

            {/* Help */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-2">Help</h3>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Show keyboard shortcuts</span>
                  <kbd className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded">
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
