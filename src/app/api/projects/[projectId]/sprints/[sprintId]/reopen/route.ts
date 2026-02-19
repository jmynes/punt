import { NextResponse } from 'next/server'
import { badRequestError, handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { SPRINT_SELECT_FULL } from '@/lib/prisma-selects'

type RouteParams = { params: Promise<{ projectId: string; sprintId: string }> }

/**
 * POST /api/projects/[projectId]/sprints/[sprintId]/reopen - Reopen a completed sprint
 * Requires SPRINTS_MANAGE permission
 * - Only works on completed sprints
 * - Fails if there's already an active sprint
 * - Sets sprint status back to 'active'
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, sprintId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requirePermission(user.id, projectId, PERMISSIONS.SPRINTS_MANAGE)

    // Check if sprint exists and is completed
    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { status: true },
    })

    if (!sprint) {
      return notFoundError('Sprint')
    }

    if (sprint.status !== 'completed') {
      return badRequestError('Can only reopen a completed sprint')
    }

    // Check if there's already an active sprint
    const activeSprint = await db.sprint.findFirst({
      where: { projectId, status: 'active' },
      select: { id: true, name: true },
    })

    if (activeSprint) {
      return badRequestError(
        `Another sprint "${activeSprint.name}" is already active. Complete it first before reopening this sprint.`,
      )
    }

    // Reopen the sprint
    const updatedSprint = await db.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'active',
        // Clear completion metadata since sprint is no longer completed
        completedAt: null,
        completedById: null,
      },
      select: SPRINT_SELECT_FULL,
    })

    // Emit sprint reopened event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitSprintEvent({
      type: 'sprint.reopened',
      projectId,
      sprintId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(updatedSprint)
  } catch (error) {
    return handleApiError(error, 'reopen sprint')
  }
}
