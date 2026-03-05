import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

const updateAgentSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters')
    .optional(),
  isActive: z.boolean().optional(),
})

/**
 * PATCH /api/admin/agents/[agentId] - Update an agent
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    await requireSystemAdmin()

    const { agentId } = await params

    const existing = await db.agent.findUnique({
      where: { id: agentId },
    })

    if (!existing) {
      return notFoundError('Agent')
    }

    const body = await request.json()
    const parsed = updateAgentSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const updates = parsed.data

    const agent = await db.agent.update({
      where: { id: agentId },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
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
    })

    return NextResponse.json(agent)
  } catch (error) {
    return handleApiError(error, 'update agent')
  }
}
