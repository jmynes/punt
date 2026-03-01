import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import { PERMISSIONS } from '@/lib/permissions'
import { getSystemSettings } from '@/lib/system-settings'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  key: z.string().min(1).max(10).toUpperCase().optional(),
  description: z.string().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  showAddColumnButton: z.boolean().nullable().optional(),
})

/**
 * GET /api/projects/[projectId] - Get a single project
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params

    // Resolve project key to ID
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
        description: true,
        showAddColumnButton: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { tickets: true, members: true },
        },
        members: {
          where: { userId: user.id },
          select: { role: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { members, showAddColumnButton: projectSetting, ...projectData } = project
    const roleDetails = members[0]?.role ?? null

    // Resolve effective showAddColumnButton: project override > global default
    let effectiveShowAddColumn = true
    if (projectSetting !== null) {
      effectiveShowAddColumn = projectSetting
    } else {
      const systemSettings = await getSystemSettings()
      effectiveShowAddColumn = systemSettings.showAddColumnButton
    }

    return NextResponse.json({
      ...projectData,
      role: roleDetails?.name ?? 'member',
      roleDetails,
      showAddColumnButton: projectSetting,
      effectiveShowAddColumnButton: effectiveShowAddColumn,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[projectId] - Update a project
 * Requires admin or owner role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params

    // Resolve project key to ID
    const projectId = await requireProjectByKey(projectKey)

    // Check project settings permission
    await requirePermission(user.id, projectId, PERMISSIONS.PROJECT_SETTINGS)

    // Check if project exists
    const existingProject = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateProjectSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Project update validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const updates = parsed.data

    // Check key uniqueness if being updated
    if (updates.key) {
      const existingProject = await db.project.findFirst({
        where: {
          key: updates.key,
          id: { not: projectId },
        },
      })
      if (existingProject) {
        return NextResponse.json({ error: 'Project key already exists' }, { status: 400 })
      }
    }

    const project = await db.project.update({
      where: { id: projectId },
      data: updates,
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
        description: true,
        showAddColumnButton: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { userId: user.id },
          select: { role: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    const { members, showAddColumnButton: patchedSetting, ...projectData } = project
    const roleDetails = members[0]?.role ?? null

    // Emit real-time event for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitProjectEvent({
      type: 'project.updated',
      projectId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    // Resolve effective setting for PATCH response too
    let effectiveShowAddColumn = true
    if (patchedSetting !== null) {
      effectiveShowAddColumn = patchedSetting
    } else {
      const systemSettings = await getSystemSettings()
      effectiveShowAddColumn = systemSettings.showAddColumnButton
    }

    return NextResponse.json({
      ...projectData,
      role: roleDetails?.name ?? 'member',
      roleDetails,
      showAddColumnButton: patchedSetting,
      effectiveShowAddColumnButton: effectiveShowAddColumn,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[projectId] - Delete a project
 * Requires owner role and password reauthentication
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params

    // Resolve project key to ID
    const projectId = await requireProjectByKey(projectKey)

    // Check project delete permission
    await requirePermission(user.id, projectId, PERMISSIONS.PROJECT_DELETE)

    // Require password reauthentication (skip in demo mode)
    if (!isDemoMode()) {
      let body: {
        confirmPassword?: string
        totpCode?: string
        isRecoveryCode?: boolean
      } = {}
      try {
        body = await request.json()
      } catch {
        // No body provided
      }

      if (!body.confirmPassword) {
        return NextResponse.json(
          { error: 'Password is required to confirm this action' },
          { status: 400 },
        )
      }

      const currentUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          passwordHash: true,
          totpEnabled: true,
          totpSecret: true,
          totpRecoveryCodes: true,
        },
      })

      if (!currentUser?.passwordHash) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const isValidPassword = await verifyPassword(body.confirmPassword, currentUser.passwordHash)
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
      }

      if (currentUser.totpEnabled && currentUser.totpSecret) {
        if (!body.totpCode) {
          return NextResponse.json(
            { error: '2FA code required', requires2fa: true },
            { status: 401 },
          )
        }

        if (body.isRecoveryCode) {
          if (!currentUser.totpRecoveryCodes) {
            return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
          }

          const codeIndex = await verifyRecoveryCode(body.totpCode, currentUser.totpRecoveryCodes)
          if (codeIndex === -1) {
            return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
          }

          const updatedCodes = markRecoveryCodeUsed(currentUser.totpRecoveryCodes, codeIndex)
          await db.user.update({
            where: { id: user.id },
            data: { totpRecoveryCodes: updatedCodes },
          })
        } else {
          const secret = decryptTotpSecret(currentUser.totpSecret)
          const isValidTotp = verifyTotpToken(body.totpCode, secret)
          if (!isValidTotp) {
            return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
          }
        }
      }
    }

    // Check if project exists and get all members (for SSE events after deletion)
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        members: {
          select: {
            id: true,
            userId: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Store member info before deletion (cascade will remove them)
    const affectedMembers = project.members

    // Delete project (cascades to tickets, columns, members, etc.)
    await db.project.delete({
      where: { id: projectId },
    })

    // Emit real-time events for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined

    // Emit project.deleted event for sidebar/project list updates
    projectEvents.emitProjectEvent({
      type: 'project.deleted',
      projectId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    // Emit member.removed events for each affected user (for admin profile updates)
    for (const member of affectedMembers) {
      projectEvents.emitMemberEvent({
        type: 'member.removed',
        memberId: member.id,
        targetUserId: member.userId,
        projectId,
        userId: user.id,
        tabId,
        timestamp: Date.now(),
        changes: {
          previousRoleId: member.role.id,
          previousRoleName: member.role.name,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
