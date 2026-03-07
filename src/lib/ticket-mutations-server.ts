/**
 * Server-side ticket mutation utilities.
 *
 * These helpers consolidate validation and business logic that was
 * previously duplicated across multiple API routes:
 * - POST /api/projects/[projectId]/tickets (create)
 * - PATCH /api/projects/[projectId]/tickets/[ticketId] (update)
 * - PATCH /api/projects/[projectId]/tickets (batch move)
 *
 * IMPORTANT: This module imports from '@/lib/db' and should only be
 * used in server-side code (API routes, server actions).
 */

import { db } from '@/lib/db'
import { isCompletedColumn } from '@/lib/sprint-utils'

// =============================================================================
// Validation helpers
// =============================================================================

/**
 * Validate that a column belongs to a project.
 * Returns the column if valid, null otherwise.
 */
export async function validateColumnInProject(columnId: string, projectId: string) {
  return db.column.findFirst({
    where: { id: columnId, projectId },
  })
}

/**
 * Validate that a user is a member of a project.
 * Returns the membership if valid, null otherwise.
 */
export async function validateProjectMembership(userId: string, projectId: string) {
  return db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
}

/**
 * Validate that multiple users are all members of a project.
 * Returns an array of invalid user IDs (empty if all are valid).
 */
export async function validateMemberships(userIds: string[], projectId: string): Promise<string[]> {
  if (userIds.length === 0) return []

  const validMembers = await db.projectMember.findMany({
    where: { projectId, userId: { in: userIds } },
    select: { userId: true },
  })
  const validUserIds = new Set(validMembers.map((m) => m.userId))
  return userIds.filter((id) => !validUserIds.has(id))
}

/**
 * Validate that a parent ticket exists, belongs to the project, and is not a subtask.
 * For updates, also checks for circular parent chains.
 * Returns an error message string if invalid, null if valid.
 */
export async function validateParentTicket(
  parentId: string,
  projectId: string,
  currentTicketId?: string,
): Promise<string | null> {
  // Prevent direct self-referencing
  if (currentTicketId && parentId === currentTicketId) {
    return 'Cannot set parent: ticket cannot be its own parent'
  }

  const parentTicket = await db.ticket.findFirst({
    where: { id: parentId, projectId },
    select: { type: true },
  })

  if (!parentTicket) {
    return 'Parent ticket not found or does not belong to project'
  }

  if (parentTicket.type === 'subtask') {
    return 'Subtasks cannot have subtasks'
  }

  // For updates, walk up the parent chain to detect cycles
  if (currentTicketId) {
    const MAX_DEPTH = 50
    let currentId: string | null = parentId
    let depth = 0

    while (currentId && depth < MAX_DEPTH) {
      const parent: { parentId: string | null } | null = await db.ticket.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      })

      if (!parent) break

      if (parent.parentId === currentTicketId) {
        return 'Cannot set parent: would create a circular reference'
      }

      currentId = parent.parentId
      depth++
    }

    if (depth >= MAX_DEPTH) {
      return 'Cannot set parent: parent chain exceeds maximum depth'
    }
  }

  return null
}

/**
 * Validate that an unresolved ticket is not being assigned to a completed sprint.
 * Returns an error message string if invalid, null if valid.
 */
export async function validateSprintAssignment(
  sprintId: string,
  projectId: string,
  effectiveResolution: string | null | undefined,
): Promise<string | null> {
  const targetSprint = await db.sprint.findFirst({
    where: { id: sprintId, projectId },
    select: { status: true },
  })

  if (targetSprint?.status === 'completed' && !effectiveResolution) {
    return (
      'Cannot assign an unresolved ticket to a completed sprint. ' +
      'To add a ticket to a completed sprint, it must have a resolution status ' +
      "(e.g., Done, Won't Fix). Otherwise the ticket will be orphaned and not visible in active views."
    )
  }

  return null
}

// =============================================================================
// Resolution <-> Column auto-coupling
// =============================================================================

export interface ResolutionCouplingResult {
  /** Resolution value to set (null to clear, undefined to leave unchanged) */
  resolution?: string | null
  /** ResolvedAt timestamp to set (null to clear, undefined to leave unchanged) */
  resolvedAt?: Date | null
  /** Column ID to move to (undefined to leave unchanged) */
  columnId?: string
}

/**
 * Compute resolution and column auto-coupling changes.
 *
 * Business rules:
 * 1. Moving to a "done" column with no resolution -> auto-set resolution to "Done"
 * 2. Moving out of a "done" column -> auto-clear resolution
 * 3. Setting a resolution while not in a "done" column -> auto-move to first done column
 * 4. Setting a resolution -> set resolvedAt timestamp
 * 5. Clearing a resolution -> clear resolvedAt timestamp
 *
 * This logic was previously duplicated in:
 * - PATCH /api/projects/[projectId]/tickets/[ticketId] (update ticket)
 * - PATCH /api/projects/[projectId]/tickets (batch move)
 *
 * @param params.targetColumnId - The column being moved to (if changing)
 * @param params.existingResolution - The ticket's current resolution
 * @param params.existingColumnName - The ticket's current column name
 * @param params.newResolution - The resolution being set (if changing), undefined if not changing
 * @param params.explicitResolvedAt - Explicit resolvedAt value (for undo/redo)
 * @param params.projectId - Project ID (needed for finding done columns)
 * @returns Changes to apply, with undefined values meaning "no change"
 */
export async function resolveResolutionColumnCoupling(params: {
  targetColumnId?: string
  existingResolution: string | null
  existingColumnName: string
  newResolution?: string | null
  explicitResolvedAt?: Date | null
  projectId: string
}): Promise<ResolutionCouplingResult> {
  const {
    targetColumnId,
    existingResolution,
    existingColumnName,
    newResolution,
    explicitResolvedAt,
    projectId,
  } = params

  const result: ResolutionCouplingResult = {}

  // Rule 1 & 2: Column change triggers resolution auto-coupling
  if (targetColumnId) {
    const targetCol = await db.column.findUnique({
      where: { id: targetColumnId },
      select: { name: true },
    })

    if (targetCol) {
      const targetIsDone = isCompletedColumn(targetCol.name)

      if (targetIsDone && newResolution === undefined && !existingResolution) {
        // Moving to done column with no resolution -> auto-set "Done"
        result.resolution = 'Done'
        result.resolvedAt = explicitResolvedAt ?? new Date()
      } else if (!targetIsDone && newResolution === undefined && existingResolution) {
        // Moving out of done column -> auto-clear resolution
        result.resolution = null
        result.resolvedAt = null
      }
    }
  }

  // Rule 3: Setting a resolution while not in a done column -> auto-move
  const effectiveResolution = result.resolution !== undefined ? result.resolution : newResolution
  if (effectiveResolution && !targetColumnId) {
    if (!isCompletedColumn(existingColumnName)) {
      const allCols = await db.column.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true },
      })
      const doneColumn = allCols.find((c) => isCompletedColumn(c.name))
      if (doneColumn) {
        result.columnId = doneColumn.id
      }
    }
  }

  // Rule 4 & 5: Resolution change triggers resolvedAt tracking
  // (only if not already handled by column coupling above)
  if (newResolution !== undefined && result.resolution === undefined) {
    if (newResolution && !existingResolution) {
      // Resolution being set -> set resolvedAt
      result.resolvedAt = explicitResolvedAt ?? new Date()
    } else if (newResolution === null && existingResolution) {
      // Resolution being cleared -> clear resolvedAt
      result.resolvedAt = null
    }
  }

  return result
}

// =============================================================================
// Sprint history tracking
// =============================================================================

/**
 * Track sprint history when a ticket's sprint assignment changes.
 * Closes the old sprint entry and creates a new one.
 *
 * This was previously inline in the update ticket API route.
 */
export async function trackSprintChange(
  ticketId: string,
  oldSprintId: string | null,
  newSprintId: string | null | undefined,
): Promise<void> {
  if (newSprintId === undefined || newSprintId === oldSprintId) return

  // Close existing history entry for old sprint
  if (oldSprintId) {
    await db.ticketSprintHistory.updateMany({
      where: {
        ticketId,
        sprintId: oldSprintId,
        exitStatus: null,
      },
      data: {
        exitStatus: 'removed',
        removedAt: new Date(),
      },
    })
  }

  // Create history entry for new sprint
  if (newSprintId) {
    const existing = await db.ticketSprintHistory.findUnique({
      where: { ticketId_sprintId: { ticketId, sprintId: newSprintId } },
    })
    if (!existing) {
      await db.ticketSprintHistory.create({
        data: {
          ticketId,
          sprintId: newSprintId,
          entryType: 'added',
        },
      })
    }
  }
}

// =============================================================================
// SSE event emission
// =============================================================================

/**
 * Determine the appropriate SSE event type for a ticket update.
 */
export function getTicketUpdateEventType(
  columnChanged: boolean,
  sprintChanged: boolean,
): 'ticket.moved' | 'ticket.sprint_changed' | 'ticket.updated' {
  if (columnChanged) return 'ticket.moved'
  if (sprintChanged) return 'ticket.sprint_changed'
  return 'ticket.updated'
}
