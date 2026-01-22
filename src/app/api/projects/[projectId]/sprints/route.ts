import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth, requireProjectAdmin, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { SPRINT_SELECT_FULL } from '@/lib/prisma-selects'

const createSprintSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  goal: z.string().max(500).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
})

/**
 * GET /api/projects/[projectId]/sprints - Get all sprints for a project
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    // Check project membership
    await requireProjectMember(user.id, projectId)

    const sprints = await db.sprint.findMany({
      where: { projectId },
      select: SPRINT_SELECT_FULL,
      orderBy: [
        { status: 'asc' }, // active first (a < c < p)
        { startDate: 'desc' },
        { name: 'asc' },
      ],
    })

    // Sort with custom priority: active > planning > completed
    const statusOrder = { active: 0, planning: 1, completed: 2 }
    sprints.sort((a, b) => {
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3
      if (aOrder !== bOrder) return aOrder - bOrder
      // Within same status, sort by startDate desc, then name
      if (a.startDate && b.startDate) {
        return b.startDate.getTime() - a.startDate.getTime()
      }
      if (a.startDate) return -1
      if (b.startDate) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(sprints)
  } catch (error) {
    return handleApiError(error, 'fetch sprints')
  }
}

/**
 * POST /api/projects/[projectId]/sprints - Create a new sprint
 * Requires project admin role
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    // Check project admin role
    await requireProjectAdmin(user.id, projectId)

    const body = await request.json()
    const result = createSprintSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const { name, goal, startDate, endDate } = result.data

    // Create the sprint with planning status
    const sprint = await db.sprint.create({
      data: {
        name,
        goal,
        startDate,
        endDate,
        status: 'planning',
        projectId,
      },
      select: SPRINT_SELECT_FULL,
    })

    // Emit sprint created event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitSprintEvent({
      type: 'sprint.created',
      projectId,
      sprintId: sprint.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create sprint')
  }
}
