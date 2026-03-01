import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { DEMO_TEAM_MEMBERS, DEMO_USER, isDemoMode } from '@/lib/demo/demo-config'
import { DEMO_PROJECTS, DEMO_ROLES, getDemoMembersForProject } from '@/lib/demo/demo-data'

/**
 * GET /api/users/[username] - Get a user's profile + project memberships
 *
 * - If username matches current user → return profile + project memberships (read-only)
 * - If current user is system admin → return full admin-style data
 * - Otherwise → 403
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params
    const isSelf =
      'username' in currentUser &&
      typeof currentUser.username === 'string' &&
      currentUser.username.toLowerCase() === username.toLowerCase()
    const isViewerAdmin = currentUser.isSystemAdmin

    // Must be self or admin to view
    if (!isSelf && !isViewerAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Handle demo mode
    if (isDemoMode()) {
      const allDemoUsers = [DEMO_USER, ...DEMO_TEAM_MEMBERS]
      const demoUser = allDemoUsers.find((u) => u.username.toLowerCase() === username.toLowerCase())

      if (!demoUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const projects = DEMO_PROJECTS.map((project) => {
        const members = getDemoMembersForProject(project.id)
        const membership = members.find((m) => m.userId === demoUser.id)
        if (!membership) return null

        return {
          id: membership.id,
          roleId: membership.roleId,
          role: {
            id: membership.role.id,
            name: membership.role.name,
          },
          project: {
            id: project.id,
            name: project.name,
            key: project.key,
            color: project.color,
            roles: DEMO_ROLES.map((r) => ({
              id: r.id,
              name: r.name,
              position: r.position,
            })),
          },
        }
      }).filter(Boolean)

      return NextResponse.json({
        id: demoUser.id,
        username: demoUser.username,
        email: demoUser.email,
        name: demoUser.name,
        avatar: demoUser.avatar,
        avatarColor: null,
        isSystemAdmin: demoUser.isSystemAdmin,
        isActive: demoUser.isActive,
        createdAt: demoUser.createdAt.toISOString(),
        updatedAt: demoUser.updatedAt.toISOString(),
        projects,
        _count: { projects: projects.length },
        isSelf,
        isViewerAdmin,
      })
    }

    // For admin viewing another user, include roles for editing
    // For self-view, roles are not needed (read-only)
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatar: true,
        avatarColor: true,
        isSystemAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            roleId: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                key: true,
                color: true,
                // Include roles only for admin (needed for role editing)
                ...(isViewerAdmin && {
                  roles: {
                    where: { isDefault: true },
                    select: {
                      id: true,
                      name: true,
                      position: true,
                    },
                    orderBy: { position: 'asc' as const },
                  },
                }),
              },
            },
          },
          orderBy: {
            project: { name: 'asc' },
          },
        },
        _count: {
          select: { projects: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...user,
      isSelf,
      isViewerAdmin,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
