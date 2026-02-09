import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import {
  canAssignRole,
  canManageMember,
  isMember,
  isValidPermission,
  PERMISSIONS,
  parsePermissions,
} from '@/lib/permissions'

// Schema for updating a member
const updateMemberSchema = z.object({
  roleId: z.string().optional(),
  overrides: z.array(z.string()).nullable().optional(),
})

/**
 * GET /api/projects/[projectId]/members/[memberId] - Get a single member
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, memberId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check membership
    const membershipExists = await isMember(user.id, projectId)
    if (!membershipExists) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 })
    }

    const member = await db.projectMember.findFirst({
      where: { id: memberId, projectId },
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
            permissions: true,
            position: true,
            isDefault: true,
          },
        },
      },
    })

    if (!member) {
      return notFoundError('Member')
    }

    // Parse role permissions and member overrides
    const rolePermissions = parsePermissions(member.role.permissions)
    const overridePermissions = parsePermissions(member.overrides)

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      projectId: member.projectId,
      roleId: member.roleId,
      overrides: overridePermissions,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: member.user,
      role: {
        ...member.role,
        permissions: rolePermissions,
      },
      effectivePermissions: [...new Set([...rolePermissions, ...overridePermissions])],
    })
  } catch (error) {
    return handleApiError(error, 'fetch member')
  }
}

/**
 * PATCH /api/projects/[projectId]/members/[memberId] - Update a member's role or overrides
 * Requires members.manage permission (for role changes)
 * Requires members.admin permission (for override changes)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, memberId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Get the target member first
    const targetMember = await db.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: {
        id: true,
        userId: true,
        roleId: true,
        role: { select: { name: true, position: true } },
      },
    })

    if (!targetMember) {
      return notFoundError('Member')
    }

    const body = await request.json()
    const parsed = updateMemberSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { roleId, overrides } = parsed.data

    // Check permissions for role change
    if (roleId !== undefined && roleId !== targetMember.roleId) {
      // Get the target role to check hierarchy
      const newRole = await db.role.findFirst({
        where: { id: roleId, projectId },
        select: { id: true, name: true, position: true },
      })
      if (!newRole) {
        return NextResponse.json({ error: 'Invalid role for this project' }, { status: 400 })
      }

      // Self role change: only allow demotion (unless system admin)
      if (targetMember.userId === user.id) {
        // System admins can self-promote within any project
        if (!user.isSystemAdmin && newRole.position <= targetMember.role.position) {
          return NextResponse.json(
            { error: 'Cannot promote yourself to a higher or equal rank' },
            { status: 400 },
          )
        }
        // Self-demotion is allowed, system admins can self-promote
      } else {
        // Changing someone else's role - need members.manage permission
        await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_MANAGE)

        // Check if user can manage this member (hierarchy check)
        const canManage = await canManageMember(user.id, targetMember.userId, projectId)
        if (!canManage) {
          return NextResponse.json(
            { error: 'Cannot modify members with equal or higher rank' },
            { status: 403 },
          )
        }

        // Check if user can assign the target role
        const canAssign = await canAssignRole(user.id, projectId, roleId)
        if (!canAssign) {
          return NextResponse.json(
            { error: 'Cannot assign roles equal to or higher than your own' },
            { status: 403 },
          )
        }
      }

      // Check we're not removing the last Owner
      if (targetMember.role.name === 'Owner') {
        const ownerCount = await db.projectMember.count({
          where: {
            projectId,
            role: { name: 'Owner' },
          },
        })
        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot remove the last Owner. Transfer ownership first.' },
            { status: 400 },
          )
        }
      }
    }

    // Check permissions for override change
    if (overrides !== undefined) {
      // Need members.admin permission for override changes
      await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_ADMIN)

      // Validate overrides are valid permissions
      if (overrides !== null) {
        const invalidPermissions = overrides.filter((p) => !isValidPermission(p))
        if (invalidPermissions.length > 0) {
          return NextResponse.json(
            { error: 'Invalid permissions provided', invalid: invalidPermissions },
            { status: 400 },
          )
        }
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (roleId !== undefined) updateData.roleId = roleId
    if (overrides !== undefined) {
      updateData.overrides = overrides === null ? null : JSON.stringify(overrides)
    }

    // Update the member
    const member = await db.projectMember.update({
      where: { id: memberId },
      data: updateData,
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
            permissions: true,
            position: true,
            isDefault: true,
          },
        },
      },
    })

    // Parse role permissions and member overrides
    const rolePermissions = parsePermissions(member.role.permissions)
    const overridePermissions = parsePermissions(member.overrides)

    // Emit SSE event for role change
    if (roleId !== undefined && roleId !== targetMember.roleId) {
      const tabId = request.headers.get('X-Tab-Id') || undefined
      projectEvents.emitMemberEvent({
        type: 'member.role.updated',
        memberId: member.id,
        targetUserId: member.userId,
        projectId,
        userId: user.id,
        tabId,
        timestamp: Date.now(),
        changes: {
          roleId: member.role.id,
          roleName: member.role.name,
          previousRoleId: targetMember.roleId,
          previousRoleName: targetMember.role.name,
        },
      })
    }

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      projectId: member.projectId,
      roleId: member.roleId,
      overrides: overridePermissions,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: member.user,
      role: {
        ...member.role,
        permissions: rolePermissions,
      },
      effectivePermissions: [...new Set([...rolePermissions, ...overridePermissions])],
    })
  } catch (error) {
    return handleApiError(error, 'update member')
  }
}

/**
 * DELETE /api/projects/[projectId]/members/[memberId] - Remove a member
 * Requires members.manage permission
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, memberId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Get the target member
    const targetMember = await db.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: {
        id: true,
        userId: true,
        role: { select: { id: true, name: true } },
      },
    })

    if (!targetMember) {
      return notFoundError('Member')
    }

    // Special case: allow users to leave the project themselves
    if (targetMember.userId === user.id) {
      // Check we're not the last owner
      if (targetMember.role.name === 'Owner') {
        const ownerCount = await db.projectMember.count({
          where: {
            projectId,
            role: { name: 'Owner' },
          },
        })
        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot leave as the last Owner. Transfer ownership first.' },
            { status: 400 },
          )
        }
      }
    } else {
      // Removing someone else - need members.manage permission
      await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_MANAGE)

      // Check hierarchy
      const canManage = await canManageMember(user.id, targetMember.userId, projectId)
      if (!canManage) {
        return NextResponse.json(
          { error: 'Cannot remove members with equal or higher rank' },
          { status: 403 },
        )
      }
    }

    // Remove the member
    await db.projectMember.delete({
      where: { id: memberId },
    })

    // Emit SSE event for member removed
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitMemberEvent({
      type: 'member.removed',
      memberId,
      targetUserId: targetMember.userId,
      projectId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
      changes: {
        previousRoleId: targetMember.role.id,
        previousRoleName: targetMember.role.name,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'remove member')
  }
}
