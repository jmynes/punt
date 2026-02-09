import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError } from '@/lib/api-utils'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'

// Schema for adding a member
const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  roleId: z.string().min(1, 'Role ID is required'),
})

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

/**
 * POST /api/projects/[projectId]/members - Add a member to a project
 * Requires members.manage permission
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check permission to manage members
    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_MANAGE)

    const body = await request.json()
    const parsed = addMemberSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { userId: targetUserId, roleId } = parsed.data

    // Check if user exists
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, isActive: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!targetUser.isActive) {
      return NextResponse.json({ error: 'Cannot add disabled user to project' }, { status: 400 })
    }

    // Check if already a member
    const existing = await db.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this project' },
        { status: 400 },
      )
    }

    // Check if role exists in this project
    const role = await db.role.findFirst({
      where: { id: roleId, projectId },
      select: { id: true, name: true, color: true, position: true },
    })

    if (!role) {
      return NextResponse.json({ error: 'Invalid role for this project' }, { status: 400 })
    }

    // Create the membership
    const member = await db.projectMember.create({
      data: {
        userId: targetUserId,
        projectId,
        roleId,
      },
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
    })

    // Emit SSE event for member added
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitMemberEvent({
      type: 'member.added',
      memberId: member.id,
      targetUserId,
      projectId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
      changes: {
        roleId: role.id,
        roleName: role.name,
      },
    })

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      projectId: member.projectId,
      roleId: member.roleId,
      overrides: member.overrides,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: member.user,
      role: member.role,
    })
  } catch (error) {
    return handleApiError(error, 'add member')
  }
}
