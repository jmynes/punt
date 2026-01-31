import { NextResponse } from 'next/server'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
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
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

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

    // Get system admins who aren't already explicit members
    const memberUserIds = members.map((m) => m.userId)
    const systemAdmins = await db.user.findMany({
      where: {
        isSystemAdmin: true,
        isActive: true,
        id: { notIn: memberUserIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
      orderBy: { name: 'asc' },
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

    // Add system admins as virtual members (no explicit membership record)
    const systemAdminMembers = systemAdmins.map((admin) => ({
      id: `sysadmin-${admin.id}`,
      userId: admin.id,
      projectId,
      roleId: null,
      overrides: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: admin,
      role: {
        id: 'system-admin',
        name: 'System Admin',
        color: '#ef4444',
        description: 'System administrator with full access',
        position: -1,
        isDefault: false,
      },
    }))

    return NextResponse.json([...membersWithRoles, ...systemAdminMembers])
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
