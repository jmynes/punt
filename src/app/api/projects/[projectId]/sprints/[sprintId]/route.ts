import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireProjectAdmin, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { SPRINT_SELECT_FULL } from '@/lib/prisma-selects'

const updateSprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
})

type RouteParams = { params: Promise<{ projectId: string; sprintId: string }> }

/**
 * GET /api/projects/[projectId]/sprints/[sprintId] - Get sprint details
 * Requires project membership
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId, sprintId } = await params

    await requireProjectMember(user.id, projectId)

    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: SPRINT_SELECT_FULL,
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    return NextResponse.json(sprint)
  } catch (error) {
    return handleApiError(error, 'fetch sprint')
  }
}

/**
 * PATCH /api/projects/[projectId]/sprints/[sprintId] - Update sprint
 * Requires project admin role
 * Cannot update completed sprints (except name/goal)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId, sprintId } = await params

    await requireProjectAdmin(user.id, projectId)

    const existingSprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { status: true },
    })

    if (!existingSprint) {
      return notFoundError('Sprint')
    }

    const body = await request.json()
    const result = updateSprintSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const { name, goal, startDate, endDate } = result.data

    // For completed sprints, only allow name and goal updates
    if (
      existingSprint.status === 'completed' &&
      (startDate !== undefined || endDate !== undefined)
    ) {
      return badRequestError('Cannot modify dates of a completed sprint')
    }

    const sprint = await db.sprint.update({
      where: { id: sprintId },
      data: {
        ...(name !== undefined && { name }),
        ...(goal !== undefined && { goal }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
      },
      select: SPRINT_SELECT_FULL,
    })

    // Emit sprint updated event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitSprintEvent({
      type: 'sprint.updated',
      projectId,
      sprintId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(sprint)
  } catch (error) {
    return handleApiError(error, 'update sprint')
  }
}

/**
 * DELETE /api/projects/[projectId]/sprints/[sprintId] - Delete sprint
 * Requires project admin role
 * Can only delete planning sprints, not active or completed
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId, sprintId } = await params

    await requireProjectAdmin(user.id, projectId)

    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { status: true, _count: { select: { tickets: true } } },
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    if (sprint.status !== 'planning') {
      return badRequestError('Can only delete sprints in planning status')
    }

    // Remove sprint assignment from tickets first
    await db.ticket.updateMany({
      where: { sprintId },
      data: { sprintId: null },
    })

    // Delete the sprint
    await db.sprint.delete({
      where: { id: sprintId },
    })

    // Emit sprint deleted event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitSprintEvent({
      type: 'sprint.deleted',
      projectId,
      sprintId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete sprint')
  }
}
