import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS, parsePermissions } from '@/lib/permissions'

// Schema for reordering roles
const reorderRolesSchema = z.object({
  roleIds: z.array(z.string()).min(1, 'At least one role ID is required'),
})

/**
 * POST /api/projects/[projectId]/roles/reorder - Reorder roles
 * Requires members.admin permission
 * Accepts an array of role IDs in the desired order
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Require permission to manage roles
    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_ADMIN)

    const body = await request.json()
    const parsed = reorderRolesSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { roleIds } = parsed.data

    // Verify all role IDs belong to this project
    const existingRoles = await db.role.findMany({
      where: { projectId, id: { in: roleIds } },
      select: { id: true },
    })

    if (existingRoles.length !== roleIds.length) {
      return NextResponse.json(
        { error: 'Some role IDs are invalid or do not belong to this project' },
        { status: 400 },
      )
    }

    // Update positions in a transaction
    await db.$transaction(
      roleIds.map((roleId, index) =>
        db.role.update({
          where: { id: roleId },
          data: { position: index },
        }),
      ),
    )

    // Return updated roles list
    const roles = await db.role.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        permissions: true,
        isDefault: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { position: 'asc' },
    })

    const rolesWithPermissions = roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      description: role.description,
      permissions: parsePermissions(role.permissions),
      isDefault: role.isDefault,
      position: role.position,
      memberCount: role._count.members,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }))

    return NextResponse.json(rolesWithPermissions)
  } catch (error) {
    return handleApiError(error, 'reorder roles')
  }
}
