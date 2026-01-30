import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { SPRINT_SELECT_FULL } from '@/lib/prisma-selects'

const extendSprintSchema = z.object({
  days: z.number().int().min(1).max(90),
  newEndDate: z.coerce.date().optional(),
})

type RouteParams = { params: Promise<{ projectId: string; sprintId: string }> }

/**
 * POST /api/projects/[projectId]/sprints/[sprintId]/extend - Extend sprint end date
 * Requires project admin role
 *
 * Can extend by number of days or set a specific new end date
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, sprintId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requirePermission(user.id, projectId, PERMISSIONS.SPRINTS_MANAGE)

    const body = await request.json()
    const result = extendSprintSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const { days, newEndDate } = result.data

    // Get sprint
    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { status: true, endDate: true },
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    if (sprint.status !== 'active') {
      return badRequestError('Can only extend an active sprint')
    }

    // Calculate new end date
    let calculatedEndDate: Date
    if (newEndDate) {
      calculatedEndDate = newEndDate
    } else {
      const currentEnd = sprint.endDate ?? new Date()
      calculatedEndDate = new Date(currentEnd)
      calculatedEndDate.setDate(calculatedEndDate.getDate() + days)
    }

    // Ensure new end date is in the future
    if (calculatedEndDate <= new Date()) {
      return badRequestError('New end date must be in the future')
    }

    const updatedSprint = await db.sprint.update({
      where: { id: sprintId },
      data: { endDate: calculatedEndDate },
      select: SPRINT_SELECT_FULL,
    })

    return NextResponse.json(updatedSprint)
  } catch (error) {
    return handleApiError(error, 'extend sprint')
  }
}
