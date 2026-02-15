/**
 * Unified delete tickets action.
 * This module consolidates the delete logic used by context menu and keyboard shortcuts.
 */

import { formatTicketId } from '@/lib/ticket-format'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets } from '@/types'
import type { ActionOptions, DeleteResult, TicketWithColumn } from './types'

export interface DeleteTicketsParams {
  /** The project ID to delete tickets from */
  projectId: string
  /** Tickets to delete with their column IDs */
  tickets: TicketWithColumn[]
  /** Optional: action options */
  options?: ActionOptions
  /** Optional: callback when delete completes (for UI cleanup like closing dialogs) */
  onComplete?: () => void
}

/**
 * Delete tickets from the project.
 * This is the unified implementation used by both context menu and keyboard shortcuts.
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - API persistence for real projects with rollback on error
 * - Undo/redo support with proper toast integration
 * - Selection clearing after delete
 */
export async function deleteTickets(params: DeleteTicketsParams): Promise<DeleteResult> {
  const { projectId, tickets, options = {}, onComplete } = params
  const { showUndoButtons = true, toastDuration = 5000 } = options

  if (tickets.length === 0) {
    return { success: false, deletedTickets: [], error: 'No tickets to delete' }
  }

  const boardStore = useBoardStore.getState()

  // Optimistic delete - remove from UI immediately
  for (const { ticket } of tickets) {
    boardStore.removeTicket(projectId, ticket.id)
  }

  // Clear selection
  useSelectionStore.getState().clearSelection()

  // Call API to delete
  try {
    await Promise.all(
      tickets.map(({ ticket }) =>
        fetch(`/api/projects/${projectId}/tickets/${ticket.id}`, {
          method: 'DELETE',
        }).then((res) => {
          if (!res.ok) throw new Error('Failed to delete ticket')
        }),
      ),
    )
  } catch (_error) {
    // Rollback on error - restore all tickets
    for (const { ticket, columnId } of tickets) {
      boardStore.addTicket(projectId, columnId, ticket)
    }
    showToast.error('Failed to delete ticket(s)')
    onComplete?.()
    return { success: false, deletedTickets: [], error: 'API error' }
  }

  // Format ticket IDs for notification
  const ticketKeys = tickets.map(({ ticket }) => formatTicketId(ticket))
  const showUndo = useSettingsStore.getState().showUndoButtons ?? showUndoButtons

  let currentId: string | number | undefined

  const toastId = showUndoRedoToast('error', {
    title: tickets.length === 1 ? 'Ticket deleted' : `${tickets.length} tickets deleted`,
    description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
    duration: toastDuration,
    showUndoButtons: showUndo,
    onUndo: async (id) => {
      // Move to redo stack
      const entry = useUndoStore.getState().undoByToastId(id)
      if (entry) {
        // Restore tickets
        const currentBoardStore = useBoardStore.getState()
        for (const { ticket, columnId } of tickets) {
          currentBoardStore.addTicket(projectId, columnId, ticket)
        }

        // Recreate via API
        try {
          await Promise.all(
            tickets.map(({ ticket, columnId }) =>
              fetch(`/api/projects/${projectId}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: ticket.title,
                  description: ticket.description,
                  type: ticket.type,
                  priority: ticket.priority,
                  columnId,
                  storyPoints: ticket.storyPoints,
                  estimate: ticket.estimate,
                  startDate: ticket.startDate,
                  dueDate: ticket.dueDate,
                  assigneeId: ticket.assigneeId,
                  sprintId: ticket.sprintId,
                  labelIds: ticket.labels?.map((l) => l.id) ?? [],
                  watcherIds: ticket.watchers?.map((w) => w.id) ?? [],
                }),
              }).then(async (res) => {
                if (!res.ok) throw new Error('Failed to restore ticket')
                const serverTicket = await res.json()
                // Replace temp ticket with server ticket
                currentBoardStore.removeTicket(projectId, ticket.id)
                currentBoardStore.addTicket(projectId, columnId, serverTicket)
              }),
            ),
          )
        } catch (err) {
          console.error('Failed to restore deleted tickets via API:', err)
          showToast.error('Failed to restore tickets')
        }
      }
    },
    onRedo: (id) => {
      // Move to undo stack
      useUndoStore.getState().redoByToastId(id)

      // Re-delete tickets
      const currentBoardStore = useBoardStore.getState()
      for (const { ticket } of tickets) {
        currentBoardStore.removeTicket(projectId, ticket.id)
      }

      // Delete via API
      Promise.all(
        tickets.map(({ ticket }) =>
          fetch(`/api/projects/${projectId}/tickets/${ticket.id}`, {
            method: 'DELETE',
          }),
        ),
      ).catch((err) => {
        console.error('Failed to re-delete tickets via API:', err)
      })
    },
    onUndoneToast: (newId) => {
      if (currentId) {
        useUndoStore.getState().updateRedoToastId(currentId, newId)
        currentId = newId
      }
    },
    onRedoneToast: (newId) => {
      if (currentId) {
        useUndoStore.getState().updateUndoToastId(currentId, newId)
        currentId = newId
      }
    },
    undoneTitle: tickets.length === 1 ? 'Ticket restored' : `${tickets.length} tickets restored`,
    redoneTitle: tickets.length === 1 ? 'Delete redone' : `${tickets.length} deletes redone`,
  })

  currentId = toastId

  // Push to undo stack
  useUndoStore.getState().pushDeletedBatch(projectId, tickets, toastId)

  // Call completion callback (e.g., to close dialog)
  onComplete?.()

  return { success: true, deletedTickets: tickets }
}

/**
 * Prepare tickets for deletion from selected IDs.
 * This is a helper function to find tickets from selection.
 */
export function prepareTicketsForDelete(
  selectedIds: string[],
  columns: ColumnWithTickets[],
): TicketWithColumn[] {
  const tickets: TicketWithColumn[] = []

  for (const column of columns) {
    for (const ticket of column.tickets) {
      if (selectedIds.includes(ticket.id)) {
        tickets.push({ ticket, columnId: column.id })
      }
    }
  }

  return tickets
}
