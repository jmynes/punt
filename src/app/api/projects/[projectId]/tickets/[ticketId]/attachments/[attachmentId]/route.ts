import path from 'node:path'
import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAttachmentPermission, requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { logger } from '@/lib/logger'
import { getFileStorage } from '@/lib/upload-storage'

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]
 * Remove an attachment from a ticket and delete the file from disk
 * Requires ownership or attachments.manage_any permission
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; attachmentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId, attachmentId } = await params

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

    // Delete the attachment record
    await db.attachment.delete({
      where: { id: attachmentId },
    })

    // Try to delete the file from disk
    // The URL is like /uploads/filename.ext, so we need to construct the full path
    if (attachment.url.startsWith('/uploads/')) {
      const filename = attachment.url.replace('/uploads/', '')

      // Security: Prevent path traversal attacks
      // Reject filenames containing path separators or parent directory references
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        logger.warn('Path traversal attempt blocked in attachment deletion', {
          attachmentId,
          filename,
        })
        // Still return success since the DB record is deleted
        return NextResponse.json({ success: true })
      }

      const uploadDir = getFileStorage().join(process.cwd(), 'public', 'uploads')
      const filepath = getFileStorage().join(uploadDir, filename)

      // Additional check: Ensure resolved path is within uploads directory
      const resolvedPath = path.resolve(filepath)
      const resolvedUploadDir = path.resolve(uploadDir)
      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        logger.warn('Path traversal attempt blocked (resolved path check)', {
          attachmentId,
          filepath,
          resolvedPath,
        })
        return NextResponse.json({ success: true })
      }

      try {
        await getFileStorage().deleteFile(filepath)
        logger.info('Deleted attachment file', { filepath, attachmentId })
      } catch (fileError) {
        // Log but don't fail - file might not exist anymore
        logger.warn('Failed to delete attachment file', {
          filepath,
          attachmentId,
          error: fileError instanceof Error ? fileError.message : String(fileError),
        })
      }
    }

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
