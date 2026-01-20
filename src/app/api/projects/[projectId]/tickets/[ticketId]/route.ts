import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import type { IssueType, Priority } from '@/types'

const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']).optional(),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).optional(),
  columnId: z.string().min(1).optional(),
  order: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  estimate: z.string().nullable().optional(),
  startDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  environment: z.string().nullable().optional(),
  affectedVersion: z.string().nullable().optional(),
  fixVersion: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  watcherIds: z.array(z.string()).optional(),
})

// Common select for ticket relations
const ticketSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  order: true,
  storyPoints: true,
  estimate: true,
  startDate: true,
  dueDate: true,
  environment: true,
  affectedVersion: true,
  fixVersion: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  columnId: true,
  assigneeId: true,
  creatorId: true,
  sprintId: true,
  parentId: true,
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  },
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  },
  sprint: {
    select: {
      id: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  },
  labels: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
  watchers: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
  _count: {
    select: {
      comments: true,
      subtasks: true,
      attachments: true,
    },
  },
} as const

// Transform DB ticket to API response format
function transformTicket(ticket: {
  watchers: { user: { id: string; name: string; email: string | null; avatar: string | null } }[]
  [key: string]: unknown
}) {
  const { watchers, ...rest } = ticket
  return {
    ...rest,
    watchers: watchers.map((w) => w.user),
  }
}

/**
 * GET /api/projects/[projectId]/tickets/[ticketId] - Get a single ticket
 * Requires project membership
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId } = await params

    // Check project membership
    await requireProjectMember(user.id, projectId)

    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: ticketSelect,
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json(transformTicket(ticket))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[projectId]/tickets/[ticketId] - Update a ticket
 * Requires project membership
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId } = await params

    // Check project membership
    await requireProjectMember(user.id, projectId)

    // Check if ticket exists and belongs to project
    const existingTicket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true, columnId: true },
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateTicketSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { labelIds, watcherIds, ...updateData } = parsed.data

    // If changing column, verify new column belongs to project
    if (updateData.columnId && updateData.columnId !== existingTicket.columnId) {
      const column = await db.column.findFirst({
        where: { id: updateData.columnId, projectId },
      })

      if (!column) {
        return NextResponse.json(
          { error: 'Column not found or does not belong to project' },
          { status: 400 },
        )
      }
    }

    // Build update data, filtering out undefined values
    const dbUpdateData: Record<string, unknown> = {}

    // Handle scalar fields
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        dbUpdateData[key] = value
      }
    }

    // Cast type and priority if provided
    if (dbUpdateData.type) {
      dbUpdateData.type = dbUpdateData.type as IssueType
    }
    if (dbUpdateData.priority) {
      dbUpdateData.priority = dbUpdateData.priority as Priority
    }

    // Handle labels relation
    if (labelIds !== undefined) {
      dbUpdateData.labels = {
        set: labelIds.map((id) => ({ id })),
      }
    }

    // Handle watchers relation
    if (watcherIds !== undefined) {
      // Delete existing watchers and create new ones
      await db.ticketWatcher.deleteMany({
        where: { ticketId },
      })

      if (watcherIds.length > 0) {
        await db.ticketWatcher.createMany({
          data: watcherIds.map((userId) => ({ ticketId, userId })),
        })
      }
    }

    const ticket = await db.ticket.update({
      where: { id: ticketId },
      data: dbUpdateData,
      select: ticketSelect,
    })

    return NextResponse.json(transformTicket(ticket))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId] - Delete a ticket
 * Requires project membership
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId } = await params

    // Check project membership
    await requireProjectMember(user.id, projectId)

    // Check if ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Delete the ticket (cascades to watchers, comments, attachments, etc.)
    await db.ticket.delete({
      where: { id: ticketId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to delete ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
