import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { SPRINT_SELECT_SUMMARY } from '@/lib/prisma-selects'

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/sprint-history
 * Get sprint history timeline for a ticket
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

    const history = await db.ticketSprintHistory.findMany({
      where: { ticketId },
      include: {
        sprint: {
          select: SPRINT_SELECT_SUMMARY,
        },
      },
      orderBy: { addedAt: 'asc' },
    })

    return NextResponse.json(history)
  } catch (error) {
    return handleApiError(error, 'fetch sprint history')
  }
}
