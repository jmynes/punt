import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { logTicketActivity } from '@/lib/audit'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { INVERSE_LINK_TYPES, LINK_TYPE_LABELS, type LinkType } from '@/types'

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
        linkType: true,
        fromTicketId: true,
        toTicketId: true,
        fromTicket: { select: { number: true, project: { select: { key: true } } } },
        toTicket: { select: { number: true, project: { select: { key: true } } } },
      },
    })

    if (!link) {
      return notFoundError('Ticket link')
    }

    // Capture link info before deletion for activity logging
    const linkType = link.linkType as LinkType
    const fromKey = `${link.fromTicket.project.key}-${link.fromTicket.number}`
    const toKey = `${link.toTicket.project.key}-${link.toTicket.number}`
    const linkLabel = LINK_TYPE_LABELS[linkType].toLowerCase()
    const inverseLinkLabel = LINK_TYPE_LABELS[INVERSE_LINK_TYPES[linkType]].toLowerCase()

    // Delete the link
    await db.ticketLink.delete({
      where: { id: linkId },
    })

    // Log activity on both tickets (fire-and-forget)
    // On fromTicket: "Link to <toKey> (<linkType>) removed"
    logTicketActivity(link.fromTicketId, user.id, 'unlinked', {
      field: 'link',
      oldValue: JSON.stringify({
        ticketKey: toKey,
        ticketId: link.toTicketId,
        linkType: linkLabel,
      }),
    })
    // On toTicket: "Link to <fromKey> (<inverseLinkType>) removed"
    logTicketActivity(link.toTicketId, user.id, 'unlinked', {
      field: 'link',
      oldValue: JSON.stringify({
        ticketKey: fromKey,
        ticketId: link.fromTicketId,
        linkType: inverseLinkLabel,
      }),
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
