import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const createColumnSchema = z.object({
  name: z.string().min(1).max(50),
})

// Default columns to create for new projects
// Note: "Backlog" is not a column - tickets without a sprint are in the backlog view
const DEFAULT_COLUMNS = [
  { name: 'To Do', order: 0 },
  { name: 'In Progress', order: 1 },
  { name: 'Review', order: 2 },
  { name: 'Done', order: 3 },
  { name: "Won't Fix", order: 4 },
]

/**
 * GET /api/projects/[projectId]/columns - Get all columns for a project
 * Creates default columns if none exist
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    // Check if project exists (already verified by requireProjectByKey)
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get existing columns
    let columns = await db.column.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
        projectId: true,
      },
    })

    // If no columns exist, create default ones
    if (columns.length === 0) {
      await db.column.createMany({
        data: DEFAULT_COLUMNS.map((col) => ({
          ...col,
          projectId,
        })),
      })

      // Fetch the newly created columns
      columns = await db.column.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          order: true,
          projectId: true,
        },
      })
    }

    return NextResponse.json(columns)
  } catch (error) {
    return handleApiError(error, 'fetch columns')
  }
}

/**
 * POST /api/projects/[projectId]/columns - Create a new column
 * Requires board.manage permission
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check board.manage permission
    await requirePermission(user.id, projectId, PERMISSIONS.BOARD_MANAGE)

    const body = await request.json()
    const parsed = createColumnSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    // Get the highest order to append the new column
    const lastColumn = await db.column.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const newOrder = (lastColumn?.order ?? -1) + 1

    const column = await db.column.create({
      data: {
        name: parsed.data.name,
        order: newOrder,
        projectId,
      },
      select: {
        id: true,
        name: true,
        order: true,
        projectId: true,
      },
    })

    return NextResponse.json(column, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create column')
  }
}
