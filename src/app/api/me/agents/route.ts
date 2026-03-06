import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/me/agents - List the current user's agents with activity counts
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const agents = await db.agent.findMany({
      where: { ownerId: currentUser.id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastActiveAt: true,
        _count: {
          select: { ticketsCreated: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(agents)
  } catch (error) {
    return handleApiError(error, 'list agents')
  }
}
