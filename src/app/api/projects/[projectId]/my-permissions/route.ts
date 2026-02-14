import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { parsePermissions } from '@/lib/permissions'
import { getEffectivePermissions } from '@/lib/permissions/check'

/**
 * GET /api/projects/[projectId]/my-permissions
 * Get the current user's effective permissions in a project
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Get effective permissions
    const { permissions, membership, isSystemAdmin } = await getEffectivePermissions(
      user.id,
      projectId,
    )

    // If not a member and not system admin, return empty permissions
    if (!membership && !isSystemAdmin) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 })
    }

    // For system admins without membership, create a virtual response
    if (isSystemAdmin && !membership) {
      return NextResponse.json({
        permissions: Array.from(permissions),
        role: {
          id: 'system-admin',
          name: 'System Admin',
          color: '#f59e0b',
          description: 'Full system access',
          isDefault: false,
          position: -1,
        },
        overrides: [],
        isSystemAdmin: true,
      })
    }

    // At this point, membership is guaranteed to exist (system admin case returned early)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Get full role details
    const role = await db.role.findUnique({
      where: { id: membership.roleId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        isDefault: true,
        position: true,
      },
    })

    return NextResponse.json({
      permissions: Array.from(permissions),
      role,
      overrides: parsePermissions(membership.overrides),
      isSystemAdmin,
    })
  } catch (error) {
    return handleApiError(error, 'fetch permissions')
  }
}
