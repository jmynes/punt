import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAttachmentPermission, requireAuth, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'

const updateAttachmentSchema = z.object({
  purpose: z
    .enum(['plan', 'session_transcript', 'screenshot', 'reference', 'other'])
    .nullable()
    .optional(),
  sourceCommit: z.string().max(40).nullable().optional(),
  commitDirtyStatus: z.string().nullable().optional(),
})

/**
 * PATCH /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]
 * Update attachment metadata (purpose, sourceCommit, commitDirtyStatus).
 * Requires ownership or attachments.manage_any permission.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; attachmentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, attachmentId } = await params
    const projectId = await requireProjectByKey(projectKey)

    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    const attachment = await db.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      select: { id: true, uploaderId: true },
    })

    if (!attachment) {
      return notFoundError('Attachment')
    }

    await requireAttachmentPermission(user.id, projectId, attachment.uploaderId, 'delete')

    const body = await request.json()
    const parsed = updateAttachmentSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.purpose !== undefined) data.purpose = parsed.data.purpose
    if (parsed.data.sourceCommit !== undefined) data.sourceCommit = parsed.data.sourceCommit
    if (parsed.data.commitDirtyStatus !== undefined)
      data.commitDirtyStatus = parsed.data.commitDirtyStatus

    const updated = await db.attachment.update({
      where: { id: attachmentId },
      data,
    })

    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'update attachment')
  }
}

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]
 * Remove an attachment record from the database.
 * NOTE: The file on disk is intentionally NOT deleted. This allows undo-delete
 * to restore the DB record while the file still exists. Orphaned files from
 * non-undone deletes can be cleaned up by a future garbage collection process.
 * Requires ownership or attachments.manage_any permission.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; attachmentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, attachmentId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    // Find the attachment with uploader info
    const attachment = await db.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      select: { id: true, url: true, uploaderId: true },
    })

    if (!attachment) {
      return notFoundError('Attachment')
    }

    // Check permission: uploader can delete own, or need attachments.manage_any
    await requireAttachmentPermission(user.id, projectId, attachment.uploaderId, 'delete')

    // Delete only the DB record; file on disk is kept for undo support
    await db.attachment.delete({
      where: { id: attachmentId },
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

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete attachment')
  }
}
