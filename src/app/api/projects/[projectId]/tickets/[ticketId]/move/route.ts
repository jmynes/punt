import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { TICKET_SELECT_FULL, transformTicket } from '@/lib/prisma-selects'

const moveTicketSchema = z.object({
  targetProjectId: z.string().min(1, 'Target project ID is required'),
})

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/move - Move a ticket to another project
 *
 * This endpoint moves a ticket from one project to another. It:
 * - Validates user has access to both source and target projects
 * - Generates a new ticket number in the target project
 * - Clears project-scoped fields: sprintId, labelIds, parentId
 * - Assigns the ticket to the first column of the target project
 * - Clears assigneeId if the assignee is not a member of the target project
 * - Clears watchers who are not members of the target project
 * - Removes ticket links (as linked tickets may be in different projects)
 * - Preserves: title, description, type, priority, storyPoints, etc.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: sourceProjectKey, ticketId } = await params
    const sourceProjectId = await requireProjectByKey(sourceProjectKey)

    // Check source project membership
    await requireMembership(user.id, sourceProjectId)

    // Parse and validate request body
    const body = await request.json()
    const parsed = moveTicketSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { targetProjectId: targetProjectKey } = parsed.data

    // Resolve target project key to ID
    const targetProjectId = await requireProjectByKey(targetProjectKey).catch(() => null)
    if (!targetProjectId) {
      return notFoundError('Target project')
    }

    // Check target project membership
    await requireMembership(user.id, targetProjectId)

    // Prevent moving to the same project
    if (sourceProjectId === targetProjectId) {
      return badRequestError('Cannot move ticket to the same project')
    }

    // Get the ticket with full details
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId: sourceProjectId },
      select: {
        ...TICKET_SELECT_FULL,
        // Also get watcher user IDs for filtering
        watchers: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true,
                avatar: true,
                avatarColor: true,
              },
            },
          },
        },
      },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    // Get the first column of the target project
    const targetColumn = await db.column.findFirst({
      where: { projectId: targetProjectId },
      orderBy: { order: 'asc' },
    })

    if (!targetColumn) {
      return badRequestError('Target project has no columns')
    }

    // Check if assignee is a member of the target project
    let newAssigneeId: string | null = null
    if (ticket.assigneeId) {
      const assigneeMembership = await db.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: ticket.assigneeId,
            projectId: targetProjectId,
          },
        },
      })
      if (assigneeMembership) {
        newAssigneeId = ticket.assigneeId
      }
    }

    // Get list of watchers who are members of the target project
    const watcherUserIds = ticket.watchers.map((w) => w.userId)
    let validWatcherIds: string[] = []
    if (watcherUserIds.length > 0) {
      const validMembers = await db.projectMember.findMany({
        where: {
          projectId: targetProjectId,
          userId: { in: watcherUserIds },
        },
        select: { userId: true },
      })
      validWatcherIds = validMembers.map((m) => m.userId)
    }

    // Move the ticket in a transaction
    const movedTicket = await db.$transaction(async (tx) => {
      // Get max ticket number for target project
      const maxResult = await tx.ticket.aggregate({
        where: { projectId: targetProjectId },
        _max: { number: true },
      })
      const nextNumber = (maxResult._max.number ?? 0) + 1

      // Get max order in target column
      const maxOrderResult = await tx.ticket.aggregate({
        where: { columnId: targetColumn.id },
        _max: { order: true },
      })
      const nextOrder = (maxOrderResult._max.order ?? -1) + 1

      // Delete existing ticket links (they're project-scoped)
      await tx.ticketLink.deleteMany({
        where: {
          OR: [{ fromTicketId: ticketId }, { toTicketId: ticketId }],
        },
      })

      // Delete existing watchers (will recreate valid ones)
      await tx.ticketWatcher.deleteMany({
        where: { ticketId },
      })

      // Update the ticket
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          projectId: targetProjectId,
          number: nextNumber,
          columnId: targetColumn.id,
          order: nextOrder,
          // Clear project-scoped fields
          sprintId: null,
          parentId: null,
          // Clear assignee if not a member of target project
          assigneeId: newAssigneeId,
          // Clear labels (they're project-scoped)
          labels: { set: [] },
          // Clear carryover tracking (sprint-related)
          isCarriedOver: false,
          carriedFromSprintId: null,
          carriedOverCount: 0,
          // Clear resolution tracking (may have different done columns)
          resolution: null,
          resolvedAt: null,
        },
        select: TICKET_SELECT_FULL,
      })

      // Recreate watchers for valid members
      if (validWatcherIds.length > 0) {
        await tx.ticketWatcher.createMany({
          data: validWatcherIds.map((userId) => ({ ticketId, userId })),
        })
      }

      // Re-fetch to get updated watchers
      const finalTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: TICKET_SELECT_FULL,
      })

      return finalTicket
    })

    if (!movedTicket) {
      return badRequestError('Failed to move ticket')
    }

    // Emit real-time events
    const tabId = request.headers.get('X-Tab-Id') || undefined

    // Emit delete event for source project (so it disappears from source board)
    projectEvents.emitTicketEvent({
      type: 'ticket.deleted',
      projectId: sourceProjectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    // Emit create event for target project (so it appears on target board)
    projectEvents.emitTicketEvent({
      type: 'ticket.created',
      projectId: targetProjectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      ticket: transformTicket(movedTicket),
      sourceProjectId,
      targetProjectId,
    })
  } catch (error) {
    return handleApiError(error, 'move ticket')
  }
}
