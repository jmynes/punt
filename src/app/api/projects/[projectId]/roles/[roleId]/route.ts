import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isMember, isValidPermission, PERMISSIONS, parsePermissions } from '@/lib/permissions'

// Schema for updating a role
const updateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
  description: z.string().max(200, 'Description too long').nullable().optional(),
  permissions: z.array(z.string()).optional(),
  position: z.number().int().min(0).optional(),
})

/**
 * GET /api/projects/[projectId]/roles/[roleId] - Get a single role
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; roleId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, roleId } = await params

    // Check membership
    const membershipExists = await isMember(user.id, projectId)
    if (!membershipExists) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 })
    }

    const role = await db.role.findFirst({
      where: { id: roleId, projectId },
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
    })

    if (!role) {
      return notFoundError('Role')
    }

    return NextResponse.json({
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
    })
  } catch (error) {
    return handleApiError(error, 'fetch role')
  }
}

/**
 * PATCH /api/projects/[projectId]/roles/[roleId] - Update a role
 * Requires members.admin permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; roleId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, roleId } = await params

    // Require permission to manage roles
    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_ADMIN)

    // Get existing role
    const existingRole = await db.role.findFirst({
      where: { id: roleId, projectId },
    })

    if (!existingRole) {
      return notFoundError('Role')
    }

    const body = await request.json()
    const parsed = updateRoleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { name, color, description, permissions, position } = parsed.data

    // Check if new name conflicts with existing role
    if (name && name !== existingRole.name) {
      const conflictingRole = await db.role.findFirst({
        where: { projectId, name },
      })
      if (conflictingRole) {
        return NextResponse.json({ error: 'A role with this name already exists' }, { status: 400 })
      }
    }

    // Validate permissions if provided
    let validPermissions: string[] | undefined
    if (permissions) {
      validPermissions = permissions.filter(isValidPermission)
      if (validPermissions.length !== permissions.length) {
        return NextResponse.json({ error: 'Invalid permissions provided' }, { status: 400 })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color
    if (description !== undefined) updateData.description = description
    if (validPermissions !== undefined) {
      updateData.permissions = JSON.stringify(validPermissions)
    }
    if (position !== undefined) updateData.position = position

    // Update the role
    const role = await db.role.update({
      where: { id: roleId },
      data: updateData,
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
    })

    return NextResponse.json({
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
    })
  } catch (error) {
    return handleApiError(error, 'update role')
  }
}

/**
 * DELETE /api/projects/[projectId]/roles/[roleId] - Delete a role
 * Requires members.admin permission
 * Cannot delete default roles or roles with members
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; roleId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, roleId } = await params

    // Require permission to manage roles
    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_ADMIN)

    // Get the role with member count
    const role = await db.role.findFirst({
      where: { id: roleId, projectId },
      select: {
        id: true,
        name: true,
        isDefault: true,
        _count: {
          select: { members: true },
        },
      },
    })

    if (!role) {
      return notFoundError('Role')
    }

    // Cannot delete default roles
    if (role.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default roles' }, { status: 400 })
    }

    // Cannot delete roles that have members
    if (role._count.members > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete role with members. Reassign members first.',
          memberCount: role._count.members,
        },
        { status: 400 },
      )
    }

    // Delete the role
    await db.role.delete({
      where: { id: roleId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete role')
  }
}
