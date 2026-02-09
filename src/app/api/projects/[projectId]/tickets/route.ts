import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { PERMISSIONS } from '@/lib/permissions'
import { TICKET_SELECT_FULL, transformTicket } from '@/lib/prisma-selects'
import type { IssueType, Priority } from '@/types'

const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']).default('task'),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).default('medium'),
  columnId: z.string().min(1),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  estimate: z.string().nullable().optional(),
  startDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  environment: z.string().nullable().optional(),
  affectedVersion: z.string().nullable().optional(),
  fixVersion: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional().default([]),
  watcherIds: z.array(z.string()).optional().default([]),
})

/**
 * GET /api/projects/[projectId]/tickets - List all tickets for a project
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

    const tickets = await db.ticket.findMany({
      where: { projectId },
      select: TICKET_SELECT_FULL,
      orderBy: [{ columnId: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json(tickets.map(transformTicket))
  } catch (error) {
    return handleApiError(error, 'fetch tickets')
  }
}

/**
 * POST /api/projects/[projectId]/tickets - Create a new ticket
 * Requires project membership
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check ticket creation permission
    await requirePermission(user.id, projectId, PERMISSIONS.TICKETS_CREATE)

    const body = await request.json()
    const parsed = createTicketSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { labelIds, watcherIds, reporterId, ...ticketData } = parsed.data

    // Determine creatorId: use reporterId if provided, otherwise default to authenticated user
    const creatorId = reporterId ?? user.id

    // Verify column belongs to project
    const column = await db.column.findFirst({
      where: { id: ticketData.columnId, projectId },
    })

    if (!column) {
      return badRequestError('Column not found or does not belong to project')
    }

    // Validate reporterId is a project member (if provided)
    if (reporterId) {
      const reporterMembership = await db.projectMember.findUnique({
        where: { userId_projectId: { userId: reporterId, projectId } },
      })
      if (!reporterMembership) {
        return badRequestError('Reporter must be a project member')
      }
    }

    // Validate assigneeId is a project member (if provided)
    if (ticketData.assigneeId) {
      const assigneeMembership = await db.projectMember.findUnique({
        where: { userId_projectId: { userId: ticketData.assigneeId, projectId } },
      })
      if (!assigneeMembership) {
        return badRequestError('Assignee must be a project member')
      }
    }

    // Validate all watcherIds are project members (if provided)
    if (watcherIds.length > 0) {
      const validMembers = await db.projectMember.findMany({
        where: { projectId, userId: { in: watcherIds } },
        select: { userId: true },
      })
      const validUserIds = new Set(validMembers.map((m) => m.userId))
      const invalidWatchers = watcherIds.filter((id) => !validUserIds.has(id))
      if (invalidWatchers.length > 0) {
        return badRequestError('All watchers must be project members')
      }
    }

    // Create ticket with atomic ticket number generation
    const ticket = await db.$transaction(async (tx) => {
      // Get max ticket number for this project
      const maxResult = await tx.ticket.aggregate({
        where: { projectId },
        _max: { number: true },
      })
      const nextNumber = (maxResult._max.number ?? 0) + 1

      // Get max order in target column
      const maxOrderResult = await tx.ticket.aggregate({
        where: { columnId: ticketData.columnId },
        _max: { order: true },
      })
      const nextOrder = (maxOrderResult._max.order ?? -1) + 1

      // Create the ticket
      const newTicket = await tx.ticket.create({
        data: {
          ...ticketData,
          number: nextNumber,
          order: nextOrder,
          projectId,
          creatorId,
          type: ticketData.type as IssueType,
          priority: ticketData.priority as Priority,
          labels: labelIds.length > 0 ? { connect: labelIds.map((id) => ({ id })) } : undefined,
          watchers:
            watcherIds.length > 0
              ? {
                  create: watcherIds.map((userId) => ({ userId })),
                }
              : undefined,
        },
        select: TICKET_SELECT_FULL,
      })

      return newTicket
    })

    // Emit real-time event for other clients
    // Include tabId from header so the originating tab can skip the event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.created',
      projectId,
      ticketId: ticket.id,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(transformTicket(ticket), { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create ticket')
  }
}
