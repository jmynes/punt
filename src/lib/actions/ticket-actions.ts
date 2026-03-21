/**
 * Unified ticket action layer.
 *
 * All UI surfaces (drag, context menu, keyboard, drawer) call these functions
 * for ticket mutations. Each action handles:
 * - Optimistic store update
 * - Resolution auto-coupling (client-side)
 * - Undo registration
 * - API persistence (batch for multi-ticket)
 * - Error rollback
 */

import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { isCompletedColumn } from '@/lib/sprint-utils'
import { toUpdateTicketInput } from '@/lib/ticket-mutations'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TicketActionOptions {
  /** Register undo entry (default: true) */
  undo?: boolean
  /** Apply optimistic store update (default: true) */
  optimistic?: boolean
  /** Show toast notification (default: true) */
  toast?: boolean
}

interface MoveTicketsParams {
  projectId: string
  ticketIds: string[]
  toColumnId: string
  toIndex?: number
  tabId: string
  options?: TicketActionOptions
}

interface UpdateTicketsParams {
  projectId: string
  updates: Array<{ ticketId: string; changes: Partial<TicketWithRelations> }>
  tabId: string
  options?: TicketActionOptions
}

interface ReorderTicketsParams {
  projectId: string
  columnId: string
  ticketIds: string[]
  targetIndex: number
  tabId: string
  options?: TicketActionOptions
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snapshotColumns(projectId: string): ColumnWithTickets[] {
  return useBoardStore
    .getState()
    .getColumns(projectId)
    .map((col) => ({
      ...col,
      tickets: col.tickets.map((t) => ({ ...t })),
    }))
}

// ─── moveTickets ─────────────────────────────────────────────────────────────

/**
 * Move tickets to a different column.
 * Handles: optimistic update, resolution auto-coupling, undo, batch API, error rollback.
 * Used by: drag-and-drop, context menu "Send to", keyboard left/right.
 */
export async function moveTickets({
  projectId,
  ticketIds,
  toColumnId,
  toIndex,
  tabId,
  options: { undo = true, optimistic = true, toast = true } = {},
}: MoveTicketsParams): Promise<void> {
  const board = useBoardStore.getState()
  const columns = board.getColumns(projectId)

  // 1. Snapshot for rollback
  const beforeColumns = snapshotColumns(projectId)

  // Find target column
  const targetColumn = columns.find((c) => c.id === toColumnId)
  if (!targetColumn) return

  const insertIndex =
    toIndex ?? targetColumn.tickets.filter((t) => !ticketIds.includes(t.id)).length

  // Collect tickets being moved
  const allTickets = columns.flatMap((c) => c.tickets)
  const movingTickets = ticketIds
    .map((id) => allTickets.find((t) => t.id === id))
    .filter((t): t is TicketWithRelations => t != null)

  // Filter out tickets already in target column
  const actuallyMoving = movingTickets.filter((t) => t.columnId !== toColumnId)
  if (actuallyMoving.length === 0) return

  // Column names for undo toast
  const fromColumnId = actuallyMoving[0].columnId
  const fromColumn = columns.find((c) => c.id === fromColumnId)
  const fromColumnName = fromColumn?.name ?? 'Unknown'
  const toColumnName = targetColumn.name

  // 2. Optimistic store update
  if (optimistic) {
    if (actuallyMoving.length === 1) {
      board.moveTicket(projectId, actuallyMoving[0].id, fromColumnId, toColumnId, insertIndex)
    } else {
      board.moveTickets(
        projectId,
        actuallyMoving.map((t) => t.id),
        toColumnId,
        insertIndex,
      )
    }

    // Resolution auto-coupling: moving to/from Done column sets/clears resolution
    const targetIsDone = isCompletedColumn(targetColumn.name)
    const resolutionUpdates: Array<{ ticketId: string; changes: Partial<TicketWithRelations> }> = []
    for (const ticket of actuallyMoving) {
      const sourceCol = columns.find((c) => c.id === ticket.columnId)
      const sourceIsDone = sourceCol ? isCompletedColumn(sourceCol.name) : false
      if (targetIsDone && !ticket.resolution) {
        resolutionUpdates.push({
          ticketId: ticket.id,
          changes: { resolution: 'Done', resolvedAt: new Date() },
        })
      } else if (!targetIsDone && sourceIsDone && ticket.resolution) {
        resolutionUpdates.push({
          ticketId: ticket.id,
          changes: { resolution: null, resolvedAt: null },
        })
      }
    }
    if (resolutionUpdates.length > 0) {
      const updatedBoard = useBoardStore.getState()
      for (const { ticketId, changes } of resolutionUpdates) {
        updatedBoard.updateTicket(projectId, ticketId, changes)
      }
    }
  }

  const afterColumns = snapshotColumns(projectId)

  // 3. Build moves array for undo
  const moves = actuallyMoving.map((ticket) => ({
    ticketId: ticket.id,
    fromColumnId: ticket.columnId,
    toColumnId,
  }))

  // 4. Undo registration
  if (undo) {
    useUndoStore
      .getState()
      .pushMove(projectId, moves, fromColumnName, toColumnName, beforeColumns, afterColumns)
  }

  // 5. Toast
  if (toast) {
    showUndoRedoToast('success', {
      title:
        actuallyMoving.length === 1
          ? `Moved ticket to ${toColumnName}`
          : `Moved ${actuallyMoving.length} tickets to ${toColumnName}`,
      description: `From ${fromColumnName}`,
    })
  }

  // 6. API persistence
  try {
    if (actuallyMoving.length === 1) {
      const ticket = actuallyMoving[0]
      if (!isDemoMode() && !ticket.id.startsWith('ticket-')) {
        const response = await apiFetch(`/api/projects/${projectId}/tickets/${ticket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
          body: JSON.stringify({ columnId: toColumnId, order: insertIndex }),
        })
        if (!response.ok) throw new Error('Failed to move ticket')
      }
    } else {
      const realTicketIds = actuallyMoving
        .map((t) => t.id)
        .filter((id) => !isDemoMode() && !id.startsWith('ticket-'))
      if (realTicketIds.length > 0) {
        const response = await apiFetch(`/api/projects/${projectId}/tickets`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
          body: JSON.stringify({
            ticketIds: realTicketIds,
            toColumnId,
            newOrder: insertIndex,
          }),
        })
        if (!response.ok) throw new Error('Failed to move tickets')
      }
    }
  } catch (err) {
    // 7. Error rollback
    if (optimistic) {
      useBoardStore.getState().setColumns(projectId, beforeColumns)
    }
    showToast.error(err instanceof Error ? err.message : 'Failed to move tickets')
  }
}

// ─── updateTickets ───────────────────────────────────────────────────────────

/**
 * Update ticket fields (priority, type, sprint, assignee, resolution, etc.).
 * Handles: optimistic update, resolution auto-coupling, undo, API with activity capture, error rollback.
 * Used by: context menu field changes, drawer saves, keyboard shortcuts.
 */
export async function updateTickets({
  projectId,
  updates,
  tabId,
  options: { undo = true, optimistic = true, toast: _toast = false } = {},
}: UpdateTicketsParams): Promise<void> {
  const board = useBoardStore.getState()
  const columns = board.getColumns(projectId)

  // 1. Snapshot for rollback
  const beforeColumns = snapshotColumns(projectId)

  const allTickets = columns.flatMap((c) => c.tickets)
  const undoItems: Array<{
    ticketId: string
    before: TicketWithRelations
    after: TicketWithRelations
  }> = []

  for (const { ticketId, changes } of updates) {
    const ticket = allTickets.find((t) => t.id === ticketId)
    if (!ticket) continue

    // Compute resolution coupling
    const effectiveChanges = { ...changes }

    // Column change -> auto-couple resolution
    if ('columnId' in effectiveChanges && effectiveChanges.columnId) {
      const targetCol = columns.find((c) => c.id === effectiveChanges.columnId)
      if (targetCol) {
        const targetIsDone = isCompletedColumn(targetCol.name)
        if (targetIsDone && !ticket.resolution && !('resolution' in effectiveChanges)) {
          effectiveChanges.resolution = 'Done'
          effectiveChanges.resolvedAt = new Date()
        } else if (!targetIsDone && ticket.resolution && !('resolution' in effectiveChanges)) {
          effectiveChanges.resolution = null
          effectiveChanges.resolvedAt = null
        }
      }
    }

    // Resolution set without column change -> auto-move to done column
    if (
      'resolution' in effectiveChanges &&
      effectiveChanges.resolution &&
      !('columnId' in effectiveChanges)
    ) {
      const currentCol = columns.find((c) => c.tickets.some((t) => t.id === ticketId))
      if (currentCol && !isCompletedColumn(currentCol.name)) {
        const doneCol = columns.find((c) => isCompletedColumn(c.name))
        if (doneCol) {
          effectiveChanges.columnId = doneCol.id
        }
      }
    }

    // Resolution change -> update resolvedAt
    if ('resolution' in effectiveChanges) {
      if (effectiveChanges.resolution && !ticket.resolution) {
        effectiveChanges.resolvedAt = effectiveChanges.resolvedAt ?? new Date()
      } else if (effectiveChanges.resolution === null && ticket.resolution) {
        effectiveChanges.resolvedAt = null
      }
    }

    // Build before/after for undo (full ticket snapshots)
    const afterTicket = { ...ticket, ...effectiveChanges }
    undoItems.push({
      ticketId,
      before: { ...ticket },
      after: afterTicket,
    })

    // 2. Optimistic store update
    if (optimistic) {
      board.updateTicket(projectId, ticketId, effectiveChanges)
    }
  }

  if (undoItems.length === 0) return

  // 3. Undo registration
  if (undo) {
    useUndoStore.getState().pushUpdate(projectId, undoItems)
  }

  // 4. API persistence with activity capture
  try {
    for (const item of undoItems) {
      if (isDemoMode() || item.ticketId.startsWith('ticket-')) continue

      const apiUpdates = toUpdateTicketInput(item.after)
      // Filter to only changed fields
      const changedFields: Record<string, unknown> = {}
      const original = updates.find((u) => u.ticketId === item.ticketId)
      if (original) {
        // Send the effective changes (including auto-coupled fields)
        const effectiveChanges = { ...original.changes }
        // Add any auto-coupled fields from the after state
        if ('resolution' in item.after && !('resolution' in original.changes)) {
          effectiveChanges.resolution = item.after.resolution
          effectiveChanges.resolvedAt = item.after.resolvedAt
        }
        if ('columnId' in item.after && !('columnId' in original.changes)) {
          effectiveChanges.columnId = item.after.columnId
        }
        if ('resolvedAt' in item.after && !('resolvedAt' in original.changes)) {
          effectiveChanges.resolvedAt = item.after.resolvedAt
        }
        const filteredUpdates = toUpdateTicketInput(effectiveChanges)
        Object.assign(changedFields, filteredUpdates)
      }

      const response = await apiFetch(`/api/projects/${projectId}/tickets/${item.ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
        body: JSON.stringify(Object.keys(changedFields).length > 0 ? changedFields : apiUpdates),
      })
      if (!response.ok) throw new Error('Failed to update ticket')
    }
  } catch (err) {
    // 5. Error rollback
    if (optimistic) {
      useBoardStore.getState().setColumns(projectId, beforeColumns)
    }
    showToast.error(err instanceof Error ? err.message : 'Failed to update tickets')
  }
}

// ─── reorderTickets ──────────────────────────────────────────────────────────

/**
 * Reorder tickets within the same column.
 * Handles: optimistic update, undo, API persistence, error rollback.
 * Used by: drag reorder within column, keyboard up/down.
 */
export async function reorderTickets({
  projectId,
  columnId,
  ticketIds,
  targetIndex,
  tabId,
  options: { undo = true, optimistic = true, toast: _toast = false } = {},
}: ReorderTicketsParams): Promise<void> {
  const board = useBoardStore.getState()

  // 1. Snapshot
  const beforeColumns = snapshotColumns(projectId)

  // 2. Optimistic store update
  if (optimistic) {
    if (ticketIds.length === 1) {
      board.reorderTicket(projectId, columnId, ticketIds[0], targetIndex)
    } else {
      board.reorderTickets(projectId, columnId, ticketIds, targetIndex)
    }
  }

  const afterColumns = snapshotColumns(projectId)

  // 3. Undo registration
  if (undo) {
    const column = beforeColumns.find((c) => c.id === columnId)
    const columnName = column?.name ?? 'Unknown'
    const moves = ticketIds.map((id) => ({
      ticketId: id,
      fromColumnId: columnId,
      toColumnId: columnId,
    }))
    useUndoStore
      .getState()
      .pushMove(projectId, moves, columnName, columnName, beforeColumns, afterColumns)
  }

  // 4. API persistence — persist new order for all affected tickets
  try {
    const updatedColumn = useBoardStore
      .getState()
      .getColumns(projectId)
      .find((c) => c.id === columnId)
    if (!updatedColumn) return

    for (const ticket of updatedColumn.tickets) {
      if (isDemoMode() || ticket.id.startsWith('ticket-')) continue
      const apiUpdates = toUpdateTicketInput({
        order: ticket.order,
      } as Partial<TicketWithRelations>)
      const response = await apiFetch(`/api/projects/${projectId}/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tab-Id': tabId },
        body: JSON.stringify(apiUpdates),
      })
      if (!response.ok) throw new Error('Failed to reorder ticket')
    }
  } catch (err) {
    if (optimistic) {
      useBoardStore.getState().setColumns(projectId, beforeColumns)
    }
    showToast.error(err instanceof Error ? err.message : 'Failed to reorder tickets')
  }
}
