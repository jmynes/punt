import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { SPRINT_SELECT_FULL } from '@/lib/prisma-selects'

const startSprintSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

type RouteParams = { params: Promise<{ projectId: string; sprintId: string }> }

/**
 * POST /api/projects/[projectId]/sprints/[sprintId]/start - Start a sprint
 * Requires project admin role
 * - Sets sprint status to 'active'
 * - Only one sprint can be active per project
 * - Creates sprint history entries for all tickets in the sprint
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId, sprintId } = await params

    await requirePermission(user.id, projectId, PERMISSIONS.SPRINTS_MANAGE)

    const body = await request.json().catch(() => ({}))
    const result = startSprintSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const { startDate, endDate } = result.data

    // Check if sprint exists and is in planning status
    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: {
        status: true,
        startDate: true,
        endDate: true,
        tickets: { select: { id: true } },
      },
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    if (sprint.status !== 'planning') {
      return badRequestError('Can only start a sprint that is in planning status')
    }

    // Check if there's already an active sprint
    const activeSprint = await db.sprint.findFirst({
      where: { projectId, status: 'active' },
      select: { id: true, name: true },
    })

    if (activeSprint) {
      return badRequestError(
        `Another sprint "${activeSprint.name}" is already active. Complete it first.`,
      )
    }

    // Use provided dates or existing dates, default to now for startDate
    const finalStartDate = startDate ?? sprint.startDate ?? new Date()
    const finalEndDate = endDate ?? sprint.endDate

    // Start the sprint in a transaction
    const updatedSprint = await db.$transaction(async (tx) => {
      // Update sprint status
      const updated = await tx.sprint.update({
        where: { id: sprintId },
        data: {
          status: 'active',
          startDate: finalStartDate,
          endDate: finalEndDate,
        },
        select: SPRINT_SELECT_FULL,
      })

      // Create sprint history entries for tickets that don't already have one
      if (sprint.tickets.length > 0) {
        const ticketIds = sprint.tickets.map((t) => t.id)

        // Find which tickets already have history entries for this sprint
        const existingHistories = await tx.ticketSprintHistory.findMany({
          where: {
            sprintId,
            ticketId: { in: ticketIds },
          },
          select: { ticketId: true },
        })

        const existingTicketIds = new Set(existingHistories.map((h) => h.ticketId))
        const ticketsToAdd = ticketIds.filter((id) => !existingTicketIds.has(id))

        if (ticketsToAdd.length > 0) {
          await tx.ticketSprintHistory.createMany({
            data: ticketsToAdd.map((ticketId) => ({
              ticketId,
              sprintId,
              entryType: 'added',
            })),
          })
        }
      }

      return updated
    })

    // Emit sprint started event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitSprintEvent({
      type: 'sprint.started',
      projectId,
      sprintId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(updatedSprint)
  } catch (error) {
    return handleApiError(error, 'start sprint')
  }
}
