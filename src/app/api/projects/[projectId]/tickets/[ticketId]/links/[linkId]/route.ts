import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'

/**
 * DELETE /api/projects/[projectId]/tickets/[ticketId]/links/[linkId]
 * Delete a ticket link
 * Requires project membership
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string; linkId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId, linkId } = await params
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

    // Find the link (it could be either direction)
    const link = await db.ticketLink.findFirst({
      where: {
        id: linkId,
        OR: [{ fromTicketId: ticketId }, { toTicketId: ticketId }],
      },
      select: {
        id: true,
        fromTicketId: true,
        toTicketId: true,
      },
    })

    if (!link) {
      return notFoundError('Ticket link')
    }

    // Delete the link
    await db.ticketLink.delete({
      where: { id: linkId },
    })

    // Emit SSE events for both tickets
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId: link.fromTicketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId: link.toTicketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete ticket link')
  }
}
