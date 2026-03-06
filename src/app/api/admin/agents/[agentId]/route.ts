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

/**
 * DELETE /api/admin/agents/[agentId] - Delete an agent record
 *
 * Removes the agent from the database. If the agent has created tickets,
 * those tickets will have their createdByAgentId set to null (Prisma onDelete: SetNull).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    await requireSystemAdmin()

    const { agentId } = await params

    const existing = await db.agent.findUnique({
      where: { id: agentId },
      select: { id: true, apiKeyHash: true, ownerId: true },
    })

    if (!existing) {
      return notFoundError('Agent')
    }

    // If this agent's key hash matches the owner's current mcpApiKey, clear it
    const owner = await db.user.findUnique({
      where: { id: existing.ownerId },
      select: { mcpApiKey: true },
    })

    await db.$transaction(async (tx) => {
      if (owner?.mcpApiKey && owner.mcpApiKey === existing.apiKeyHash) {
        await tx.user.update({
          where: { id: existing.ownerId },
          data: { mcpApiKey: null, mcpApiKeyEncrypted: null, mcpApiKeyHint: null },
        })
      }

      // Clear agent attribution on tickets before deleting
      await tx.ticket.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: null },
      })

      await tx.agent.delete({ where: { id: agentId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'delete agent')
  }
}
