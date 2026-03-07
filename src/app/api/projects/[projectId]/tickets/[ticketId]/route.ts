import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import {
  computeTicketChanges,
  createActivityGroupId,
  logBatchChanges,
  logTicketActivity,
} from '@/lib/audit'
import {
  requireAuth,
  requireMembership,
  requireProjectByKey,
  requireTicketPermission,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { TICKET_SELECT_FULL, transformTicket } from '@/lib/prisma-selects'
import {
  getTicketUpdateEventType,
  resolveResolutionColumnCoupling,
  trackSprintChange,
  validateColumnInProject,
  validateMemberships,
  validateParentTicket,
  validateProjectMembership,
  validateSprintAssignment,
} from '@/lib/ticket-mutations-server'
import { type IssueType, type Priority, RESOLUTIONS } from '@/types'

const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']).optional(),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).optional(),
  columnId: z.string().min(1).optional(),
  order: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  estimate: z.string().nullable().optional(),
  resolution: z.enum(RESOLUTIONS).nullable().optional(),
  // For undo/redo operations - preserve original resolvedAt timestamp
  resolvedAt: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  startDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  environment: z.string().nullable().optional(),
  affectedVersion: z.string().nullable().optional(),
  fixVersion: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  watcherIds: z.array(z.string()).optional(),
})

/**
 * GET /api/projects/[projectId]/tickets/[ticketId] - Get a single ticket
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: TICKET_SELECT_FULL,
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    return NextResponse.json(transformTicket(ticket))
  } catch (error) {
    return handleApiError(error, 'fetch ticket')
  }
}

/**
 * PATCH /api/projects/[projectId]/tickets/[ticketId] - Update a ticket
 * Requires project membership
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check if ticket exists and belongs to project, get creator for permission check
    // Select all mutable fields for audit trail diffing
    const existingTicket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        columnId: true,
        assigneeId: true,
        creatorId: true,
        sprintId: true,
        parentId: true,
        storyPoints: true,
        estimate: true,
        resolution: true,
        resolvedAt: true,
        startDate: true,
        dueDate: true,
        environment: true,
        affectedVersion: true,
        fixVersion: true,
        column: { select: { name: true, icon: true, color: true } },
        assignee: {
          select: { id: true, name: true, username: true, avatar: true, avatarColor: true },
        },
        sprint: { select: { name: true } },
        labels: { select: { id: true } },
      },
    })

    if (!existingTicket) {
      return notFoundError('Ticket')
    }

    // Check ticket edit permission (own ticket or any ticket)
    await requireTicketPermission(user.id, projectId, existingTicket.creatorId, 'edit')

    const body = await request.json()
    const parsed = updateTicketSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { labelIds, watcherIds, reporterId, ...updateData } = parsed.data

    // If changing column, verify new column belongs to project
    if (updateData.columnId && updateData.columnId !== existingTicket.columnId) {
      const column = await validateColumnInProject(updateData.columnId, projectId)
      if (!column) {
        return badRequestError('Column not found or does not belong to project')
      }
    }

    // Validate parentId: prevent self-referencing and circular parent chains
    if (updateData.parentId !== undefined && updateData.parentId !== null) {
      const parentError = await validateParentTicket(updateData.parentId, projectId, ticketId)
      if (parentError) {
        return badRequestError(parentError)
      }
    }

    // Prevent changing type to subtask if ticket has children
    if (updateData.type === 'subtask' && existingTicket.type !== 'subtask') {
      const childCount = await db.ticket.count({
        where: { parentId: ticketId },
      })
      if (childCount > 0) {
        return badRequestError('Cannot make a ticket with subtasks into a subtask')
      }
    }

    // Validate assigneeId is a project member (if provided and not null)
    if (updateData.assigneeId !== undefined && updateData.assigneeId !== null) {
      const membership = await validateProjectMembership(updateData.assigneeId, projectId)
      if (!membership) {
        return badRequestError('Assignee must be a project member')
      }
    }

    // Validate reporterId is a project member (if provided and not null)
    if (reporterId !== undefined && reporterId !== null) {
      const membership = await validateProjectMembership(reporterId, projectId)
      if (!membership) {
        return badRequestError('Reporter must be a project member')
      }
    }

    // Validate all watcherIds are project members (if provided)
    if (watcherIds !== undefined && watcherIds.length > 0) {
      const invalidWatchers = await validateMemberships(watcherIds, projectId)
      if (invalidWatchers.length > 0) {
        return badRequestError('All watchers must be project members')
      }
    }

    // Build update data, filtering out undefined values
    const dbUpdateData: Record<string, unknown> = {}

    // Handle scalar fields
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        dbUpdateData[key] = value
      }
    }

    // Map reporterId to creatorId (API uses "reporter", DB uses "creator")
    if (reporterId !== undefined) {
      dbUpdateData.creatorId = reporterId
    }

    // Cast type and priority if provided
    if (dbUpdateData.type) {
      dbUpdateData.type = dbUpdateData.type as IssueType
    }
    if (dbUpdateData.priority) {
      dbUpdateData.priority = dbUpdateData.priority as Priority
    }

    // Auto-couple resolution ↔ column status
    const coupling = await resolveResolutionColumnCoupling({
      targetColumnId: dbUpdateData.columnId as string | undefined,
      existingResolution: existingTicket.resolution,
      existingColumnName: existingTicket.column.name,
      newResolution: dbUpdateData.resolution as string | null | undefined,
      explicitResolvedAt: dbUpdateData.resolvedAt as Date | null | undefined,
      projectId,
    })

    // Apply coupling results
    if (coupling.resolution !== undefined) dbUpdateData.resolution = coupling.resolution
    if (coupling.resolvedAt !== undefined) dbUpdateData.resolvedAt = coupling.resolvedAt
    if (coupling.columnId !== undefined) dbUpdateData.columnId = coupling.columnId

    // Handle labels relation
    if (labelIds !== undefined) {
      dbUpdateData.labels = {
        set: labelIds.map((id) => ({ id })),
      }
    }

    // Handle watchers relation
    if (watcherIds !== undefined) {
      // Delete existing watchers and create new ones
      await db.ticketWatcher.deleteMany({
        where: { ticketId },
      })

      if (watcherIds.length > 0) {
        await db.ticketWatcher.createMany({
          data: watcherIds.map((userId) => ({ ticketId, userId })),
        })
      }
    }

    // Validate: prevent assigning unresolved tickets to completed sprints
    const newSprintId = updateData.sprintId
    if (
      newSprintId !== undefined &&
      newSprintId !== null &&
      newSprintId !== existingTicket.sprintId
    ) {
      const effectiveResolution =
        dbUpdateData.resolution !== undefined
          ? (dbUpdateData.resolution as string | null)
          : existingTicket.resolution
      const sprintError = await validateSprintAssignment(
        newSprintId as string,
        projectId,
        effectiveResolution,
      )
      if (sprintError) {
        return badRequestError(sprintError)
      }
    }

    // Validate: prevent clearing resolution on a ticket already in a completed sprint
    if (
      dbUpdateData.resolution === null &&
      existingTicket.resolution &&
      (newSprintId === undefined || newSprintId === existingTicket.sprintId) &&
      existingTicket.sprintId
    ) {
      const currentSprint = await db.sprint.findFirst({
        where: { id: existingTicket.sprintId, projectId },
        select: { status: true },
      })
      if (currentSprint?.status === 'completed') {
        return badRequestError(
          'Cannot clear the resolution of a ticket in a completed sprint. ' +
            'Remove the ticket from the completed sprint first, or set a different resolution.',
        )
      }
    }

    // Track sprint history when sprintId changes
    await trackSprintChange(ticketId, existingTicket.sprintId, newSprintId)

    const ticket = await db.ticket
      .update({
        where: { id: ticketId },
        data: dbUpdateData,
        select: TICKET_SELECT_FULL,
      })
      .catch((dbError) => {
        console.error('Prisma update error:', dbError)
        console.error('Update data was:', JSON.stringify(dbUpdateData, null, 2))
        throw dbError
      })

    // Log changes to audit trail (fire-and-forget)
    const oldSnapshot: Record<string, unknown> = {
      title: existingTicket.title,
      description: existingTicket.description,
      type: existingTicket.type,
      priority: existingTicket.priority,
      columnId: existingTicket.columnId,
      assigneeId: existingTicket.assigneeId,
      creatorId: existingTicket.creatorId,
      sprintId: existingTicket.sprintId,
      parentId: existingTicket.parentId,
      storyPoints: existingTicket.storyPoints,
      estimate: existingTicket.estimate,
      resolution: existingTicket.resolution,
      startDate: existingTicket.startDate,
      dueDate: existingTicket.dueDate,
      environment: existingTicket.environment,
      affectedVersion: existingTicket.affectedVersion,
      fixVersion: existingTicket.fixVersion,
    }

    // Build audit update data, handling labels specially
    const auditUpdateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(dbUpdateData)) {
      if (value !== undefined && key !== 'labels') {
        auditUpdateData[key] = value
      }
    }

    // Track label changes separately
    if (labelIds !== undefined) {
      const oldLabelIds = existingTicket.labels.map((l) => l.id).sort()
      const newLabelIds = [...labelIds].sort()
      auditUpdateData.labels = newLabelIds
      oldSnapshot.labels = oldLabelIds
    }

    const changes = computeTicketChanges(oldSnapshot, auditUpdateData)
    // Pre-generate groupId for activity tracking (used by undo system)
    const activityGroupId = changes.length > 1 ? createActivityGroupId() : null
    let activityIds: string[] = []

    if (changes.length > 0) {
      // Resolve raw IDs to human-readable names and metadata before storing in the audit trail.
      // The updated `ticket` has the new related records; the existing query has the old ones.
      // Store JSON metadata for rich display (icons, avatars, etc.)
      const resolvedChanges = changes.map((change) => {
        if (change.field === 'columnId') {
          // Store column metadata as JSON for rendering icons in activity timeline
          return {
            field: 'status',
            oldValue: existingTicket.column
              ? JSON.stringify({
                  name: existingTicket.column.name,
                  icon: existingTicket.column.icon,
                  color: existingTicket.column.color,
                })
              : change.oldValue,
            newValue: ticket.column
              ? JSON.stringify({
                  name: ticket.column.name,
                  icon: ticket.column.icon,
                  color: ticket.column.color,
                })
              : change.newValue,
          }
        }
        if (change.field === 'assigneeId') {
          // Store just the user ID - will be resolved to full user data at query time
          return {
            field: 'assignee',
            oldValue: existingTicket.assigneeId ?? null,
            newValue: ticket.assigneeId ?? null,
          }
        }
        if (change.field === 'sprintId') {
          return {
            field: 'sprint',
            oldValue: existingTicket.sprint?.name ?? change.oldValue,
            newValue: ticket.sprint?.name ?? change.newValue,
          }
        }
        return change
      })
      // Await to get activity IDs for undo support
      const result = await logBatchChanges(
        ticketId,
        user.id,
        resolvedChanges,
        activityGroupId ?? undefined,
      )
      activityIds = result.activityIds
    }

    // Log blocker status transitions when resolution changes on a blocking ticket
    const resolutionChanged =
      dbUpdateData.resolution !== undefined && dbUpdateData.resolution !== existingTicket.resolution
    if (resolutionChanged) {
      const ticketKey = `${ticket.project.key}-${ticket.number}`
      // Find tickets that this ticket blocks (outward "blocks" links)
      const blocksLinks = await db.ticketLink.findMany({
        where: { fromTicketId: ticketId, linkType: 'blocks' },
        select: {
          toTicketId: true,
          toTicket: { select: { id: true } },
        },
      })
      // Also find tickets where this ticket is the blocker via inward "is_blocked_by" links
      const isBlockedByLinks = await db.ticketLink.findMany({
        where: { toTicketId: ticketId, linkType: 'is_blocked_by' },
        select: {
          fromTicketId: true,
          fromTicket: { select: { id: true } },
        },
      })

      // Collect all blocked ticket IDs
      const blockedTicketIds = [
        ...blocksLinks.map((l) => l.toTicketId),
        ...isBlockedByLinks.map((l) => l.fromTicketId),
      ]

      if (blockedTicketIds.length > 0) {
        const newResolution = dbUpdateData.resolution as string | null

        if (newResolution && !existingTicket.resolution) {
          // Blocker resolved
          for (const blockedId of blockedTicketIds) {
            logTicketActivity(blockedId, user.id, 'blocker_resolved', {
              field: 'blocker',
              newValue: JSON.stringify({
                ticketKey,
                ticketId,
                resolution: newResolution,
              }),
            })
          }

          // Check if this was the last active blocker for each blocked ticket
          for (const blockedId of blockedTicketIds) {
            // For "blocks" links TO the blocked ticket, the blocker is the fromTicket
            // For "is_blocked_by" links FROM the blocked ticket, the blocker is the toTicket
            const blockerLinksOutward = await db.ticketLink.findMany({
              where: { toTicketId: blockedId, linkType: 'blocks' },
              select: { fromTicketId: true },
            })
            const blockerLinksInward = await db.ticketLink.findMany({
              where: { fromTicketId: blockedId, linkType: 'is_blocked_by' },
              select: { toTicketId: true },
            })

            const allBlockerIds = [
              ...blockerLinksOutward.map((l) => l.fromTicketId),
              ...blockerLinksInward.map((l) => l.toTicketId),
            ]

            // Check if all blockers are now resolved
            if (allBlockerIds.length > 0) {
              const unresolvedBlockers = await db.ticket.count({
                where: {
                  id: { in: allBlockerIds },
                  resolution: null,
                },
              })
              if (unresolvedBlockers === 0) {
                logTicketActivity(blockedId, user.id, 'unblocked', {
                  field: 'blocker',
                })
              }
            }
          }
        } else if (!newResolution && existingTicket.resolution) {
          // Blocker reopened (resolution cleared)
          for (const blockedId of blockedTicketIds) {
            logTicketActivity(blockedId, user.id, 'blocker_reopened', {
              field: 'blocker',
              newValue: JSON.stringify({ ticketKey, ticketId }),
            })
          }
        }
      }
    }

    // Emit real-time event for other clients
    const columnChanged = !!(
      dbUpdateData.columnId && dbUpdateData.columnId !== existingTicket.columnId
    )
    const sprintChanged =
      updateData.sprintId !== undefined && updateData.sprintId !== existingTicket.sprintId
    const tabId = request.headers.get('X-Tab-Id') || undefined

    projectEvents.emitTicketEvent({
      type: getTicketUpdateEventType(columnChanged, sprintChanged),
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      ...transformTicket(ticket),
      _activity: {
        activityIds,
        groupId: activityGroupId,
      },
    })
  } catch (error) {
    return handleApiError(error, 'update ticket')
  }
}

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId] - Delete a ticket
 * Requires project membership
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check if ticket exists and belongs to project, get creator for permission check
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: {
        id: true,
        number: true,
        creatorId: true,
        project: { select: { key: true } },
      },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    // Check ticket delete permission (own ticket or any ticket)
    await requireTicketPermission(user.id, projectId, ticket.creatorId, 'delete')

    // Before deletion, find tickets that this ticket blocks and log blocker_deleted
    const ticketKey = `${ticket.project.key}-${ticket.number}`
    const blocksLinks = await db.ticketLink.findMany({
      where: { fromTicketId: ticketId, linkType: 'blocks' },
      select: { toTicketId: true },
    })
    const isBlockedByLinks = await db.ticketLink.findMany({
      where: { toTicketId: ticketId, linkType: 'is_blocked_by' },
      select: { fromTicketId: true },
    })
    const blockedTicketIds = [
      ...blocksLinks.map((l) => l.toTicketId),
      ...isBlockedByLinks.map((l) => l.fromTicketId),
    ]

    // Delete the ticket (cascades to watchers, comments, attachments, links, etc.)
    await db.ticket.delete({
      where: { id: ticketId },
    })

    // Log blocker_deleted on all previously blocked tickets (fire-and-forget)
    for (const blockedId of blockedTicketIds) {
      logTicketActivity(blockedId, user.id, 'blocker_deleted', {
        field: 'blocker',
        oldValue: JSON.stringify({ ticketKey, ticketId }),
      })
    }

    // Check if any blocked ticket is now fully unblocked
    for (const blockedId of blockedTicketIds) {
      // After the blocking ticket is deleted, check remaining blockers
      const remainingBlockersOutward = await db.ticketLink.findMany({
        where: { toTicketId: blockedId, linkType: 'blocks' },
        select: { fromTicketId: true },
      })
      const remainingBlockersInward = await db.ticketLink.findMany({
        where: { fromTicketId: blockedId, linkType: 'is_blocked_by' },
        select: { toTicketId: true },
      })
      const allRemainingBlockerIds = [
        ...remainingBlockersOutward.map((l) => l.fromTicketId),
        ...remainingBlockersInward.map((l) => l.toTicketId),
      ]

      if (allRemainingBlockerIds.length === 0) {
        // No more blockers at all
        logTicketActivity(blockedId, user.id, 'unblocked', {
          field: 'blocker',
        })
      } else {
        // Check if all remaining blockers are resolved
        const unresolvedBlockers = await db.ticket.count({
          where: {
            id: { in: allRemainingBlockerIds },
            resolution: null,
          },
        })
        if (unresolvedBlockers === 0) {
          logTicketActivity(blockedId, user.id, 'unblocked', {
            field: 'blocker',
          })
        }
      }
    }

    // Emit real-time event for other clients
    // Include tabId from header so the originating tab can skip the event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.deleted',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete ticket')
  }
}
