'use client'

import { Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'

// Project ID to key mapping
const projectKeys: Record<string, string> = {
  '1': 'PUNT',
  '2': 'API',
  '3': 'MOB',
  'project-1': 'PUNT',
  'project-2': 'API',
  'project-3': 'MOB',
}

// Helper to format ticket ID (e.g., "API-1")
function formatTicketId(ticket: TicketWithRelations): string {
  const projectKey = projectKeys[ticket.projectId] || ticket.projectId
  return `${projectKey}-${ticket.number}`
}

export function KeyboardShortcuts() {
  const { columns, addTicket, removeTicket, reorderTicket, reorderTickets, moveTicket, moveTickets } = useBoardStore()
  const { popUndo, pushRedo, popRedo, pushDeletedBatch } = useUndoStore()
  const { clearSelection, selectedTicketIds, getSelectedIds, setTicketOrigin, getTicketOrigin } = useSelectionStore()
  const { activeTicketId, setActiveTicketId, createTicketOpen, setCreateTicketOpen } = useUIStore()
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
            setActiveTicketId(null)
          }
          if (createTicketOpen) {
            setCreateTicketOpen(false)
          }
        }
      }
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [activeTicketId, setActiveTicketId, createTicketOpen, setCreateTicketOpen])

  // Get all tickets flat from columns
  const allTickets = columns.flatMap((col) => col.tickets)

  const handleDeleteSelected = () => {
    const selectedIds = getSelectedIds()
    const tickets = allTickets.filter((t) => selectedIds.includes(t.id))

    if (tickets.length === 0) return

    setTicketsToDelete(tickets)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    // Remove all tickets
    for (const ticket of ticketsToDelete) {
      removeTicket(ticket.id)
    }

    // Create batch entry for undo
    const batchTickets = ticketsToDelete.map((ticket) => ({
      ticket,
      columnId: ticket.columnId,
    }))

    // Format ticket IDs for notification
    const ticketKeys = ticketsToDelete.map((ticket) => formatTicketId(ticket))

    // Show toast with undo option
    const toastId = toast.error(
      ticketsToDelete.length === 1 ? 'Ticket deleted' : `${ticketsToDelete.length} tickets deleted`,
      {
        description: ticketsToDelete.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            // Restore all tickets
            for (const { ticket, columnId } of batchTickets) {
              addTicket(columnId, ticket)
            }
            toast.success(
              ticketsToDelete.length === 1
                ? 'Ticket restored'
                : `${ticketsToDelete.length} tickets restored`,
              { duration: 3000 },
            )
          },
        },
      },
    )

    // Push as a single batch entry
    pushDeletedBatch(batchTickets, toastId)

    clearSelection()
    setShowDeleteConfirm(false)
    setTicketsToDelete([])
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
          clearSelection()
          return
        }
      }

      // Arrow keys: move selected tickets up/down within their column
      if (selectedTicketIds.size > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        
        // Get all selected ticket IDs
        const selectedIds = getSelectedIds()
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

        // Group tickets by column
        const ticketsByColumn = new Map<string, typeof selectedTicketsWithColumns>()
        for (const item of selectedTicketsWithColumns) {
          const existing = ticketsByColumn.get(item.columnId) || []
          existing.push(item)
          ticketsByColumn.set(item.columnId, existing)
        }

        // Move tickets in each column
        for (const [columnId, columnTickets] of ticketsByColumn.entries()) {
          const column = columns.find((c) => c.id === columnId)
          if (!column) continue

          // Sort tickets by their current index to preserve relative order
          columnTickets.sort((a, b) => a.currentIndex - b.currentIndex)
          
          const ticketIds = columnTickets.map((item) => item.ticket.id)
          const firstTicketIndex = columnTickets[0].currentIndex
          const lastTicketIndex = columnTickets[columnTickets.length - 1].currentIndex

          if (e.key === 'ArrowUp') {
            // Move up: move to position before the first selected ticket
            if (firstTicketIndex === 0) {
              // Already at top, can't move up
              continue
            }
            
            if (ticketIds.length === 1) {
              // Single ticket: move up by 1 position
              reorderTicket(columnId, ticketIds[0], firstTicketIndex - 1)
            } else {
              // Multiple tickets: move the group up by 1 position
              reorderTickets(columnId, ticketIds, firstTicketIndex - 1)
            }
          } else if (e.key === 'ArrowDown') {
            // Move down: move to position after the last selected ticket
            if (lastTicketIndex >= column.tickets.length - 1) {
              // Already at bottom, can't move down
              continue
            }
            
            if (ticketIds.length === 1) {
              // Single ticket: move down by 1 position
              reorderTicket(columnId, ticketIds[0], lastTicketIndex + 1)
            } else {
              // Multiple tickets: move the group down by 1 position
              reorderTickets(columnId, ticketIds, lastTicketIndex + 2)
            }
          }
        }
        
        return
      }

      // Arrow keys: move selected tickets left/right between columns
      if (selectedTicketIds.size > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        
        // Get all selected ticket IDs
        const selectedIds = getSelectedIds()
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
              const origin = getTicketOrigin(ticket.id)
              if (!origin) {
                setTicketOrigin(ticket.id, { columnId: column.id, position: i })
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
        const originalColumns = boardStore.columns.map((col) => ({
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
              const origin = getTicketOrigin(id)
              return origin?.columnId === targetColumn.id
            })

            let targetPosition: number
            if (allHaveOriginInTarget && ticketIds.length > 0) {
              // All tickets originated from target column - restore to the first ticket's original position
              // (they'll be placed together as a group at that position)
              const firstTicketOrigin = getTicketOrigin(ticketIds[0])
              targetPosition = firstTicketOrigin?.position ?? targetColumn.tickets.length
            } else {
              // Default to bottom when moving left (unless all tickets are returning to origin)
              targetPosition = targetColumn.tickets.length
            }

            if (ticketIds.length === 1) {
              moveTicket(ticketIds[0], columnId, targetColumn.id, targetPosition)
              moves.push({ ticketId: ticketIds[0], fromColumnId: columnId, toColumnId: targetColumn.id })
            } else {
              moveTickets(ticketIds, targetColumn.id, targetPosition)
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
              const origin = getTicketOrigin(id)
              return origin?.columnId === targetColumn.id
            })

            let targetPosition: number
            if (allHaveOriginInTarget && ticketIds.length > 0) {
              // All tickets originated from target column - restore to the first ticket's original position
              // (they'll be placed together as a group at that position)
              const firstTicketOrigin = getTicketOrigin(ticketIds[0])
              targetPosition = firstTicketOrigin?.position ?? targetColumn.tickets.length
            } else {
              // Default to bottom when moving right (unless all tickets are returning to origin)
              targetPosition = targetColumn.tickets.length
            }

            if (ticketIds.length === 1) {
              moveTicket(ticketIds[0], columnId, targetColumn.id, targetPosition)
              moves.push({ ticketId: ticketIds[0], fromColumnId: columnId, toColumnId: targetColumn.id })
            } else {
              moveTickets(ticketIds, targetColumn.id, targetPosition)
              for (const ticketId of ticketIds) {
                moves.push({ ticketId, fromColumnId: columnId, toColumnId: targetColumn.id })
              }
            }
          }
        }

        // If there were moves, create undo entry
        if (moves.length > 0) {
          const fromColumn = columns.find((c) => c.id === moves[0].fromColumnId)
          const toColumn = columns.find((c) => c.id === moves[0].toColumnId)
          const fromName = fromColumn?.name || 'Unknown'
          const toName = toColumn?.name || 'Unknown'

          // Get current state after move for undo
          const afterColumns = boardStore.columns.map((col) => ({
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

          const toastId = toast.success(
            moves.length === 1 ? 'Ticket moved' : `${moves.length} tickets moved`,
            {
              description:
                moves.length === 1
                  ? `${ticketKeys[0]} moved to ${toName}`
                  : `${ticketKeys.join(', ')} moved to ${toName}`,
              duration: 5000,
            },
          )

          // Push to undo stack
          useUndoStore.getState().pushMove(moves, fromName, toName, toastId, originalColumns, afterColumns)
        }

        return
      }

      // Check for Ctrl/Cmd + Z (Undo) - must check before redo to avoid conflicts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        const entry = popUndo()
        if (entry) {
          toast.dismiss(entry.toastId)

          if (entry.action.type === 'delete') {
            // Restore all deleted tickets
            for (const { ticket, columnId } of entry.action.tickets) {
              addTicket(columnId, ticket)
            }
            // Ensure drawer is closed and selection cleared when restoring
            setActiveTicketId(null)
            clearSelection()
            pushRedo(entry)

            // Format ticket IDs for notification
            const ticketKeys = entry.action.tickets.map(({ ticket }) => formatTicketId(ticket))
            toast.success(
              entry.action.tickets.length === 1
                ? 'Ticket restored'
                : `${entry.action.tickets.length} tickets restored`,
              {
                description:
                  entry.action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
                duration: 3000,
              },
            )
          } else if (entry.action.type === 'move') {
            // Restore the exact column state from before the move
            const boardStore = useBoardStore.getState()
            if (entry.action.originalColumns) {
              // Use the stored original column state for precise undo
              const restoredColumns = entry.action.originalColumns.map((col) => ({
                ...col,
                tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
              }))
              boardStore.setColumns(restoredColumns)
            } else {
              // Fallback: move tickets back one by one (legacy behavior)
              for (const move of entry.action.moves) {
                boardStore.moveTicket(move.ticketId, move.toColumnId, move.fromColumnId, 0)
              }
            }
            
            // Push to redo stack (same entry, will restore to afterColumns when redoing)
            pushRedo(entry)

            // Look up ticket IDs from columns
            const allTickets = columns.flatMap((col) => col.tickets)
            const ticketKeys = entry.action.moves
              .map((move) => {
                const ticket = allTickets.find((t) => t.id === move.ticketId)
                return ticket ? formatTicketId(ticket) : move.ticketId
              })
              .filter(Boolean)

            toast.success(
              entry.action.moves.length === 1
                ? 'Move undone'
                : `${entry.action.moves.length} moves undone`,
              {
                description:
                  entry.action.moves.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
                duration: 3000,
              },
            )
          }
        }
      }

      // Check for Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (Redo)
      // Note: When Shift is pressed, the key is uppercase 'Z', so we check for that
      const isRedo =
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')

      if (isRedo) {
        e.preventDefault()
        const entry = popRedo()
        if (entry) {
          if (entry.action.type === 'delete') {
            // Delete tickets again
            for (const { ticket } of entry.action.tickets) {
              removeTicket(ticket.id)
            }

            // Format ticket IDs for notification
            const ticketKeys = entry.action.tickets.map(({ ticket }) => formatTicketId(ticket))
            const newToastId = toast.error(
              entry.action.tickets.length === 1
                ? 'Ticket deleted'
                : `${entry.action.tickets.length} tickets deleted`,
              {
                description:
                  entry.action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
                duration: 5000,
              },
            )
            pushDeletedBatch(entry.action.tickets, newToastId)
          } else if (entry.action.type === 'move') {
            // Capture current state before redo (state we want to restore to when undoing again)
            const boardStore = useBoardStore.getState()
            const currentStateBeforeRedo = boardStore.columns.map((col) => ({
              ...col,
              tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
            }))
            
            // Restore the exact column state after the move (redo)
            if (entry.action.afterColumns) {
              // Use the stored after column state for precise redo
              const restoredColumns = entry.action.afterColumns.map((col) => ({
                ...col,
                tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
              }))
              boardStore.setColumns(restoredColumns)
            } else {
              // Fallback: move tickets one by one (legacy behavior)
              for (const move of entry.action.moves) {
                boardStore.moveTicket(move.ticketId, move.fromColumnId, move.toColumnId, 0)
              }
            }

            // Look up ticket IDs from columns
            const allTickets = columns.flatMap((col) => col.tickets)
            const ticketKeys = entry.action.moves
              .map((move) => {
                const ticket = allTickets.find((t) => t.id === move.ticketId)
                return ticket ? formatTicketId(ticket) : move.ticketId
              })
              .filter(Boolean)

            const newToastId = toast.success(
              entry.action.moves.length === 1
                ? 'Ticket moved'
                : `${entry.action.moves.length} tickets moved`,
              {
                description:
                  entry.action.moves.length === 1
                    ? `${ticketKeys[0]} moved to ${entry.action.toColumnName}`
                    : `${ticketKeys.join(', ')} moved to ${entry.action.toColumnName}`,
                duration: 5000,
              },
            )
            
            // Push back to undo stack: when undoing again, we want to restore to currentStateBeforeRedo (A)
            // So: originalColumns = currentStateBeforeRedo (A, restore to this when undoing)
            //     afterColumns = entry.action.afterColumns (B, current state after redo)
            useUndoStore.getState().pushMove(
              entry.action.moves,
              entry.action.toColumnName,
              entry.action.fromColumnName,
              newToastId,
              currentStateBeforeRedo, // originalColumns: state to restore to when undoing (A)
              entry.action.afterColumns, // afterColumns: current state after redo (B)
            )
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    addTicket,
    removeTicket,
    reorderTicket,
    reorderTickets,
    moveTicket,
    moveTickets,
    popUndo,
    pushRedo,
    popRedo,
    pushDeletedBatch,
    clearSelection,
    selectedTicketIds,
    getSelectedIds,
    setTicketOrigin,
    getTicketOrigin,
    showDeleteConfirm,
    showShortcuts,
    columns,
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
