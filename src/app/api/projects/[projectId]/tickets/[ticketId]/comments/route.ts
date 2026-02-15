import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { USER_SELECT_SUMMARY } from '@/lib/prisma-selects'

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  isSystemGenerated: z.boolean().optional().default(false),
  source: z.string().optional(),
})

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/comments
 * Get all comments for a ticket
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

    await requireMembership(user.id, projectId)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    const comments = await db.comment.findMany({
      where: { ticketId },
      include: {
        author: {
          select: USER_SELECT_SUMMARY,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(comments)
  } catch (error) {
    return handleApiError(error, 'fetch comments')
  }
}

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/comments
 * Add a comment to a ticket
 * Requires project membership
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    const body = await request.json()
    const parsed = createCommentSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { content, isSystemGenerated, source } = parsed.data

    const comment = await db.comment.create({
      data: {
        content,
        isSystemGenerated,
        source,
        ticketId,
        authorId: user.id,
      },
      include: {
        author: {
          select: USER_SELECT_SUMMARY,
        },
      },
    })

    // Emit SSE event so other clients refresh the ticket
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create comment')
  }
}
