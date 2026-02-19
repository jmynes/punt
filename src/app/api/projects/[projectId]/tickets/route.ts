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
import { isCompletedColumn } from '@/lib/sprint-utils'
import { type IssueType, type Priority, RESOLUTIONS } from '@/types'

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
  resolution: z.enum(RESOLUTIONS).nullable().optional(),
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
  // For undo/restore operations - preserve original creation timestamp
  createdAt: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
})

/**
 * GET /api/projects/[projectId]/tickets - List all tickets for a project
 * Requires project membership
 *
 * Query parameters:
 * - hasAttachments: 'true' | 'false' - filter by whether ticket has attachments
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    // Parse query parameters
    const url = new URL(request.url)
    const hasAttachmentsParam = url.searchParams.get('hasAttachments')

    // Build where clause
    const where: { projectId: string; attachments?: { some?: object; none?: object } } = {
      projectId,
    }

    // Filter by attachment presence
    if (hasAttachmentsParam === 'true') {
      where.attachments = { some: {} }
    } else if (hasAttachmentsParam === 'false') {
      where.attachments = { none: {} }
    }

    const tickets = await db.ticket.findMany({
      where,
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
          // Set resolvedAt if ticket is created with a resolution
          resolvedAt: ticketData.resolution ? new Date() : undefined,
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

const batchMoveTicketsSchema = z.object({
  ticketIds: z.array(z.string()).min(1),
  toColumnId: z.string().min(1),
  newOrder: z.number().int().min(0),
})

/**
 * PATCH /api/projects/[projectId]/tickets - Batch move tickets to a column
 * Requires project membership and ticket edit permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check ticket manage permission
    await requirePermission(user.id, projectId, PERMISSIONS.TICKETS_MANAGE_ANY)

    const body = await request.json()
    const parsed = batchMoveTicketsSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { ticketIds, toColumnId, newOrder } = parsed.data

    // Verify target column belongs to project
    const targetColumn = await db.column.findFirst({
      where: { id: toColumnId, projectId },
    })

    if (!targetColumn) {
      return badRequestError('Target column not found or does not belong to project')
    }

    // Verify all tickets exist and belong to project
    const tickets = await db.ticket.findMany({
      where: { id: { in: ticketIds }, projectId },
      select: {
        id: true,
        columnId: true,
        resolution: true,
        order: true,
      },
      orderBy: { order: 'asc' },
    })

    if (tickets.length !== ticketIds.length) {
      return badRequestError('One or more tickets not found or do not belong to project')
    }

    // Determine if target column is a "done" column for resolution auto-coupling
    const targetIsDone = isCompletedColumn(targetColumn.name)

    // Update all tickets in a transaction
    const updatedTickets = await db.$transaction(async (tx) => {
      const results = []
      let currentOrder = newOrder

      // Process tickets in the order they were provided (preserves selection order)
      for (const ticketId of ticketIds) {
        const ticket = tickets.find((t) => t.id === ticketId)
        if (!ticket) continue

        // Build update data with resolution auto-coupling
        const updateData: Record<string, unknown> = {
          columnId: toColumnId,
          order: currentOrder,
        }

        // Auto-couple resolution when moving to/from done column
        if (targetIsDone && !ticket.resolution) {
          updateData.resolution = 'Done'
          updateData.resolvedAt = new Date()
        } else if (!targetIsDone && ticket.resolution) {
          updateData.resolution = null
          updateData.resolvedAt = null
        }

        const updated = await tx.ticket.update({
          where: { id: ticketId },
          data: updateData,
          select: TICKET_SELECT_FULL,
        })

        results.push(updated)
        currentOrder++
      }

      // Reorder other tickets in the target column to make room
      // Get all tickets in target column that are NOT in the moved set
      const otherTicketsInTarget = await tx.ticket.findMany({
        where: {
          columnId: toColumnId,
          projectId,
          id: { notIn: ticketIds },
        },
        orderBy: { order: 'asc' },
        select: { id: true, order: true },
      })

      // Reindex tickets that come after the insertion point
      let reorderIdx = 0
      for (const t of otherTicketsInTarget) {
        const newIdx = reorderIdx >= newOrder ? reorderIdx + ticketIds.length : reorderIdx
        if (t.order !== newIdx) {
          await tx.ticket.update({
            where: { id: t.id },
            data: { order: newIdx },
          })
        }
        reorderIdx++
      }

      return results
    })

    // Emit real-time events for each moved ticket
    const tabId = request.headers.get('X-Tab-Id') || undefined
    for (const ticket of updatedTickets) {
      projectEvents.emitTicketEvent({
        type: 'ticket.moved',
        projectId,
        ticketId: ticket.id,
        userId: user.id,
        tabId,
        timestamp: Date.now(),
      })
    }

    return NextResponse.json(updatedTickets.map(transformTicket))
  } catch (error) {
    return handleApiError(error, 'batch move tickets')
  }
}
