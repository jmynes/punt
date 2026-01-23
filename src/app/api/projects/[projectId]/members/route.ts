import { NextResponse } from 'next/server'
import { requireAuth, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/projects/[projectId]/members - Get all members of a project
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

    const members = await db.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
            position: true,
            isDefault: true,
          },
        },
      },
      orderBy: [{ role: { position: 'asc' } }, { user: { name: 'asc' } }],
    })

    // Format response to include role details
    const membersWithRoles = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      projectId: m.projectId,
      roleId: m.roleId,
      overrides: m.overrides,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: m.user,
      role: m.role,
    }))

    return NextResponse.json(membersWithRoles)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch project members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
