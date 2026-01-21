import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getFileStorage } from '@/lib/upload-storage'

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]
 * Remove an attachment from a ticket and delete the file from disk
 * Requires project membership
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; attachmentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId, attachmentId } = await params

    await requireProjectMember(user.id, projectId)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    // Find the attachment
    const attachment = await db.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    })

    if (!attachment) {
      return notFoundError('Attachment')
    }

    // Delete the attachment record
    await db.attachment.delete({
      where: { id: attachmentId },
    })

    // Try to delete the file from disk
    // The URL is like /uploads/filename.ext, so we need to construct the full path
    if (attachment.url.startsWith('/uploads/')) {
      const filename = attachment.url.replace('/uploads/', '')
      const filepath = getFileStorage().join(process.cwd(), 'public', 'uploads', filename)

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

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete attachment')
  }
}
