import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { SPRINT_SELECT_FULL } from '@/lib/prisma-selects'

type RouteParams = { params: Promise<{ projectId: string }> }

/**
 * GET /api/projects/[projectId]/sprints/active - Get the active sprint
 * Requires project membership
 * Returns null if no active sprint
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    const sprint = await db.sprint.findFirst({
      where: { projectId, status: 'active' },
      select: SPRINT_SELECT_FULL,
    })

    return NextResponse.json(sprint)
  } catch (error) {
    return handleApiError(error, 'fetch active sprint')
  }
}
