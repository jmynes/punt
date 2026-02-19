import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { LINK_TYPES, type LinkType } from '@/types'

/**
 * Schema for restoring ticket links.
 * Used when undoing ticket deletion to restore links to other tickets.
 */
const restoreLinksSchema = z.object({
  links: z.array(
    z.object({
      linkType: z.enum(LINK_TYPES),
      linkedTicketId: z.string().min(1),
      direction: z.enum(['outward', 'inward']),
    }),
  ),
})

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/links/restore
 * Restore ticket links (for undo operations).
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
    const parsed = restoreLinksSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { links: linksToRestore } = parsed.data

    // Verify all linked tickets still exist
    const linkedTicketIds = [...new Set(linksToRestore.map((l) => l.linkedTicketId))]
    const existingTickets = await db.ticket.findMany({
      where: { id: { in: linkedTicketIds }, projectId },
      select: { id: true },
    })
    const existingTicketIds = new Set(existingTickets.map((t) => t.id))

    // Filter to only links with existing target tickets
    const validLinks = linksToRestore.filter((l) => existingTicketIds.has(l.linkedTicketId))

    if (validLinks.length === 0) {
      return NextResponse.json({ links: [], restored: 0, skipped: linksToRestore.length })
    }

    // Create links, skipping any that already exist
    const createdLinks: Array<{ id: string; linkType: LinkType; linkedTicketId: string }> = []
    let skippedCount = linksToRestore.length - validLinks.length

    for (const linkData of validLinks) {
      // Determine from/to based on direction
      const fromTicketId = linkData.direction === 'outward' ? ticketId : linkData.linkedTicketId
      const toTicketId = linkData.direction === 'outward' ? linkData.linkedTicketId : ticketId

      // Check if link already exists
      const existing = await db.ticketLink.findFirst({
        where: {
          fromTicketId,
          toTicketId,
          linkType: linkData.linkType,
        },
      })

      if (existing) {
        skippedCount++
        continue
      }

      try {
        const link = await db.ticketLink.create({
          data: {
            fromTicketId,
            toTicketId,
            linkType: linkData.linkType,
          },
        })
        createdLinks.push({
          id: link.id,
          linkType: link.linkType as LinkType,
          linkedTicketId: linkData.linkedTicketId,
        })
      } catch {
        // Link creation failed (e.g., unique constraint), skip it
        skippedCount++
      }
    }

    // Emit SSE events for all affected tickets
    const tabId = request.headers.get('X-Tab-Id') || undefined
    const affectedTicketIds = new Set([ticketId, ...createdLinks.map((l) => l.linkedTicketId)])
    for (const affectedId of affectedTicketIds) {
      projectEvents.emitTicketEvent({
        type: 'ticket.updated',
        projectId,
        ticketId: affectedId,
        userId: user.id,
        tabId,
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({
      links: createdLinks,
      restored: createdLinks.length,
      skipped: skippedCount,
    })
  } catch (error) {
    return handleApiError(error, 'restore ticket links')
  }
}
