import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * Schema for restoring activities with their original data.
 * Used when undoing ticket deletion to restore the audit trail.
 */
const restoreActivitiesSchema = z.object({
  activities: z.array(
    z.object({
      action: z.string().min(1, 'Action is required'),
      field: z.string().nullable().optional(),
      oldValue: z.string().nullable().optional(),
      newValue: z.string().nullable().optional(),
      groupId: z.string().nullable().optional(),
      userId: z.string().nullable().optional(),
      createdAt: z.string().min(1, 'CreatedAt is required'), // ISO date string
    }),
  ),
})

/**
 * POST /api/projects/[projectId]/tickets/[ticketId]/activity/restore
 * Restore activities with their original data (for undo operations).
 * This preserves the audit trail when a ticket is deleted and then restored.
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
    const parsed = restoreActivitiesSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { activities: activitiesToRestore } = parsed.data

    if (activitiesToRestore.length === 0) {
      return NextResponse.json({ activities: [], restored: 0 })
    }

    // Verify all user IDs exist (they might have been deleted since)
    const userIds = [
      ...new Set(
        activitiesToRestore.map((a) => a.userId).filter((id): id is string => id !== null),
      ),
    ]
    const existingUsers =
      userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true },
          })
        : []
    const existingUserIds = new Set(existingUsers.map((u) => u.id))

    // Create all activities in a transaction, preserving original timestamps
    const createdActivities = await db.$transaction(
      activitiesToRestore.map((activityData) =>
        db.ticketActivity.create({
          data: {
            ticketId,
            action: activityData.action,
            field: activityData.field ?? null,
            oldValue: activityData.oldValue ?? null,
            newValue: activityData.newValue ?? null,
            groupId: activityData.groupId ?? null,
            // Only set userId if the user still exists
            userId:
              activityData.userId && existingUserIds.has(activityData.userId)
                ? activityData.userId
                : null,
            // Preserve original timestamp
            createdAt: new Date(activityData.createdAt),
          },
        }),
      ),
    )

    return NextResponse.json({
      restored: createdActivities.length,
    })
  } catch (error) {
    return handleApiError(error, 'restore activities')
  }
}
