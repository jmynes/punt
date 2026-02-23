import { NextResponse } from 'next/server'
import { handleApiError, notFoundError } from '@/lib/api-utils'
import { requireAuth, requireMembership, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { USER_SELECT_SUMMARY } from '@/lib/prisma-selects'

/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/activity
 * Returns a unified activity timeline including audit trail entries and comments.
 * Supports cursor-based pagination.
 *
 * Query params:
 *   - cursor: ISO timestamp to fetch entries before (for pagination)
 *   - limit: number of entries to return (default 30, max 100)
 *   - type: filter by entry type ('activity' | 'comment' | 'all', default 'all')
 */
export async function GET(
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

    // Parse query params
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limitParam = url.searchParams.get('limit')
    const typeFilter = url.searchParams.get('type') ?? 'all'

    const limit = Math.min(Math.max(Number(limitParam) || 30, 1), 100)

    // Build date filter for cursor-based pagination
    const cursorDate = cursor ? new Date(cursor) : undefined

    // Fetch activities and comments in parallel based on filter
    const includeActivities = typeFilter === 'all' || typeFilter === 'activity'
    const includeComments = typeFilter === 'all' || typeFilter === 'comment'

    const activityFetchLimit = limit + 20
    const [activities, comments] = await Promise.all([
      includeActivities
        ? db.ticketActivity.findMany({
            where: {
              ticketId,
              ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
            },
            select: {
              id: true,
              action: true,
              field: true,
              oldValue: true,
              newValue: true,
              groupId: true,
              createdAt: true,
              user: { select: USER_SELECT_SUMMARY },
            },
            orderBy: { createdAt: 'desc' },
            // Fetch extra to allow grouping without losing entries
            take: activityFetchLimit,
          })
        : [],
      includeComments
        ? db.comment.findMany({
            where: {
              ticketId,
              ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
            },
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              isSystemGenerated: true,
              source: true,
              author: { select: USER_SELECT_SUMMARY },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],
    ])

    // Track whether the raw activity fetch hit its limit (grouping may collapse entries)
    const activitiesHitLimit = activities.length >= activityFetchLimit

    // Group activities by groupId for batched changes
    const groupedActivities = groupActivitiesByGroupId(activities)

    // Merge activities and comments into a unified timeline
    type TimelineEntry = Record<string, unknown>
    const timeline: TimelineEntry[] = []

    for (const activity of groupedActivities) {
      if ('changes' in activity) {
        // Grouped changes
        timeline.push({
          type: 'activity_group',
          id: activity.groupId,
          user: activity.user,
          changes: activity.changes,
          createdAt: activity.createdAt,
        })
      } else {
        // Single activity
        timeline.push({
          type: 'activity',
          id: activity.id,
          user: activity.user,
          action: activity.action,
          field: activity.field,
          oldValue: activity.oldValue,
          newValue: activity.newValue,
          createdAt: activity.createdAt,
        })
      }
    }

    for (const comment of comments) {
      timeline.push({
        type: 'comment',
        id: comment.id,
        user: comment.author,
        content: comment.content,
        isSystemGenerated: comment.isSystemGenerated,
        source: comment.source,
        isEdited: comment.updatedAt > comment.createdAt,
        createdAt: comment.createdAt,
      })
    }

    // Sort by createdAt descending (newest first)
    timeline.sort(
      (a, b) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime(),
    )

    // Apply limit
    const trimmedTimeline = timeline.slice(0, limit)

    // Determine if there are more entries.
    // Also check activitiesHitLimit: grouping may collapse entries below the limit
    // even though more raw activities exist in the database.
    const hasMore = timeline.length > limit || activitiesHitLimit

    // Next cursor is the createdAt of the last entry
    const nextCursor =
      trimmedTimeline.length > 0
        ? new Date(trimmedTimeline[trimmedTimeline.length - 1].createdAt as string).toISOString()
        : null

    return NextResponse.json({
      entries: trimmedTimeline,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    })
  } catch (error) {
    return handleApiError(error, 'fetch ticket activity')
  }
}

// Types for internal grouping
interface ActivityChange {
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
}

type UserInfo = {
  id: string
  username: string
  name: string
  email: string | null
  avatar: string | null
  avatarColor: string | null
} | null

interface GroupedActivity {
  groupId: string
  user: UserInfo
  changes: ActivityChange[]
  createdAt: Date
}

interface SingleActivity {
  id: string
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  user: UserInfo
  createdAt: Date
}

/**
 * Group activities that share the same groupId into batched entries.
 * Activities without a groupId are returned as individual entries.
 */
function groupActivitiesByGroupId(
  activities: {
    id: string
    action: string
    field: string | null
    oldValue: string | null
    newValue: string | null
    groupId: string | null
    createdAt: Date
    user: UserInfo
  }[],
): (SingleActivity | GroupedActivity)[] {
  const grouped = new Map<string, typeof activities>()
  const ungrouped: SingleActivity[] = []

  for (const activity of activities) {
    if (activity.groupId) {
      const group = grouped.get(activity.groupId)
      if (group) {
        group.push(activity)
      } else {
        grouped.set(activity.groupId, [activity])
      }
    } else {
      ungrouped.push(activity)
    }
  }

  const result: (SingleActivity | GroupedActivity)[] = [...ungrouped]

  for (const [groupId, groupActivities] of grouped) {
    result.push({
      groupId,
      user: groupActivities[0].user,
      changes: groupActivities.map((a) => ({
        action: a.action,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
      })),
      createdAt: groupActivities[0].createdAt,
    })
  }

  return result
}
