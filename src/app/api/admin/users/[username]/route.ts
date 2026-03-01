import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { DEMO_TEAM_MEMBERS, DEMO_USER, isDemoMode } from '@/lib/demo/demo-config'
import { DEMO_PROJECTS, DEMO_ROLES, getDemoMembersForProject } from '@/lib/demo/demo-data'
import { projectEvents } from '@/lib/events'
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

async function verifyReauth(
  userId: string,
  password: string,
  totpCode?: string,
  isRecoveryCode?: boolean,
): Promise<NextResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      totpRecoveryCodes: true,
    },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash)
  if (!isValidPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null
}

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().optional(),
  isSystemAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/admin/users/[username] - Get a specific user by username
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    await requireSystemAdmin()

    const { username } = await params

    // Handle demo mode - return demo user data
    if (isDemoMode()) {
      const allDemoUsers = [DEMO_USER, ...DEMO_TEAM_MEMBERS]
      const demoUser = allDemoUsers.find((u) => u.username.toLowerCase() === username.toLowerCase())

      if (!demoUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Build project memberships for this user
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
      })
    }

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
            id: true, // membership ID for updating
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
                roles: {
                  where: { isDefault: true },
                  select: {
                    id: true,
                    name: true,
                    position: true,
                  },
                  orderBy: { position: 'asc' },
                },
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

    return NextResponse.json(user)
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

/**
 * PATCH /api/admin/users/[username] - Update a user
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const currentUser = await requireSystemAdmin()
    const { username } = await params

    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      const allDemoUsers = [DEMO_USER, ...DEMO_TEAM_MEMBERS]
      const demoUser = allDemoUsers.find((u) => u.username.toLowerCase() === username.toLowerCase())
      if (!demoUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const body = await request.json()
      return NextResponse.json({
        id: demoUser.id,
        username: demoUser.username,
        email: body.email ?? demoUser.email,
        name: body.name ?? demoUser.name,
        avatar: demoUser.avatar,
        isSystemAdmin: body.isSystemAdmin ?? demoUser.isSystemAdmin,
        isActive: body.isActive ?? demoUser.isActive,
        createdAt: demoUser.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    // Look up the target user by username (case-insensitive)
    const existingUser = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()

    // Require reauth for admin privilege or active status changes (skip for undo/redo)
    if (('isSystemAdmin' in body || 'isActive' in body) && !isDemoMode() && !body.skipReauth) {
      if (!body.confirmPassword) {
        return NextResponse.json(
          { error: 'Password is required to confirm this action' },
          { status: 400 },
        )
      }
      const authError = await verifyReauth(
        currentUser.id,
        body.confirmPassword,
        body.totpCode,
        body.isRecoveryCode,
      )
      if (authError) return authError
    }

    // Prevent removing or disabling the last system admin (including self)
    const isRemovingAdmin = body.isSystemAdmin === false && existingUser.isSystemAdmin
    const isDisablingAdmin =
      body.isActive === false && existingUser.isSystemAdmin && existingUser.isActive
    if (isRemovingAdmin || isDisablingAdmin) {
      const adminCount = await db.user.count({
        where: { isSystemAdmin: true, isActive: true },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove or disable the last system administrator' },
          { status: 400 },
        )
      }
    }

    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Admin user update validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const updates = parsed.data

    // Check email uniqueness if being updated
    if (updates.email && updates.email !== existingUser.email) {
      const emailExists = await db.user.findUnique({
        where: { email: updates.email },
      })
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    // Validate and hash password if being updated
    let passwordHash: string | undefined
    if (updates.password) {
      const passwordValidation = validatePasswordStrength(updates.password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: 'Password does not meet requirements', details: passwordValidation.errors },
          { status: 400 },
        )
      }
      passwordHash = await hashPassword(updates.password)
    }

    // Check if user is being promoted to system admin
    const becomingSystemAdmin = updates.isSystemAdmin === true && !existingUser.isSystemAdmin

    // Update user
    const user = await db.user.update({
      where: { id: existingUser.id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.email && { email: updates.email }),
        ...(passwordHash && { passwordHash }),
        ...(updates.isSystemAdmin !== undefined && { isSystemAdmin: updates.isSystemAdmin }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // If user became a system admin, ensure they have Admin role in all projects
    if (becomingSystemAdmin) {
      // Get existing memberships with their role info
      const existingMemberships = await db.projectMember.findMany({
        where: { userId: existingUser.id },
        select: { id: true, projectId: true, role: { select: { name: true } } },
      })
      const existingProjectIds = existingMemberships.map((m) => m.projectId)

      // Get all projects with their Admin role
      const allProjects = await db.project.findMany({
        select: {
          id: true,
          roles: {
            where: { name: 'Admin', isDefault: true },
            select: { id: true },
            take: 1,
          },
        },
      })

      for (const project of allProjects) {
        const adminRole = project.roles[0]
        if (!adminRole) continue

        const existing = existingMemberships.find((m) => m.projectId === project.id)
        if (!existing) {
          // Add user to projects they're not in
          await db.projectMember.create({
            data: {
              userId: existingUser.id,
              projectId: project.id,
              roleId: adminRole.id,
            },
          })
        } else if (existing.role.name !== 'Admin' && existing.role.name !== 'Owner') {
          // Promote existing members below Admin to Admin
          await db.projectMember.update({
            where: { id: existing.id },
            data: { roleId: adminRole.id },
          })
        }
      }
    }

    // Emit user event for real-time updates
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: user.id,
      tabId,
      timestamp: Date.now(),
      changes: {
        ...(updates.name && { name: updates.name }),
        ...(updates.isSystemAdmin !== undefined && { isSystemAdmin: updates.isSystemAdmin }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[username] - Delete or disable a user
 * Query params:
 *   - permanent=true: Hard delete (permanently remove from database)
 *   - permanent=false or omitted: Soft delete (disable the account)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const currentUser = await requireSystemAdmin()
    const { username } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    // Verify the admin's identity
    let body: { confirmPassword?: string; totpCode?: string; isRecoveryCode?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // No body is OK for demo mode
    }

    if (!isDemoMode()) {
      if (!body.confirmPassword) {
        return NextResponse.json(
          { error: 'Password is required to confirm this action' },
          { status: 400 },
        )
      }
      const authError = await verifyReauth(
        currentUser.id,
        body.confirmPassword,
        body.totpCode,
        body.isRecoveryCode,
      )
      if (authError) return authError
    }

    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      const allDemoUsers = [DEMO_USER, ...DEMO_TEAM_MEMBERS]
      const demoUser = allDemoUsers.find((u) => u.username.toLowerCase() === username.toLowerCase())
      if (!demoUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      if (demoUser.id === currentUser.id && demoUser.isSystemAdmin) {
        // In demo mode, the demo user is always the sole admin
        const demoAdminCount = [DEMO_USER, ...DEMO_TEAM_MEMBERS].filter(
          (u) => u.isSystemAdmin && u.isActive,
        ).length
        if (demoAdminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot delete the only system administrator account' },
            { status: 400 },
          )
        }
      }
      return NextResponse.json({ success: true, action: permanent ? 'deleted' : 'disabled' })
    }

    // Look up the target user by username (case-insensitive)
    const existingUser = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent self-deletion only when the user is the sole system admin
    if (existingUser.id === currentUser.id) {
      if (existingUser.isSystemAdmin) {
        const adminCount = await db.user.count({
          where: { isSystemAdmin: true, isActive: true },
        })
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot delete the only system administrator account' },
            { status: 400 },
          )
        }
      }
    }

    if (permanent) {
      // Hard delete: remove all sessions first, then delete user
      await db.session.deleteMany({
        where: { userId: existingUser.id },
      })
      await db.user.delete({
        where: { id: existingUser.id },
      })
      return NextResponse.json({ success: true, action: 'deleted' })
    } else {
      // Soft delete: deactivate the user
      await db.user.update({
        where: { id: existingUser.id },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true, action: 'disabled' })
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
