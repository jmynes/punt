import { NextResponse } from 'next/server'
import { requireAuth, requireMembership } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

// Default columns to create for new projects
// Note: "Backlog" is not a column - tickets without a sprint are in the backlog view
const DEFAULT_COLUMNS = [
  { name: 'To Do', order: 0 },
  { name: 'In Progress', order: 1 },
  { name: 'Review', order: 2 },
  { name: 'Done', order: 3 },
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
    const { projectId } = await params

    // Check project membership
    await requireMembership(user.id, projectId)

    // Check if project exists
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
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch columns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
