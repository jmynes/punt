import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { INVERSE_LINK_TYPES, LINK_TYPES, type LinkType } from '@/types'

const createLinkSchema = z.object({
  linkType: z.enum(LINK_TYPES),
  targetTicketId: z.string().min(1),
})

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/links
 * Get all links for a ticket (both directions)
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

    // Get links in both directions
    const [linkedFrom, linkedTo] = await Promise.all([
      db.ticketLink.findMany({
        where: { fromTicketId: ticketId },
        select: {
          id: true,
          linkType: true,
          toTicket: {
            select: {
              id: true,
              number: true,
              title: true,
              type: true,
              priority: true,
              columnId: true,
              resolution: true,
            },
          },
        },
      }),
      db.ticketLink.findMany({
        where: { toTicketId: ticketId },
        select: {
          id: true,
          linkType: true,
          fromTicket: {
            select: {
              id: true,
              number: true,
              title: true,
              type: true,
              priority: true,
              columnId: true,
              resolution: true,
            },
          },
        },
      }),
    ])

    // Transform to unified format
    const links = [
      ...linkedFrom.map((link) => ({
        id: link.id,
        linkType: link.linkType as LinkType,
        linkedTicket: link.toTicket,
        direction: 'outward' as const,
      })),
      ...linkedTo.map((link) => ({
        id: link.id,
        linkType: link.linkType as LinkType,
        linkedTicket: link.fromTicket,
        direction: 'inward' as const,
      })),
    ]

    return NextResponse.json(links)
  } catch (error) {
    return handleApiError(error, 'fetch ticket links')
  }
}

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/links
 * Create a new link between tickets
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

    // Verify source ticket exists and belongs to project
    const sourceTicket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!sourceTicket) {
      return notFoundError('Source ticket')
    }

    const body = await request.json()
    const parsed = createLinkSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { linkType, targetTicketId } = parsed.data

    // Prevent self-linking
    if (ticketId === targetTicketId) {
      return badRequestError('Cannot link a ticket to itself')
    }

    // Verify target ticket exists and belongs to the same project
    const targetTicket = await db.ticket.findFirst({
      where: { id: targetTicketId, projectId },
      select: {
        id: true,
        number: true,
        title: true,
        type: true,
        priority: true,
        columnId: true,
        resolution: true,
      },
    })

    if (!targetTicket) {
      return badRequestError('Target ticket not found or belongs to a different project')
    }

    // Check if this exact link already exists
    const existingLink = await db.ticketLink.findFirst({
      where: {
        OR: [
          { fromTicketId: ticketId, toTicketId: targetTicketId, linkType },
          // Also check for inverse link (e.g., if A blocks B, B is_blocked_by A)
          {
            fromTicketId: targetTicketId,
            toTicketId: ticketId,
            linkType: INVERSE_LINK_TYPES[linkType],
          },
        ],
      },
    })

    if (existingLink) {
      return badRequestError('This link already exists')
    }

    // Create the link
    const link = await db.ticketLink.create({
      data: {
        fromTicketId: ticketId,
        toTicketId: targetTicketId,
        linkType,
      },
      select: {
        id: true,
        linkType: true,
        toTicket: {
          select: {
            id: true,
            number: true,
            title: true,
            type: true,
            priority: true,
            columnId: true,
            resolution: true,
          },
        },
      },
    })

    // Emit SSE events for both tickets
    const tabId = request.headers.get('X-Tab-Id') || undefined
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })
    projectEvents.emitTicketEvent({
      type: 'ticket.updated',
      projectId,
      ticketId: targetTicketId,
      userId: user.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(
      {
        id: link.id,
        linkType: link.linkType as LinkType,
        linkedTicket: link.toTicket,
        direction: 'outward' as const,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error, 'create ticket link')
  }
}
