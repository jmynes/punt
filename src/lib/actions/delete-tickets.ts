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
import type { ColumnWithTickets, LinkType } from '@/types'
import type {
  ActionOptions,
  CommentForRestore,
  DeleteResult,
  LinkForRestore,
  TicketRestoreData,
  TicketWithColumn,
  TicketWithRestoreData,
} from './types'

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
 * Fetch comments for a ticket to preserve them for undo.
 */
async function fetchCommentsForTicket(
  projectId: string,
  ticketId: string,
): Promise<CommentForRestore[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/comments`)
    if (!res.ok) {
      return []
    }
    const comments = await res.json()
    return comments.map(
      (c: {
        content: string
        author: { id: string }
        isSystemGenerated: boolean
        source: string | null
        createdAt: string
      }) => ({
        content: c.content,
        authorId: c.author.id, // author is an object, not authorId
        isSystemGenerated: c.isSystemGenerated ?? false,
        source: c.source ?? null,
        createdAt: c.createdAt,
      }),
    )
  } catch {
    return []
  }
}

/**
 * Fetch links for a ticket to preserve them for undo.
 */
async function fetchLinksForTicket(projectId: string, ticketId: string): Promise<LinkForRestore[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/links`)
    if (!res.ok) return []
    const links = await res.json()
    return links.map(
      (l: {
        linkType: LinkType
        linkedTicket: { id: string }
        direction: 'outward' | 'inward'
      }) => ({
        linkType: l.linkType,
        linkedTicketId: l.linkedTicket.id,
        direction: l.direction,
      }),
    )
  } catch {
    return []
  }
}

/**
 * Fetch restore data (comments and links) for tickets before deletion.
 */
async function fetchRestoreData(
  projectId: string,
  tickets: TicketWithColumn[],
): Promise<Map<string, TicketRestoreData>> {
  const restoreDataMap = new Map<string, TicketRestoreData>()

  // Fetch comments and links in parallel for all tickets
  await Promise.all(
    tickets.map(async ({ ticket }) => {
      const [comments, links] = await Promise.all([
        fetchCommentsForTicket(projectId, ticket.id),
        fetchLinksForTicket(projectId, ticket.id),
      ])
      restoreDataMap.set(ticket.id, { comments, links })
    }),
  )

  return restoreDataMap
}

/**
 * Restore attachments for a ticket after it's been recreated.
 * Exported for use in keyboard shortcut undo handler.
 */
export async function restoreAttachments(
  projectId: string,
  serverTicketId: string,
  attachments: Array<{ filename: string; mimeType: string; size: number; url: string }> | undefined,
): Promise<void> {
  if (!attachments || attachments.length === 0) {
    return
  }

  try {
    await fetch(`/api/projects/${projectId}/tickets/${serverTicketId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: attachments.map((a) => ({
          filename: a.filename,
          originalName: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
        })),
      }),
    })
  } catch (err) {
    console.error('Failed to restore attachments:', err)
  }
}

/**
 * Restore comments and links for a ticket after it's been recreated.
 * Exported for use in keyboard shortcut undo handler.
 */
export async function restoreCommentsAndLinks(
  projectId: string,
  serverTicketId: string,
  restoreData: TicketRestoreData | undefined,
): Promise<void> {
  if (!restoreData) {
    return
  }

  const { comments, links } = restoreData

  // Restore comments with original authors
  if (comments.length > 0) {
    try {
      await fetch(`/api/projects/${projectId}/tickets/${serverTicketId}/comments/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      })
    } catch (err) {
      console.error('Failed to restore comments:', err)
    }
  }

  // Restore links
  if (links.length > 0) {
    try {
      await fetch(`/api/projects/${projectId}/tickets/${serverTicketId}/links/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      })
    } catch (err) {
      console.error('Failed to restore links:', err)
    }
  }
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
 * - Preserves comments and links for restoration on undo
 */
export async function deleteTickets(params: DeleteTicketsParams): Promise<DeleteResult> {
  const { projectId, tickets, options = {}, onComplete } = params
  const { showUndoButtons = true, toastDuration = 5000 } = options

  if (tickets.length === 0) {
    return { success: false, deletedTickets: [], error: 'No tickets to delete' }
  }

  const boardStore = useBoardStore.getState()

  // Fetch comments and links BEFORE deletion (so we can restore them on undo)
  const restoreDataMap = await fetchRestoreData(projectId, tickets)

  // Build tickets with restore data for the undo stack
  const ticketsWithRestoreData: TicketWithRestoreData[] = tickets.map(({ ticket, columnId }) => ({
    ticket,
    columnId,
    restoreData: restoreDataMap.get(ticket.id),
  }))

  // Optimistic delete - remove from UI immediately
  for (const { ticket } of tickets) {
    boardStore.removeTicket(projectId, ticket.id)
  }

  // Clear selection (delete always clears since tickets are removed)
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
        for (const { ticket, columnId } of ticketsWithRestoreData) {
          currentBoardStore.addTicket(projectId, columnId, ticket)
        }

        // Recreate via API
        try {
          await Promise.all(
            ticketsWithRestoreData.map(async ({ ticket, columnId, restoreData }) => {
              const createPayload = {
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
                // Preserve original creation timestamp on restore
                createdAt: ticket.createdAt,
              }
              const res = await fetch(`/api/projects/${projectId}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createPayload),
              })

              if (!res.ok) throw new Error('Failed to restore ticket')
              const serverTicket = await res.json()

              // Replace temp ticket with server ticket
              currentBoardStore.removeTicket(projectId, ticket.id)
              currentBoardStore.addTicket(projectId, columnId, serverTicket)

              // Restore attachments, comments, and links
              await restoreAttachments(projectId, serverTicket.id, ticket.attachments)
              await restoreCommentsAndLinks(projectId, serverTicket.id, restoreData)
            }),
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

  // Push to undo stack with restore data
  useUndoStore.getState().pushDeletedBatch(projectId, ticketsWithRestoreData, toastId)

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
