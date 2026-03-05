import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/admin/agents - List all agents with owner info and activity counts
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const agents = await db.agent.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastActiveAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            avatar: true,
            avatarColor: true,
          },
        },
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
