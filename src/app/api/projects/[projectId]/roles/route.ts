import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isMember, isValidPermission, PERMISSIONS, parsePermissions } from '@/lib/permissions'

// Schema for creating a new role
const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  description: z.string().max(200, 'Description too long').optional(),
  permissions: z.array(z.string()).default([]),
  position: z.number().int().min(0).optional(),
})

/**
 * GET /api/projects/[projectId]/roles - List all roles for a project
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    // Check membership (any member can view roles)
    const membershipExists = await isMember(user.id, projectId)
    if (!membershipExists) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 })
    }

    // Get all roles with member counts
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

    // Parse permissions JSON and format response
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
    return handleApiError(error, 'fetch roles')
  }
}

/**
 * POST /api/projects/[projectId]/roles - Create a new custom role
 * Requires members.admin permission
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    // Require permission to create roles
    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_ADMIN)

    const body = await request.json()
    const parsed = createRoleSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { name, color, description, permissions } = parsed.data

    // Check if role name already exists in this project
    const existingRole = await db.role.findFirst({
      where: { projectId, name },
    })

    if (existingRole) {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 400 })
    }

    // Validate permissions
    const validPermissions = permissions.filter(isValidPermission)
    if (validPermissions.length !== permissions.length) {
      return NextResponse.json({ error: 'Invalid permissions provided' }, { status: 400 })
    }

    // Get the highest position to place new role at the end
    const maxPositionRole = await db.role.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const position = (maxPositionRole?.position ?? 0) + 1

    // Create the role
    const role = await db.role.create({
      data: {
        name,
        color,
        description,
        permissions: JSON.stringify(validPermissions),
        isDefault: false, // Custom roles are never default
        position,
        projectId,
      },
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
      },
    })

    return NextResponse.json(
      {
        id: role.id,
        name: role.name,
        color: role.color,
        description: role.description,
        permissions: parsePermissions(role.permissions),
        isDefault: role.isDefault,
        position: role.position,
        memberCount: 0,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error, 'create role')
  }
}
