import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { isValidPermission, PERMISSIONS, parsePermissions } from '@/lib/permissions'
import { isMember } from '@/lib/permissions/check'

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
    const { projectId: projectKey, roleId } = await params
    const projectId = await requireProjectByKey(projectKey)

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
    const { projectId: projectKey, roleId } = await params
    const projectId = await requireProjectByKey(projectKey)

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

    // Emit SSE event for real-time updates
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitRoleEvent({
      type: 'role.updated',
      projectId,
      roleId: role.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
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
  request: Request,
  { params }: { params: Promise<{ projectId: string; roleId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, roleId } = await params
    const projectId = await requireProjectByKey(projectKey)

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

    // Use a transaction to prevent race condition where members could be added
    // between the check above and the delete. The role has onDelete: Cascade
    // which would delete all members if we didn't have this safety check.
    await db.$transaction(async (tx) => {
      // Re-check member count inside transaction to prevent race condition
      const memberCount = await tx.projectMember.count({
        where: { roleId },
      })

      if (memberCount > 0) {
        throw new Error('ROLE_HAS_MEMBERS')
      }

      await tx.role.delete({
        where: { id: roleId },
      })
    })

    // Emit SSE event for real-time updates
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitRoleEvent({
      type: 'role.deleted',
      projectId,
      roleId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle the specific error from our transaction
    if (error instanceof Error && error.message === 'ROLE_HAS_MEMBERS') {
      return NextResponse.json(
        {
          error: 'Cannot delete role with members. Reassign members first.',
        },
        { status: 400 },
      )
    }
    return handleApiError(error, 'delete role')
  }
}
