import { NextResponse } from 'next/server'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'

/**
 * GET /api/admin/users/[username]/available-projects
 * Returns projects the user is NOT a member of (for adding them to projects).
 * Includes roles for each project so the admin can select one.
 * Requires system admin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    await requireSystemAdmin()
    const { username } = await params

    if (isDemoMode()) {
      return NextResponse.json([])
    }

    // Look up the target user
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        projects: {
          select: { projectId: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const memberProjectIds = user.projects.map((p) => p.projectId)

    // Get all projects the user is NOT a member of
    const availableProjects = await db.project.findMany({
      where: {
        id: { notIn: memberProjectIds },
      },
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
        roles: {
          where: { isDefault: true },
          select: {
            id: true,
            name: true,
            position: true,
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(availableProjects)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch available projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
