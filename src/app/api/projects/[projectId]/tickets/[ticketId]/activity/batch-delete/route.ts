import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

const BatchDeleteSchema = z
  .object({
    groupId: z.string().optional(),
    activityIds: z.array(z.string()).optional(),
  })
  .refine((data) => data.groupId || (data.activityIds && data.activityIds.length > 0), {
    message: 'Must provide either groupId or activityIds',
  })

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/activity/batch-delete
 * Delete activity entries by groupId or specific IDs.
 * Used by undo system to clean up activity entries when an action is undone.
 *
 * Body:
 *   - groupId: Delete all activities with this group ID
 *   - activityIds: Delete specific activity entries by ID
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey, ticketId } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check project membership
    await requireMembership(user.id, projectId)

    // Verify ticket exists and belongs to project
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true },
    })

    if (!ticket) {
      return notFoundError('Ticket')
    }

    // Parse and validate body
    const body = await request.json()
    const validation = BatchDeleteSchema.safeParse(body)
    if (!validation.success) {
      return validationError(validation)
    }

    const { groupId, activityIds } = validation.data

    let deletedCount = 0

    if (groupId) {
      // Delete all entries with this groupId for this ticket
      const result = await db.ticketActivity.deleteMany({
        where: {
          ticketId,
          groupId,
        },
      })
      deletedCount = result.count
    } else if (activityIds && activityIds.length > 0) {
      // Delete specific entries by ID (ensuring they belong to this ticket)
      const result = await db.ticketActivity.deleteMany({
        where: {
          id: { in: activityIds },
          ticketId,
        },
      })
      deletedCount = result.count
    } else {
      return badRequestError('Must provide groupId or activityIds')
    }

    return NextResponse.json({ deleted: deletedCount })
  } catch (error) {
    return handleApiError(error, 'delete activity entries')
  }
}
