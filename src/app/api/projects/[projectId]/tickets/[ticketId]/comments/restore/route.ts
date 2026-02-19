import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { USER_SELECT_SUMMARY } from '@/lib/prisma-selects'

/**
 * Schema for restoring comments with their original data.
 * Used when undoing ticket deletion to restore comments with original authors.
 */
const restoreCommentsSchema = z.object({
  comments: z.array(
    z.object({
      content: z.string().min(1, 'Comment content is required'),
      authorId: z.string().min(1, 'Author ID is required'),
      isSystemGenerated: z.boolean().optional().default(false),
      source: z.string().optional(),
      createdAt: z.string().optional(), // ISO date string for preserving original timestamp
    }),
  ),
})

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/comments/restore
 * Restore comments with their original author (for undo operations).
 * Requires project membership.
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
    const parsed = restoreCommentsSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { comments: commentsToRestore } = parsed.data

    // Verify all author IDs exist (they might have been deleted since)
    const authorIds = [...new Set(commentsToRestore.map((c) => c.authorId))]
    const existingUsers = await db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true },
    })
    const existingUserIds = new Set(existingUsers.map((u) => u.id))

    // Filter to only comments with existing authors
    // If an author was deleted, we'll skip that comment (or could fall back to current user)
    const validComments = commentsToRestore.filter((c) => existingUserIds.has(c.authorId))

    if (validComments.length === 0) {
      return NextResponse.json({ comments: [], skipped: commentsToRestore.length })
    }

    // Create all comments in a transaction
    const createdComments = await db.$transaction(
      validComments.map((commentData) =>
        db.comment.create({
          data: {
            content: commentData.content,
            authorId: commentData.authorId,
            isSystemGenerated: commentData.isSystemGenerated,
            source: commentData.source,
            ticketId,
            // Note: createdAt will be set to now() by Prisma default
            // We could optionally preserve original timestamp if needed
          },
          include: {
            author: {
              select: USER_SELECT_SUMMARY,
            },
          },
        }),
      ),
    )

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

    return NextResponse.json({
      comments: createdComments,
      restored: createdComments.length,
      skipped: commentsToRestore.length - validComments.length,
    })
  } catch (error) {
    return handleApiError(error, 'restore comments')
  }
}
