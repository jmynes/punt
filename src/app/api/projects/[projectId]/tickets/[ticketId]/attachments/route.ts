import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { getSystemSettings } from '@/lib/system-settings'

const addAttachmentsSchema = z.object({
  attachments: z.array(
    z.object({
      filename: z.string().min(1),
      originalName: z.string().min(1),
      mimeType: z.string().min(1),
      size: z.number().int().positive(),
      url: z.string().min(1),
    }),
  ),
})

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/attachments
 * Get all attachments for a ticket
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId } = await params

    await requireProjectMember(user.id, projectId)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    const attachments = await db.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    return handleApiError(error, 'fetch attachments')
  }
}

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/attachments
 * Link uploaded files to a ticket
 * Requires project membership
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId, ticketId } = await params

    await requireProjectMember(user.id, projectId)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    const body = await request.json()
    const parsed = addAttachmentsSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    // Get system settings for max attachments limit
    const settings = await getSystemSettings()

    // Count existing attachments
    const existingCount = await db.attachment.count({
      where: { ticketId },
    })

    const newAttachments = parsed.data.attachments
    const totalCount = existingCount + newAttachments.length

    if (totalCount > settings.maxAttachmentsPerTicket) {
      return badRequestError(
        `Cannot add ${newAttachments.length} attachments. Ticket already has ${existingCount} of ${settings.maxAttachmentsPerTicket} maximum attachments.`,
      )
    }

    // Create attachment records
    const created = await db.attachment.createManyAndReturn({
      data: newAttachments.map((attachment) => ({
        ticketId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        url: attachment.url,
      })),
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'add attachments')
  }
}
