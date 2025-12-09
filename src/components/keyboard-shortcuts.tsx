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
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'
import { formatTicketId, formatTicketIds } from '@/lib/ticket-format'
import { showUndoRedoToast } from '@/lib/undo-toast'

export function KeyboardShortcuts() {
  // Only subscribe to reactive state we need for re-renders
  const columns = useBoardStore((state) => state.columns)
  const selectedTicketIds = useSelectionStore((state) => state.selectedTicketIds)
  const activeTicketId = useUIStore((state) => state.activeTicketId)
  const createTicketOpen = useUIStore((state) => state.createTicketOpen)
  const openSinglePastedTicket = useSettingsStore((state) => state.openSinglePastedTicket)
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

  // Get all tickets flat from columns
  const allTickets = columns.flatMap((col) => col.tickets)

  const handleDeleteSelected = () => {
    const selectedIds = useSelectionStore.getState().getSelectedIds()
    const tickets = allTickets.filter((t) => selectedIds.includes(t.id))

    if (tickets.length === 0) return

    setTicketsToDelete(tickets)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    // Remove all tickets
    const { removeTicket } = useBoardStore.getState()
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
    const showUndo = useUIStore.getState().showUndoButtons
    const toastId = toast.error(
      ticketsToDelete.length === 1 ? 'Ticket deleted' : `${ticketsToDelete.length} tickets deleted`,
      {
        description: ticketsToDelete.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
        duration: 5000,
        action: showUndo
          ? {
              label: 'Undo',
              onClick: () => {
                // Restore all tickets
                const { addTicket, removeTicket } = useBoardStore.getState()
                for (const { ticket, columnId } of batchTickets) {
                  addTicket(columnId, ticket)
                }
                toast.success(
                  ticketsToDelete.length === 1
                    ? 'Ticket restored'
                    : `${ticketsToDelete.length} tickets restored`,
                  {
                    duration: 3000,
                    action: {
                      label: 'Redo',
                      onClick: () => {
                        for (const { ticket } of batchTickets) {
                          removeTicket(ticket.id)
                        }
                        toast.success(
                          ticketsToDelete.length === 1
                            ? 'Delete redone'
                            : `${ticketsToDelete.length} deletes redone`,
                          { duration: 2000 },
                        )
                      },
                    },
                  },
                )
              },
            }
          : undefined,
      },
    )

    // Push as a single batch entry
    useUndoStore.getState().pushDeletedBatch(batchTickets, toastId)

    useSelectionStore.getState().clearSelection()
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

          const { reorderTicket, reorderTickets } = useBoardStore.getState()
          
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

      // Ctrl/Cmd + C: Copy selected tickets
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && selectedTicketIds.size > 0) {
        e.preventDefault()
        useSelectionStore.getState().copySelected()
        const columnsSnapshot = useBoardStore.getState().columns
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
        const copiedIds = useSelectionStore.getState().getCopiedIds()
        if (copiedIds.length === 0) return

        // Find the original tickets and their columns
        const ticketsToPaste: Array<{ ticket: TicketWithRelations; columnId: string }> = []
        for (const id of copiedIds) {
          for (const column of columns) {
            const ticket = column.tickets.find((t) => t.id === id)
            if (ticket) {
              ticketsToPaste.push({ ticket, columnId: column.id })
              break
            }
          }
        }

        if (ticketsToPaste.length === 0) return

        // Clone each ticket with new ID and number
        const pasteBoard = useBoardStore.getState()
        const newTickets: Array<{ ticket: TicketWithRelations; columnId: string }> = []
        let nextNumber = pasteBoard.getNextTicketNumber()

        for (const { ticket, columnId } of ticketsToPaste) {
          const newTicket: TicketWithRelations = {
            ...ticket,
            id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            number: nextNumber++,
            title: `${ticket.title} (copy)`,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          newTickets.push({ ticket: newTicket, columnId })
          pasteBoard.addTicket(columnId, newTicket)
        }

        // Show toast with undo option
        const ticketKeys = newTickets.map(({ ticket }) => formatTicketId(ticket))
        const showUndo = useUIStore.getState().showUndoButtons
        const { removeTicket } = useBoardStore.getState()
        const toastId = toast.success(
          newTickets.length === 1 ? 'Ticket pasted' : `${newTickets.length} tickets pasted`,
          {
            description: newTickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            duration: 5000,
            action: showUndo
              ? {
                  label: 'Undo',
                  onClick: () => {
                    for (const { ticket } of newTickets) {
                      removeTicket(ticket.id)
                    }
                    toast.success('Paste undone', {
                      duration: 2000,
                      action: {
                        label: 'Redo',
                        onClick: () => {
                          for (const { ticket, columnId } of newTickets) {
                            pasteBoard.addTicket(columnId, ticket)
                          }
                          toast.success('Paste redone', { duration: 2000 })
                        },
                      },
                    })
                  },
                }
              : undefined,
          },
        )

        // Push to undo stack
        useUndoStore.getState().pushPaste(newTickets, toastId)

        // If single ticket and setting enabled, open it
        if (newTickets.length === 1 && openSinglePastedTicket) {
          useUIStore.getState().setActiveTicketId(newTickets[0].ticket.id)
        }

        // Select the newly pasted tickets
        useSelectionStore.getState().clearSelection()
        for (const { ticket } of newTickets) {
          useSelectionStore.getState().toggleTicket(ticket.id)
        }

        return
      }

      // Check for Ctrl/Cmd + Z (Undo) - must check before redo to avoid conflicts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        const undoStore = useUndoStore.getState()
        const entry = undoStore.popUndo()
        if (entry) {
          toast.dismiss(entry.toastId)

          const showUndo = useUIStore.getState().showUndoButtons

          if (entry.action.type === 'delete') {
            // Restore all deleted tickets
            const { addTicket, removeTicket } = useBoardStore.getState()
            for (const { ticket, columnId } of entry.action.tickets) {
              addTicket(columnId, ticket)
            }
            useUIStore.getState().setActiveTicketId(null)
            useSelectionStore.getState().clearSelection()
            undoStore.pushRedo(entry)

            const ticketKeys = entry.action.tickets.map(({ ticket }) => formatTicketId(ticket))
            showUndoRedoToast('success', {
              title:
                entry.action.tickets.length === 1
                  ? 'Ticket restored'
                  : `${entry.action.tickets.length} tickets restored`,
              description: entry.action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              // In this "undo toast", the primary action should re-delete (redo)
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: () => {
                for (const { ticket } of entry.action.tickets) {
                  removeTicket(ticket.id)
                }
              },
              onRedo: () => {
                for (const { ticket, columnId } of entry.action.tickets) {
                  addTicket(columnId, ticket)
                }
              },
              undoneTitle:
                entry.action.tickets.length === 1 ? 'Delete redone' : `${entry.action.tickets.length} deletes redone`,
              redoneTitle:
                entry.action.tickets.length === 1
                  ? 'Ticket restored'
                  : `${entry.action.tickets.length} tickets restored`,
              redoneDescription: entry.action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            })
          } else if (entry.action.type === 'update') {
            const boardStore = useBoardStore.getState()
            for (const item of entry.action.tickets) {
              boardStore.updateTicket(item.ticketId, item.before)
            }
            undoStore.pushRedo(entry)
            const ticketKeys = entry.action.tickets
              .map((item) => {
                const t = columns.flatMap((c) => c.tickets).find((tk) => tk.id === item.ticketId)
                return t ? formatTicketId(t) : item.ticketId
              })
              .filter(Boolean)
            showUndoRedoToast('success', {
              title:
                entry.action.tickets.length === 1
                  ? 'Change undone'
                  : `${entry.action.tickets.length} changes undone`,
              description: entry.action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: () => {
                for (const item of entry.action.tickets) {
                  boardStore.updateTicket(item.ticketId, item.after)
                }
              },
              onRedo: () => {
                for (const item of entry.action.tickets) {
                  boardStore.updateTicket(item.ticketId, item.before)
                }
              },
              undoneTitle:
                entry.action.tickets.length === 1 ? 'Change redone' : `${entry.action.tickets.length} changes redone`,
              redoneTitle:
                entry.action.tickets.length === 1
                  ? 'Change undone'
                  : `${entry.action.tickets.length} changes undone`,
              redoneDescription: entry.action.tickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
            })
          } else if (entry.action.type === 'move') {
            // Restore the exact column state from before the move
            const moveBoardStore = useBoardStore.getState()
            if (entry.action.originalColumns) {
              // Use the stored original column state for precise undo
              const restoredColumns = entry.action.originalColumns.map((col) => ({
                ...col,
                tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
              }))
              moveBoardStore.setColumns(restoredColumns)
            } else {
              // Fallback: move tickets back one by one (legacy behavior)
              for (const move of entry.action.moves) {
                moveBoardStore.moveTicket(move.ticketId, move.toColumnId, move.fromColumnId, 0)
              }
            }
            
            // Push to redo stack (same entry, will restore to afterColumns when redoing)
            undoStore.pushRedo(entry)

            // Look up ticket IDs from columns
            const moveAllTickets = columns.flatMap((col) => col.tickets)
            const moveTicketKeys = entry.action.moves
              .map((move) => {
                const ticket = moveAllTickets.find((t) => t.id === move.ticketId)
                return ticket ? formatTicketId(ticket) : move.ticketId
              })
              .filter(Boolean)

            const moveTitle =
              entry.action.moves.length === 1
                ? 'Ticket moved'
                : `${entry.action.moves.length} tickets moved`
            const moveDesc =
              entry.action.moves.length === 1
                ? `${moveTicketKeys[0]} moved to ${entry.action.toColumnName}`
                : `${moveTicketKeys.join(', ')} moved to ${entry.action.toColumnName}`

            showUndoRedoToast('success', {
              title:
                entry.action.moves.length === 1
                  ? 'Move undone'
                  : `${entry.action.moves.length} moves undone`,
              description:
                entry.action.moves.length === 1 ? moveTicketKeys[0] : moveTicketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: () => {
                if (entry.action.afterColumns) {
                  const restoredColumns = entry.action.afterColumns.map((col) => ({
                    ...col,
                    tickets: col.tickets.map((t) => ({ ...t })),
                  }))
                  moveBoardStore.setColumns(restoredColumns)
                } else {
                  for (const move of entry.action.moves) {
                    moveBoardStore.moveTicket(move.ticketId, move.fromColumnId, move.toColumnId, 0)
                  }
                }
              },
              onRedo: () => {
                if (entry.action.originalColumns) {
                  const restoredColumns = entry.action.originalColumns.map((col) => ({
                    ...col,
                    tickets: col.tickets.map((t) => ({ ...t })),
                  }))
                  moveBoardStore.setColumns(restoredColumns)
                }
              },
              undoneTitle: moveTitle,
              undoneDescription: moveDesc,
              redoneTitle:
                entry.action.moves.length === 1
                  ? 'Move undone'
                  : `${entry.action.moves.length} moves undone`,
              redoneDescription:
                entry.action.moves.length === 1 ? moveTicketKeys[0] : moveTicketKeys.join(', '),
            })
          } else if (entry.action.type === 'paste') {
            // Remove all pasted tickets
            const { removeTicket } = useBoardStore.getState()
            for (const { ticket } of entry.action.tickets) {
              removeTicket(ticket.id)
            }
            // Ensure drawer is closed and selection cleared
            useUIStore.getState().setActiveTicketId(null)
            useSelectionStore.getState().clearSelection()
            undoStore.pushRedo(entry)

            // Format ticket IDs for notification
            const pasteTicketKeys = entry.action.tickets.map(({ ticket }) => formatTicketId(ticket))
            showUndoRedoToast('success', {
              title:
                entry.action.tickets.length === 1
                  ? 'Paste undone'
                  : `${entry.action.tickets.length} pastes undone`,
              description:
                entry.action.tickets.length === 1 ? pasteTicketKeys[0] : pasteTicketKeys.join(', '),
              duration: 3000,
              showUndoButtons: showUndo,
              undoLabel: 'Redo',
              redoLabel: 'Undo',
              onUndo: () => {
                const pasteBoard = useBoardStore.getState()
                for (const { ticket, columnId } of entry.action.tickets) {
                  pasteBoard.addTicket(columnId, ticket)
                }
              },
              onRedo: () => {
                const pasteBoard = useBoardStore.getState()
                for (const { ticket } of entry.action.tickets) {
                  pasteBoard.removeTicket(ticket.id)
                }
              },
              undoneTitle:
                entry.action.tickets.length === 1
                  ? 'Paste redone'
                  : `${entry.action.tickets.length} pastes redone`,
              redoneTitle:
                entry.action.tickets.length === 1
                  ? 'Paste undone'
                  : `${entry.action.tickets.length} pastes undone`,
              redoneDescription:
                entry.action.tickets.length === 1 ? pasteTicketKeys[0] : pasteTicketKeys.join(', '),
            })
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
        const redoStore = useUndoStore.getState()
        const entry = redoStore.popRedo()
        if (entry) {
          const showUndo = useUIStore.getState().showUndoButtons

          if (entry.action.type === 'delete') {
            const { removeTicket, addTicket } = useBoardStore.getState()
            for (const { ticket } of entry.action.tickets) {
              removeTicket(ticket.id)
            }

            const delTicketKeys = entry.action.tickets.map(({ ticket }) => formatTicketId(ticket))
            const newToastId = toast.error(
              entry.action.tickets.length === 1
                ? 'Ticket deleted'
                : `${entry.action.tickets.length} tickets deleted`,
              {
                description:
                  entry.action.tickets.length === 1 ? delTicketKeys[0] : delTicketKeys.join(', '),
                duration: 5000,
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: () => {
                        for (const { ticket, columnId } of entry.action.tickets) {
                          addTicket(columnId, ticket)
                        }
                        redoStore.pushRedo(entry)
                        toast.success(
                          entry.action.tickets.length === 1
                            ? 'Ticket restored'
                            : `${entry.action.tickets.length} tickets restored`,
                          { duration: 3000 },
                        )
                      },
                    }
                  : undefined,
              },
            )
            redoStore.pushDeletedBatch(entry.action.tickets, newToastId)
          } else if (entry.action.type === 'update') {
            const boardStore = useBoardStore.getState()
            for (const item of entry.action.tickets) {
              boardStore.updateTicket(item.ticketId, item.after)
            }
            const swappedTickets = entry.action.tickets.map((item) => ({
              ticketId: item.ticketId,
              before: item.before,
              after: item.after,
            }))
            const ticketKeys = swappedTickets
              .map((item) => {
                const t = boardStore.columns.flatMap((c) => c.tickets).find((tk) => tk.id === item.ticketId)
                return t ? formatTicketId(t) : item.ticketId
              })
              .filter(Boolean)
            const newToastId = toast.success(
              swappedTickets.length === 1 ? 'Change redone' : `${swappedTickets.length} changes redone`,
              {
                description: swappedTickets.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
                duration: 3000,
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: () => {
                        for (const item of swappedTickets) {
                          boardStore.updateTicket(item.ticketId, item.before)
                        }
                        redoStore.pushRedo(entry)
                        toast.success(
                          swappedTickets.length === 1
                            ? 'Change undone'
                            : `${swappedTickets.length} changes undone`,
                          { duration: 2000 },
                        )
                      },
                    }
                  : undefined,
              },
            )
            redoStore.pushUpdate(swappedTickets, newToastId)
          } else if (entry.action.type === 'move') {
            const boardStore = useBoardStore.getState()
            const currentStateBeforeRedo = boardStore.columns.map((col) => ({
              ...col,
              tickets: col.tickets.map((t) => ({ ...t })),
            }))

            if (entry.action.afterColumns) {
              const restoredColumns = entry.action.afterColumns.map((col) => ({
                ...col,
                tickets: col.tickets.map((t) => ({ ...t })),
              }))
              boardStore.setColumns(restoredColumns)
            } else {
              for (const move of entry.action.moves) {
                boardStore.moveTicket(move.ticketId, move.fromColumnId, move.toColumnId, 0)
              }
            }

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
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: () => {
                        const bs = useBoardStore.getState()
                        bs.setColumns(currentStateBeforeRedo)
                        redoStore.pushRedo(entry)
                        toast.success(
                          entry.action.moves.length === 1
                            ? 'Move undone'
                            : `${entry.action.moves.length} moves undone`,
                          { duration: 2000 },
                        )
                      },
                    }
                  : undefined,
              },
            )

            useUndoStore.getState().pushMove(
              entry.action.moves,
              entry.action.toColumnName,
              entry.action.fromColumnName,
              newToastId,
              currentStateBeforeRedo,
              entry.action.afterColumns,
            )
          } else if (entry.action.type === 'paste') {
            const { addTicket: redoAddTicket, removeTicket: redoRemoveTicket } = useBoardStore.getState()
            for (const { ticket, columnId } of entry.action.tickets) {
              redoAddTicket(columnId, ticket)
            }

            const redoPasteTicketKeys = entry.action.tickets.map(({ ticket }) => formatTicketId(ticket))
            const newPasteToastId = toast.success(
              entry.action.tickets.length === 1
                ? 'Ticket pasted'
                : `${entry.action.tickets.length} tickets pasted`,
              {
                description:
                  entry.action.tickets.length === 1 ? redoPasteTicketKeys[0] : redoPasteTicketKeys.join(', '),
                duration: 5000,
                action: showUndo
                  ? {
                      label: 'Undo',
                      onClick: () => {
                        for (const { ticket } of entry.action.tickets) {
                          redoRemoveTicket(ticket.id)
                        }
                        redoStore.pushRedo(entry)
                        toast.success(
                          entry.action.tickets.length === 1
                            ? 'Paste undone'
                            : `${entry.action.tickets.length} pastes undone`,
                          { duration: 2000 },
                        )
                      },
                    }
                  : undefined,
              },
            )
            redoStore.pushPaste(entry.action.tickets, newPasteToastId)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedTicketIds,
    openSinglePastedTicket,
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
