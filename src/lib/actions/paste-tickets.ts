/**
 * Unified paste tickets action.
 * This module consolidates the paste logic used by context menu and keyboard shortcuts.
 */

import { toast } from 'sonner'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUndoStore } from '@/stores/undo-store'
import { useUIStore } from '@/stores/ui-store'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { isDemoProject } from '@/lib/constants'
import { formatTicketId } from '@/lib/ticket-format'
import { batchCreateTicketsAPI, batchDeleteTicketsAPI } from '@/hooks/queries/use-tickets'
import type { TicketWithRelations, ColumnWithTickets } from '@/types'
import type { TicketWithColumn, PasteResult, ActionOptions } from './types'

/**
 * Generate a temporary ID for optimistic updates.
 */
function generateTempId(): string {
  return `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Find tickets from copied IDs in the given columns.
 */
function findTicketsToPaste(copiedIds: string[], columns: ColumnWithTickets[]): TicketWithColumn[] {
  const ticketsToPaste: TicketWithColumn[] = []

  for (const id of copiedIds) {
    for (const column of columns) {
      const ticket = column.tickets.find((t) => t.id === id)
      if (ticket) {
        ticketsToPaste.push({ ticket, columnId: column.id })
        break
      }
    }
  }

  return ticketsToPaste
}

/**
 * Create ticket data for API call from a ticket.
 */
function createTicketData(ticket: TicketWithRelations) {
  return {
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
  }
}

export interface PasteTicketsParams {
  /** The project ID to paste tickets into */
  projectId: string
  /** Columns in the project (used to find copied tickets) */
  columns: ColumnWithTickets[]
  /** Optional: IDs of tickets to paste. If not provided, uses selection store's copied IDs */
  copiedIds?: string[]
  /** Optional: action options */
  options?: ActionOptions
  /** Optional: callback when paste completes (for UI cleanup like closing menus) */
  onComplete?: () => void
  /** Optional: whether to open the drawer for single pasted ticket (default: true) */
  openSinglePastedTicket?: boolean
}

/**
 * Paste copied tickets into the project.
 * This is the unified implementation used by both context menu and keyboard shortcuts.
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - API persistence for real projects
 * - Undo/redo support with proper toast integration
 * - Selection update to select newly pasted tickets
 */
export function pasteTickets(params: PasteTicketsParams): PasteResult {
  const { projectId, columns, options = {}, onComplete, openSinglePastedTicket = true } = params
  const { showUndoButtons = true, toastDuration = 5000 } = options

  // Get copied IDs from selection store if not provided
  const copiedIds = params.copiedIds ?? useSelectionStore.getState().getCopiedIds()
  if (copiedIds.length === 0) {
    return { success: false, newTickets: [], error: 'No tickets to paste' }
  }

  // Find the original tickets
  const ticketsToPaste = findTicketsToPaste(copiedIds, columns)
  if (ticketsToPaste.length === 0) {
    return { success: false, newTickets: [], error: 'Could not find copied tickets' }
  }

  const isDemo = isDemoProject(projectId)
  const boardStore = useBoardStore.getState()
  const newTickets: TicketWithColumn[] = []
  let nextNumber = boardStore.getNextTicketNumber(projectId)

  // Create new tickets with temp IDs for optimistic update
  for (const { ticket, columnId } of ticketsToPaste) {
    const newTicket: TicketWithRelations = {
      ...ticket,
      id: generateTempId(),
      number: nextNumber++,
      title: `${ticket.title} (copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    newTickets.push({ ticket: newTicket, columnId })
    // Optimistic add
    boardStore.addTicket(projectId, columnId, newTicket)
  }

  // Persist to database for real projects
  if (!isDemo) {
    ;(async () => {
      try {
        const ticketsToCreate = newTickets.map(({ ticket, columnId }) => ({
          tempId: ticket.id,
          columnId,
          ticketData: createTicketData(ticket),
        }))

        const serverTickets = await batchCreateTicketsAPI(projectId, ticketsToCreate)

        // Replace temp tickets with server tickets
        const currentBoardState = useBoardStore.getState()
        const selectionState = useSelectionStore.getState()

        for (const { ticket: tempTicket, columnId } of newTickets) {
          const serverTicket = serverTickets.get(tempTicket.id)
          if (serverTicket) {
            currentBoardState.removeTicket(projectId, tempTicket.id)
            currentBoardState.addTicket(projectId, columnId, serverTicket)
            // Update selection if this ticket was selected
            if (selectionState.isSelected(tempTicket.id)) {
              selectionState.toggleTicket(tempTicket.id) // deselect temp
              selectionState.toggleTicket(serverTicket.id) // select server
            }
          }
        }
      } catch (error) {
        console.error('Failed to persist pasted tickets:', error)
        // Remove optimistic tickets on failure
        const currentBoardState = useBoardStore.getState()
        for (const { ticket } of newTickets) {
          currentBoardState.removeTicket(projectId, ticket.id)
        }
        toast.error('Failed to paste tickets')
      }
    })()
  }

  // Show undo/redo toast
  const ticketKeys = newTickets.map(({ ticket }) => formatTicketId(ticket))
  const showUndo = useUIStore.getState().showUndoButtons ?? showUndoButtons

  const toastId = showUndoRedoToast('success', {
    title: newTickets.length === 1 ? 'Ticket pasted' : `${newTickets.length} tickets pasted`,
    description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
    duration: toastDuration,
    showUndoButtons: showUndo,
    onUndo: async () => {
      // Remove pasted tickets
      const currentBoardState = useBoardStore.getState()
      const ticketIdsToDelete: string[] = []

      for (const { ticket } of newTickets) {
        // Find the ticket in the store (may have been replaced with server ticket)
        const cols = currentBoardState.getColumns(projectId)
        const foundTicket = cols
          .flatMap((c) => c.tickets)
          .find((t) => t.id === ticket.id || t.title === ticket.title)
        if (foundTicket) {
          currentBoardState.removeTicket(projectId, foundTicket.id)
          ticketIdsToDelete.push(foundTicket.id)
        }
      }

      // Delete from database for real projects
      if (!isDemo && ticketIdsToDelete.length > 0) {
        batchDeleteTicketsAPI(projectId, ticketIdsToDelete).catch((err) => {
          console.error('Failed to delete pasted tickets on undo:', err)
        })
      }
    },
    onRedo: async () => {
      // Re-add the tickets
      const currentBoardState = useBoardStore.getState()
      const redoTickets: TicketWithColumn[] = []

      for (const { ticket, columnId } of newTickets) {
        const redoTicket: TicketWithRelations = {
          ...ticket,
          id: generateTempId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        currentBoardState.addTicket(projectId, columnId, redoTicket)
        redoTickets.push({ ticket: redoTicket, columnId })
      }

      // Persist to database for real projects
      if (!isDemo) {
        try {
          const ticketsToCreate = redoTickets.map(({ ticket, columnId }) => ({
            tempId: ticket.id,
            columnId,
            ticketData: createTicketData(ticket),
          }))
          const serverTickets = await batchCreateTicketsAPI(projectId, ticketsToCreate)

          for (const { ticket: tempTicket, columnId } of redoTickets) {
            const serverTicket = serverTickets.get(tempTicket.id)
            if (serverTicket) {
              currentBoardState.removeTicket(projectId, tempTicket.id)
              currentBoardState.addTicket(projectId, columnId, serverTicket)
            }
          }
        } catch (err) {
          console.error('Failed to recreate tickets on redo:', err)
        }
      }
    },
    undoneTitle: 'Paste undone',
    redoneTitle: 'Paste redone',
  })

  // Register with undo store
  useUndoStore.getState().pushPaste(projectId, newTickets, toastId)

  // Update selection to select newly pasted tickets
  const selectionStore = useSelectionStore.getState()
  selectionStore.clearSelection()
  for (const { ticket } of newTickets) {
    selectionStore.toggleTicket(ticket.id)
  }

  // Open drawer for single ticket paste if setting enabled
  if (newTickets.length === 1 && openSinglePastedTicket) {
    useUIStore.getState().setActiveTicketId(newTickets[0].ticket.id)
  }

  // Call completion callback (e.g., to close menu)
  onComplete?.()

  return { success: true, newTickets }
}
