import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import {
  requireAuth,
  requireMembership,
  requireProjectByKey,
  requireTicketPermission,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { TICKET_SELECT_FULL, transformTicket } from '@/lib/prisma-selects'
import { isCompletedColumn } from '@/lib/sprint-utils'
import { type IssueType, type Priority, RESOLUTIONS } from '@/types'

const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['epic', 'story', 'task', 'bug', 'subtask']).optional(),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).optional(),
  columnId: z.string().min(1).optional(),
  order: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  creatorId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  estimate: z.string().nullable().optional(),
  resolution: z.enum(RESOLUTIONS).nullable().optional(),
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

/**
 * GET /api/projects/[projectId]/tickets/[ticketId] - Get a single ticket
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: TICKET_SELECT_FULL,
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    return NextResponse.json(transformTicket(ticket))
  } catch (error) {
    return handleApiError(error, 'fetch ticket')
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
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check if ticket exists and belongs to project, get creator for permission check
    const existingTicket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: {
        id: true,
        columnId: true,
        sprintId: true,
        creatorId: true,
        resolution: true,
        column: { select: { name: true } },
      },
    })

    if (!existingTicket) {
      return notFoundError('Ticket')
    }

    // Check ticket edit permission (own ticket or any ticket)
    await requireTicketPermission(user.id, projectId, existingTicket.creatorId, 'edit')

    const body = await request.json()
    const parsed = updateTicketSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { labelIds, watcherIds, ...updateData } = parsed.data

    // If changing column, verify new column belongs to project
    if (updateData.columnId && updateData.columnId !== existingTicket.columnId) {
      const column = await db.column.findFirst({
        where: { id: updateData.columnId, projectId },
      })

      if (!column) {
        return badRequestError('Column not found or does not belong to project')
      }
    }

    // Validate parentId: prevent self-referencing and circular parent chains
    if (updateData.parentId !== undefined && updateData.parentId !== null) {
      // Prevent direct self-referencing
      if (updateData.parentId === ticketId) {
        return badRequestError('Cannot set parent: ticket cannot be its own parent')
      }

      // Walk up the parent chain from the proposed parent to detect cycles
      const MAX_DEPTH = 50
      let currentId: string | null = updateData.parentId
      let depth = 0

      while (currentId && depth < MAX_DEPTH) {
        const parent = await db.ticket.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        })

        if (!parent) break

        if (parent.parentId === ticketId) {
          return badRequestError('Cannot set parent: would create a circular reference')
        }

        currentId = parent.parentId
        depth++
      }

      if (depth >= MAX_DEPTH) {
        return badRequestError('Cannot set parent: parent chain exceeds maximum depth')
      }
    }

    // Validate assigneeId is a project member (if provided and not null)
    if (updateData.assigneeId !== undefined && updateData.assigneeId !== null) {
      const assigneeMembership = await db.projectMember.findUnique({
        where: { userId_projectId: { userId: updateData.assigneeId, projectId } },
      })
      if (!assigneeMembership) {
        return badRequestError('Assignee must be a project member')
      }
    }

    // Validate creatorId (reporter) is a project member (if provided and not null)
    if (updateData.creatorId !== undefined && updateData.creatorId !== null) {
      const reporterMembership = await db.projectMember.findUnique({
        where: { userId_projectId: { userId: updateData.creatorId, projectId } },
      })
      if (!reporterMembership) {
        return badRequestError('Reporter must be a project member')
      }
    }

    // Validate all watcherIds are project members (if provided)
    if (watcherIds !== undefined && watcherIds.length > 0) {
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

    // Auto-couple resolution ↔ column status
    if (dbUpdateData.columnId) {
      const targetCol = await db.column.findUnique({
        where: { id: dbUpdateData.columnId as string },
        select: { name: true },
      })
      if (targetCol) {
        if (
          isCompletedColumn(targetCol.name) &&
          !dbUpdateData.resolution &&
          !existingTicket.resolution
        ) {
          // Moving to a "done" column → auto-set resolution to "Done"
          dbUpdateData.resolution = 'Done'
          dbUpdateData.resolvedAt = new Date()
        } else if (
          !isCompletedColumn(targetCol.name) &&
          dbUpdateData.resolution === undefined &&
          existingTicket.resolution
        ) {
          // Moving out of a "done" column to a non-done column → clear resolution
          dbUpdateData.resolution = null
          dbUpdateData.resolvedAt = null
        }
      }
    }

    // Setting a resolution auto-moves ticket to first "done" column (if not already there)
    if (dbUpdateData.resolution && !dbUpdateData.columnId) {
      const currentColName = existingTicket.column.name
      if (!isCompletedColumn(currentColName)) {
        const allCols = await db.column.findMany({
          where: { projectId },
          orderBy: { order: 'asc' },
          select: { id: true, name: true },
        })
        const doneColumn = allCols.find((c) => isCompletedColumn(c.name))
        if (doneColumn) {
          dbUpdateData.columnId = doneColumn.id
        }
      }
    }

    // Track resolvedAt when resolution is explicitly set or cleared
    if (dbUpdateData.resolution !== undefined) {
      if (dbUpdateData.resolution && !existingTicket.resolution) {
        // Resolution being set (and wasn't set before) → set resolvedAt
        dbUpdateData.resolvedAt = dbUpdateData.resolvedAt ?? new Date()
      } else if (dbUpdateData.resolution === null && existingTicket.resolution) {
        // Resolution being cleared → clear resolvedAt
        dbUpdateData.resolvedAt = null
      }
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

    const ticket = await db.ticket
      .update({
        where: { id: ticketId },
        data: dbUpdateData,
        select: TICKET_SELECT_FULL,
      })
      .catch((dbError) => {
        console.error('Prisma update error:', dbError)
        console.error('Update data was:', JSON.stringify(dbUpdateData, null, 2))
        throw dbError
      })

    // Emit real-time event for other clients
    // Use 'ticket.moved' if column changed, 'ticket.sprint_changed' if sprint changed, otherwise 'ticket.updated'
    // Include tabId from header so the originating tab can skip the event
    const columnChanged = dbUpdateData.columnId && dbUpdateData.columnId !== existingTicket.columnId
    const sprintChanged =
      updateData.sprintId !== undefined && updateData.sprintId !== existingTicket.sprintId
    const tabId = request.headers.get('X-Tab-Id') || undefined

    const eventType = columnChanged
      ? 'ticket.moved'
      : sprintChanged
        ? 'ticket.sprint_changed'
        : 'ticket.updated'

    projectEvents.emitTicketEvent({
      type: eventType,
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(transformTicket(ticket))
  } catch (error) {
    return handleApiError(error, 'update ticket')
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
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check if ticket exists and belongs to project, get creator for permission check
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true, creatorId: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    // Check ticket delete permission (own ticket or any ticket)
    await requireTicketPermission(user.id, projectId, ticket.creatorId, 'delete')

    // Delete the ticket (cascades to watchers, comments, attachments, etc.)
    await db.ticket.delete({
      where: { id: ticketId },
    })

    // Emit real-time event for other clients
    // Include tabId from header so the originating tab can skip the event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.deleted',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete ticket')
  }
}
