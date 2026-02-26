/**
 * Unified delete tickets action.
 * This module consolidates the delete logic used by context menu and keyboard shortcuts.
 */

import type { QueryClient } from '@tanstack/react-query'
import { activityKeys } from '@/hooks/queries/use-activity'
import { formatTicketId } from '@/lib/ticket-format'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, LinkType } from '@/types'
import type {
  ActionOptions,
  ActivityForRestore,
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
  /** Optional: query client for cache invalidation */
  queryClient?: QueryClient
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
 * Fetch activities for a ticket to preserve them for undo.
 * This preserves the full audit trail when a ticket is deleted and restored.
 */
async function fetchActivitiesForTicket(
  projectId: string,
  ticketId: string,
): Promise<ActivityForRestore[]> {
  try {
    // Fetch all activities (no pagination limit for restore)
    const res = await fetch(
      `/api/projects/${projectId}/tickets/${ticketId}/activity?limit=1000&type=activity`,
    )
    if (!res.ok) return []
    const data = await res.json()

    // Process both single activities and grouped activities
    const activities: ActivityForRestore[] = []
    for (const entry of data.entries) {
      if (entry.type === 'activity') {
        activities.push({
          action: entry.action,
          field: entry.field ?? null,
          oldValue:
            typeof entry.oldValue === 'object' ? (entry.oldValue?.id ?? null) : entry.oldValue,
          newValue:
            typeof entry.newValue === 'object' ? (entry.newValue?.id ?? null) : entry.newValue,
          groupId: null,
          userId: entry.user?.id ?? null,
          createdAt: entry.createdAt,
        })
      } else if (entry.type === 'activity_group') {
        // For grouped activities, expand each change
        for (const change of entry.changes) {
          activities.push({
            action: change.action,
            field: change.field ?? null,
            oldValue:
              typeof change.oldValue === 'object' ? (change.oldValue?.id ?? null) : change.oldValue,
            newValue:
              typeof change.newValue === 'object' ? (change.newValue?.id ?? null) : change.newValue,
            groupId: entry.id, // The group ID
            userId: entry.user?.id ?? null,
            createdAt: entry.createdAt,
          })
        }
      }
    }
    return activities
  } catch {
    return []
  }
}

/**
 * Fetch restore data (comments, links, and activities) for tickets before deletion.
 */
async function fetchRestoreData(
  projectId: string,
  tickets: TicketWithColumn[],
): Promise<Map<string, TicketRestoreData>> {
  const restoreDataMap = new Map<string, TicketRestoreData>()

  // Fetch comments, links, and activities in parallel for all tickets
  await Promise.all(
    tickets.map(async ({ ticket }) => {
      const [comments, links, activities] = await Promise.all([
        fetchCommentsForTicket(projectId, ticket.id),
        fetchLinksForTicket(projectId, ticket.id),
        fetchActivitiesForTicket(projectId, ticket.id),
      ])
      restoreDataMap.set(ticket.id, { comments, links, activities })
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
 * Restore comments, links, and activities for a ticket after it's been recreated.
 * Exported for use in keyboard shortcut undo handler.
 *
 * @param activityIdsToDelete - Activity IDs created by ticket recreation that should be
 *                              deleted before restoring original activities (e.g., the
 *                              auto-generated "created" entry)
 */
export async function restoreCommentsAndLinks(
  projectId: string,
  serverTicketId: string,
  restoreData: TicketRestoreData | undefined,
  activityIdsToDelete?: string[],
): Promise<void> {
  if (!restoreData) {
    return
  }

  const { comments, links, activities } = restoreData

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

  // Delete auto-generated activities from ticket recreation (e.g., the new "created" entry)
  // before restoring original activities with their correct timestamps
  if (activityIdsToDelete && activityIdsToDelete.length > 0) {
    try {
      const deleteRes = await fetch(
        `/api/projects/${projectId}/tickets/${serverTicketId}/activity/batch-delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityIds: activityIdsToDelete }),
        },
      )
      if (!deleteRes.ok) {
        console.error('Failed to delete auto-generated activities:', await deleteRes.text())
      }
    } catch (err) {
      console.error('Failed to delete auto-generated activities:', err)
    }
  }

  // Restore all activities (audit trail) including the original "created" entry
  const activitiesToRestore = activities ?? []
  if (activitiesToRestore.length > 0) {
    try {
      const restoreRes = await fetch(
        `/api/projects/${projectId}/tickets/${serverTicketId}/activity/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activities: activitiesToRestore }),
        },
      )
      if (!restoreRes.ok) {
        console.error('Failed to restore activities:', await restoreRes.text())
      }
    } catch (err) {
      console.error('Failed to restore activities:', err)
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
 * - Undo/redo support via Ctrl+Z/Ctrl+Y keyboard shortcuts
 * - Selection clearing after delete
 * - Preserves comments and links for restoration on undo
 */
export async function deleteTickets(params: DeleteTicketsParams): Promise<DeleteResult> {
  const { projectId, tickets, options = {}, onComplete } = params
  const { toastDuration = 5000 } = options

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

  // Show informational toast (undo via Ctrl+Z)
  showUndoRedoToast('error', {
    title: tickets.length === 1 ? 'Ticket deleted' : `${tickets.length} tickets deleted`,
    description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
    duration: toastDuration,
  })

  // Push to undo stack with restore data
  useUndoStore.getState().pushDeletedBatch(projectId, ticketsWithRestoreData)

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
