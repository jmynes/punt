import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { SPRINT_SELECT_FULL, SPRINT_SELECT_SUMMARY } from '@/lib/prisma-selects'
import { generateNextSprintName, isCompletedColumn } from '@/lib/sprint-utils'

const completeSprintSchema = z.object({
  action: z.enum(['close_to_next', 'close_to_backlog', 'close_keep']),
  targetSprintId: z.string().optional(),
  createNextSprint: z.boolean().optional(),
  doneColumnIds: z.array(z.string()).optional(),
})

type RouteParams = { params: Promise<{ projectId: string; sprintId: string }> }

/**
 * POST /api/projects/[projectId]/sprints/[sprintId]/complete - Complete a sprint
 * Requires project admin role
 *
 * Actions:
 * - close_to_next: Move incomplete tickets to target sprint (or create new one)
 * - close_to_backlog: Move incomplete tickets back to backlog (sprintId = null)
 * - close_keep: Keep incomplete tickets in the sprint (for historical purposes)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId, sprintId } = await params

    await requirePermission(user.id, projectId, PERMISSIONS.SPRINTS_MANAGE)

    const body = await request.json()
    const result = completeSprintSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const { action, targetSprintId, createNextSprint, doneColumnIds } = result.data

    // Get sprint with tickets and columns
    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: {
        id: true,
        name: true,
        status: true,
        tickets: {
          select: {
            id: true,
            storyPoints: true,
            columnId: true,
            column: { select: { name: true } },
          },
        },
      },
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    if (sprint.status !== 'active') {
      return badRequestError('Can only complete an active sprint')
    }

    // Get project columns to determine which are "done"
    const columns = await db.column.findMany({
      where: { projectId },
      select: { id: true, name: true },
    })

    // Determine done column IDs
    const doneIds =
      doneColumnIds ?? columns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id)

    // Categorize tickets
    const completedTickets = sprint.tickets.filter((t) => doneIds.includes(t.columnId))
    const incompleteTickets = sprint.tickets.filter((t) => !doneIds.includes(t.columnId))

    // Calculate metrics
    const completedTicketCount = completedTickets.length
    const incompleteTicketCount = incompleteTickets.length
    const completedStoryPoints = completedTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
    const incompleteStoryPoints = incompleteTickets.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    )

    const ticketDisposition = {
      completed: completedTickets.map((t) => t.id),
      movedToBacklog: [] as string[],
      carriedOver: [] as string[],
    }

    // Handle incomplete tickets based on action
    // Using `any` since Prisma return types don't match our interface exactly
    // biome-ignore lint/suspicious/noExplicitAny: Prisma select return type
    let nextSprint: any = null

    const updatedSprint = await db.$transaction(async (tx) => {
      // Determine target for incomplete tickets
      if (action === 'close_to_next' && incompleteTickets.length > 0) {
        let targetId = targetSprintId

        // Create next sprint if requested
        if (createNextSprint || !targetId) {
          const nextSprintName = generateNextSprintName(sprint.name)
          const created = await tx.sprint.create({
            data: {
              name: nextSprintName,
              status: 'planning',
              projectId,
            },
            select: SPRINT_SELECT_SUMMARY,
          })
          targetId = created.id
          nextSprint = created
        } else {
          // Verify target sprint exists and is in planning status
          const target = await tx.sprint.findFirst({
            where: { id: targetId, projectId, status: 'planning' },
            select: SPRINT_SELECT_SUMMARY,
          })
          if (!target) {
            throw new Error('Target sprint not found or not in planning status')
          }
          nextSprint = target
        }

        // Move incomplete tickets to target sprint
        await tx.ticket.updateMany({
          where: { id: { in: incompleteTickets.map((t) => t.id) } },
          data: {
            sprintId: targetId,
            isCarriedOver: true,
            carriedFromSprintId: sprintId,
            carriedOverCount: { increment: 1 },
          },
        })

        // Update sprint history for incomplete tickets
        await tx.ticketSprintHistory.updateMany({
          where: {
            ticketId: { in: incompleteTickets.map((t) => t.id) },
            sprintId,
            exitStatus: null,
          },
          data: {
            exitStatus: 'carried_over',
            removedAt: new Date(),
          },
        })

        // Create new sprint history entries for carried over tickets
        // targetId is guaranteed to be set at this point (either from create or targetSprintId)
        const confirmedTargetId = targetId as string
        const incompleteTicketIds = incompleteTickets.map((t) => t.id)

        // Find which tickets already have history entries for target sprint
        const existingHistories = await tx.ticketSprintHistory.findMany({
          where: {
            sprintId: confirmedTargetId,
            ticketId: { in: incompleteTicketIds },
          },
          select: { ticketId: true },
        })

        const existingTicketIds = new Set(existingHistories.map((h) => h.ticketId))
        const ticketsToAdd = incompleteTicketIds.filter((id) => !existingTicketIds.has(id))

        if (ticketsToAdd.length > 0) {
          await tx.ticketSprintHistory.createMany({
            data: ticketsToAdd.map((ticketId) => ({
              ticketId,
              sprintId: confirmedTargetId,
              entryType: 'carried_over' as const,
              carriedFromSprintId: sprintId,
            })),
          })
        }

        ticketDisposition.carriedOver = incompleteTickets.map((t) => t.id)
      } else if (action === 'close_to_backlog' && incompleteTickets.length > 0) {
        // Move incomplete tickets to backlog
        await tx.ticket.updateMany({
          where: { id: { in: incompleteTickets.map((t) => t.id) } },
          data: { sprintId: null },
        })

        // Update sprint history
        await tx.ticketSprintHistory.updateMany({
          where: {
            ticketId: { in: incompleteTickets.map((t) => t.id) },
            sprintId,
            exitStatus: null,
          },
          data: {
            exitStatus: 'removed',
            removedAt: new Date(),
          },
        })

        ticketDisposition.movedToBacklog = incompleteTickets.map((t) => t.id)
      }
      // For 'close_keep', tickets stay in the sprint

      // Update sprint history for completed tickets
      await tx.ticketSprintHistory.updateMany({
        where: {
          ticketId: { in: completedTickets.map((t) => t.id) },
          sprintId,
          exitStatus: null,
        },
        data: {
          exitStatus: 'completed',
          removedAt: new Date(),
        },
      })

      // Complete the sprint
      const completed = await tx.sprint.update({
        where: { id: sprintId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          completedById: user.id,
          completedTicketCount,
          incompleteTicketCount,
          completedStoryPoints,
          incompleteStoryPoints,
        },
        select: SPRINT_SELECT_FULL,
      })

      return completed
    })

    // Emit sprint completed event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitSprintEvent({
      type: 'sprint.completed',
      projectId,
      sprintId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    // If a new sprint was created, emit that event too
    if (nextSprint) {
      projectEvents.emitSprintEvent({
        type: 'sprint.created',
        projectId,
        sprintId: nextSprint.id,
        userId: user.id,
        tabId,
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({
      sprint: updatedSprint,
      ticketDisposition,
      nextSprint,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Target sprint')) {
      return badRequestError(error.message)
    }
    return handleApiError(error, 'complete sprint')
  }
}
