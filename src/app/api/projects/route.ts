import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  key: z.string().min(1, 'Key is required').max(10).toUpperCase(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
})

/**
 * GET /api/projects - List projects
 * Users see only projects they're members of (system admins see all)
 */
export async function GET() {
  try {
    const user = await requireAuth()

    // System admins can see all projects
    if (user.isSystemAdmin) {
      const projects = await db.project.findMany({
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
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(projects.map((p) => ({ ...p, role: 'admin' })))
    }

    // Regular users only see projects they're members of
    const memberships = await db.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
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
        },
      },
      orderBy: { project: { name: 'asc' } },
    })

    const projectsWithRole = memberships.map((m) => ({
      ...m.project,
      role: m.role,
    }))

    return NextResponse.json(projectsWithRole)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Account disabled') {
        return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
      }
    }
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects - Create a new project
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { name, key, description, color } = parsed.data

    // Check if key is already taken
    const existingProject = await db.project.findUnique({
      where: { key },
    })

    if (existingProject) {
      return NextResponse.json({ error: 'Project key already exists' }, { status: 400 })
    }

    // Create project with default columns and make the creator an owner
    const project = await db.project.create({
      data: {
        name,
        key,
        description,
        color,
        columns: {
          create: [
            { name: 'To Do', order: 0 },
            { name: 'In Progress', order: 1 },
            { name: 'Review', order: 2 },
            { name: 'Done', order: 3 },
          ],
        },
        members: {
          create: {
            userId: user.id,
            role: 'owner',
          },
        },
      },
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

    // Emit real-time event for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitProjectEvent({
      type: 'project.created',
      projectId: project.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ ...project, role: 'owner' }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Account disabled') {
        return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
      }
    }
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
