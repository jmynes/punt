import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireProjectAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
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

    await requireProjectAdmin(user.id, projectId)

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

      // Create sprint history entries for all tickets in the sprint
      if (sprint.tickets.length > 0) {
        // Note: skipDuplicates not supported by SQLite, unique constraint handles duplicates
        await tx.ticketSprintHistory.createMany({
          data: sprint.tickets.map((ticket) => ({
            ticketId: ticket.id,
            sprintId,
            entryType: 'added',
          })),
        })
      }

      return updated
    })

    return NextResponse.json(updatedSprint)
  } catch (error) {
    return handleApiError(error, 'start sprint')
  }
}
