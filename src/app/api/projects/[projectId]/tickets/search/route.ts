import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { TICKET_SELECT_FULL, transformTicket } from '@/lib/prisma-selects'

/**
 * GET /api/projects/[projectId]/tickets/search?q=...
 * Search tickets within a project by title, description, or ticket key/number.
 * Results are sorted by relevance: exact key match first, then title matches, then description.
 * Requires project membership.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

    if (!query) {
      return NextResponse.json([])
    }

    // Get the project key for ticket key matching (e.g., "PUNT-123")
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    })

    if (!project) {
      return NextResponse.json([])
    }

    // Check if query matches a ticket key pattern (e.g., "PUNT-123" or just "123")
    let ticketNumber: number | null = null
    const keyPattern = new RegExp(`^${project.key}-(\\d+)$`, 'i')
    const keyMatch = query.match(keyPattern)
    if (keyMatch) {
      ticketNumber = Number.parseInt(keyMatch[1], 10)
    } else if (/^\d+$/.test(query)) {
      ticketNumber = Number.parseInt(query, 10)
    }

    // Search using Prisma contains (maps to SQLite LIKE, case-insensitive by default)
    const tickets = await db.ticket.findMany({
      where: {
        projectId,
        OR: [
          // Match by ticket number (exact)
          ...(ticketNumber !== null ? [{ number: ticketNumber }] : []),
          // Match by title (LIKE)
          { title: { contains: query } },
          // Match by description (LIKE)
          { description: { contains: query } },
        ],
      },
      select: TICKET_SELECT_FULL,
      take: limit,
      orderBy: [{ updatedAt: 'desc' }],
    })

    // Sort results by relevance:
    // 1. Exact ticket number match
    // 2. Title contains the query
    // 3. Description contains the query
    const sortedTickets = tickets.sort((a, b) => {
      const aIsExactKey = ticketNumber !== null && a.number === ticketNumber
      const bIsExactKey = ticketNumber !== null && b.number === ticketNumber
      if (aIsExactKey && !bIsExactKey) return -1
      if (!aIsExactKey && bIsExactKey) return 1

      const queryLower = query.toLowerCase()
      const aTitleMatch = a.title.toLowerCase().includes(queryLower)
      const bTitleMatch = b.title.toLowerCase().includes(queryLower)
      if (aTitleMatch && !bTitleMatch) return -1
      if (!aTitleMatch && bTitleMatch) return 1

      // Both match in same category, sort by updated date (most recent first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return NextResponse.json(sortedTickets.map(transformTicket))
  } catch (error) {
    return handleApiError(error, 'search tickets')
  }
}
