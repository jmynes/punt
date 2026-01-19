import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-helpers'

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  key: z.string().min(1).max(10).toUpperCase().optional(),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

async function getProjectMembership(userId: string, projectId: string) {
  return db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
}

/**
 * GET /api/projects/[projectId] - Get a single project
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    const membership = await getProjectMembership(user.id, projectId)
    if (!membership) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

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
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ ...project, role: membership.role })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    console.error('Failed to fetch project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[projectId] - Update a project
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    const membership = await getProjectMembership(user.id, projectId)
    if (!membership) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only owner and admin can update project
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
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
        return NextResponse.json(
          { error: 'Project key already exists' },
          { status: 400 }
        )
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
      },
    })

    return NextResponse.json({ ...project, role: membership.role })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[projectId] - Delete a project
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    const membership = await getProjectMembership(user.id, projectId)
    if (!membership) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only owner can delete project
    if (membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the project owner can delete the project' },
        { status: 403 }
      )
    }

    // Delete project (cascades to tickets, columns, members, etc.)
    await db.project.delete({
      where: { id: projectId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
