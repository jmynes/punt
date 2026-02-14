import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { DEFAULT_ROLE_NAMES } from '@/lib/permissions'
import { createDefaultRolesForProject } from '@/lib/permissions/create-default-roles'

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
        role: {
          select: {
            id: true,
            name: true,
            color: true,
            position: true,
          },
        },
      },
      orderBy: { project: { name: 'asc' } },
    })

    const projectsWithRole = memberships.map((m) => ({
      ...m.project,
      role: m.role.name, // Keep backwards compatible - return role name as string
      roleDetails: m.role, // Also include full role details
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
      console.error('Project creation validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { name, key, description, color } = parsed.data

    // Check if key is already taken
    const existingProject = await db.project.findUnique({
      where: { key },
    })

    if (existingProject) {
      return NextResponse.json({ error: 'Project key already exists' }, { status: 400 })
    }

    // Create project with default columns
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

    // Create default roles for the project
    const roleMap = await createDefaultRolesForProject(project.id)
    const ownerRoleId = roleMap.get(DEFAULT_ROLE_NAMES.OWNER)
    const adminRoleId = roleMap.get(DEFAULT_ROLE_NAMES.ADMIN)

    if (!ownerRoleId || !adminRoleId) {
      // This should never happen, but handle it gracefully
      throw new Error('Failed to create default roles')
    }

    // Add the creator as an Owner
    const creatorMembership = await db.projectMember.create({
      data: {
        userId: user.id,
        projectId: project.id,
        roleId: ownerRoleId,
      },
    })

    // Add all other system admins as Admin members
    const otherSystemAdmins = await db.user.findMany({
      where: {
        isSystemAdmin: true,
        isActive: true,
        id: { not: user.id },
      },
      select: { id: true },
    })

    // Track created memberships for SSE events
    const adminMemberships: Array<{ id: string; userId: string }> = []
    if (otherSystemAdmins.length > 0) {
      // Create memberships one by one to get IDs for SSE events
      for (const admin of otherSystemAdmins) {
        const membership = await db.projectMember.create({
          data: {
            userId: admin.id,
            projectId: project.id,
            roleId: adminRoleId,
          },
        })
        adminMemberships.push({ id: membership.id, userId: admin.id })
      }
    }

    // Emit real-time events for other clients
    const tabId = request.headers.get('X-Tab-Id') || undefined

    // Emit project.created event for sidebar/project list updates
    projectEvents.emitProjectEvent({
      type: 'project.created',
      projectId: project.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    // Emit member.added event for the creator (for admin profile updates)
    projectEvents.emitMemberEvent({
      type: 'member.added',
      memberId: creatorMembership.id,
      targetUserId: user.id,
      projectId: project.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
      changes: {
        roleId: ownerRoleId,
        roleName: 'Owner',
      },
    })

    // Emit member.added events for other system admins (for admin profile updates)
    for (const membership of adminMemberships) {
      projectEvents.emitMemberEvent({
        type: 'member.added',
        memberId: membership.id,
        targetUserId: membership.userId,
        projectId: project.id,
        userId: user.id,
        tabId,
        timestamp: Date.now(),
        changes: {
          roleId: adminRoleId,
          roleName: 'Admin',
        },
      })
    }

    return NextResponse.json(
      {
        ...project,
        role: 'Owner', // Backwards compatible
        roleDetails: {
          id: ownerRoleId,
          name: 'Owner',
          color: '#f59e0b',
          position: 0,
        },
      },
      { status: 201 },
    )
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
