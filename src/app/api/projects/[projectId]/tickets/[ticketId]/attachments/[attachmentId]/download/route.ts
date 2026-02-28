import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]/download
 * Stream the attachment file content.
 * Requires project membership.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; attachmentId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, attachmentId } = await params
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

    // Find the attachment
    const attachment = await db.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      select: { id: true, filename: true, mimeType: true, size: true, url: true },
    })

    if (!attachment) {
      return notFoundError('Attachment')
    }

    // Resolve file path from URL (e.g., "/uploads/file.png" → "public/uploads/file.png")
    const filePath = join(process.cwd(), 'public', attachment.url)

    // Verify file exists on disk
    try {
      await stat(filePath)
    } catch {
      return notFoundError('Attachment file')
    }

    // Stream the file
    const stream = createReadStream(filePath)
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk))
        })
        stream.on('end', () => {
          controller.close()
        })
        stream.on('error', (err) => {
          controller.error(err)
        })
      },
      cancel() {
        stream.destroy()
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(attachment.size),
        'Content-Disposition': `attachment; filename="${attachment.filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'download attachment')
  }
}
