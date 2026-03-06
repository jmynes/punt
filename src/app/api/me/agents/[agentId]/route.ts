import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

const updateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
})

/**
 * PATCH /api/me/agents/[agentId] - Update an agent's name
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const currentUser = await requireAuth()
    const { agentId } = await params

    // Verify the agent exists and belongs to the current user
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      select: { id: true, ownerId: true },
    })

    if (!agent || agent.ownerId !== currentUser.id) {
      return notFoundError('Agent')
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = updateAgentSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const updated = await db.agent.update({
      where: { id: agentId },
      data: { name: parsed.data.name },
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
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'update agent')
  }
}
