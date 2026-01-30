import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  key: z.string().min(1).max(10).toUpperCase().optional(),
  description: z.string().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
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

    const { members, ...projectData } = project
    const roleDetails = members[0]?.role ?? null

    return NextResponse.json({ ...projectData, role: roleDetails?.name ?? 'member', roleDetails })
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
        createdAt: true,
        updatedAt: true,
        members: {
          where: { userId: user.id },
          select: { role: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    const { members, ...projectData } = project
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

    return NextResponse.json({ ...projectData, role: roleDetails?.name ?? 'member', roleDetails })
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
 * Requires owner role
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

    // Check if project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete project (cascades to tickets, columns, members, etc.)
    await db.project.delete({
      where: { id: projectId },
    })

    // Emit real-time event for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitProjectEvent({
      type: 'project.deleted',
      projectId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

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
