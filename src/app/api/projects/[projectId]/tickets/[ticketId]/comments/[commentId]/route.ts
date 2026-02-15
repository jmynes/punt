import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { hasPermission } from '@/lib/permissions/check'
import { USER_SELECT_SUMMARY } from '@/lib/prisma-selects'

const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
})

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
 * Get a specific comment
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; commentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, commentId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    const comment = await db.comment.findFirst({
      where: { id: commentId, ticketId },
      include: {
        author: {
          select: USER_SELECT_SUMMARY,
        },
      },
    })

    if (!comment) {
      return notFoundError('Comment')
    }

    return NextResponse.json(comment)
  } catch (error) {
    return handleApiError(error, 'fetch comment')
  }
}

/**
 * PATCH /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
 * Update a comment
 * Requires: comment author OR comments.manage_any permission
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; commentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, commentId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    // Get the comment to check ownership
    const existingComment = await db.comment.findFirst({
      where: { id: commentId, ticketId },
    })

    if (!existingComment) {
      return notFoundError('Comment')
    }

    // Check if user can edit: must be author or have manage_any permission
    const canManageAny = await hasPermission(user.id, projectId, 'comments.manage_any')
    if (existingComment.authorId !== user.id && !canManageAny) {
      return badRequestError('You can only edit your own comments')
    }

    const body = await request.json()
    const parsed = updateCommentSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { content } = parsed.data

    const comment = await db.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: {
          select: USER_SELECT_SUMMARY,
        },
      },
    })

    // Emit SSE event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(comment)
  } catch (error) {
    return handleApiError(error, 'update comment')
  }
}

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
 * Delete a comment
 * Requires: comment author OR comments.manage_any permission
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; commentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, commentId } = await params
    const projectId = await requireProjectByKey(projectKey)

    await requireMembership(user.id, projectId)

    // Get the comment to check ownership
    const existingComment = await db.comment.findFirst({
      where: { id: commentId, ticketId },
    })

    if (!existingComment) {
      return notFoundError('Comment')
    }

    // Check if user can delete: must be author or have manage_any permission
    const canManageAny = await hasPermission(user.id, projectId, 'comments.manage_any')
    if (existingComment.authorId !== user.id && !canManageAny) {
      return badRequestError('You can only delete your own comments')
    }

    await db.comment.delete({
      where: { id: commentId },
    })

    // Emit SSE event
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete comment')
  }
}
