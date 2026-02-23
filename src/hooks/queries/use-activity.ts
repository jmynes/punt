'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import type { UserSummary } from '@/types'

/** Activity value can be a string, user object (for assignee), or null */
export type ActivityValue = string | UserSummary | null

/** A single field change within an activity or group. */
export interface ActivityChange {
  action: string
  field: string | null
  oldValue: ActivityValue
  newValue: ActivityValue
}

/** A single activity entry in the timeline. */
export interface ActivityEntry {
  type: 'activity'
  id: string
  user: UserSummary | null
  action: string
  field: string | null
  oldValue: ActivityValue
  newValue: ActivityValue
  createdAt: string
}

/** A grouped activity entry (multiple changes from one action). */
export interface ActivityGroupEntry {
  type: 'activity_group'
  id: string
  user: UserSummary | null
  changes: ActivityChange[]
  createdAt: string
}

/** A comment entry in the timeline. */
export interface CommentEntry {
  type: 'comment'
  id: string
  user: UserSummary | null
  content: string
  isSystemGenerated: boolean
  source: string | null
  isEdited: boolean
  createdAt: string
}

/** A union type for all timeline entries. */
export type TimelineEntry = ActivityEntry | ActivityGroupEntry | CommentEntry

/** The paginated response from the activity API. */
export interface ActivityResponse {
  entries: TimelineEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export const activityKeys = {
  all: ['activity'] as const,
  forTicket: (projectId: string, ticketId: string) => ['activity', projectId, ticketId] as const,
}

/**
 * Fetch paginated activity timeline for a ticket.
 * Uses infinite query for cursor-based pagination.
 */
export function useTicketActivity(projectId: string, ticketId: string) {
  return useInfiniteQuery<ActivityResponse>({
    queryKey: activityKeys.forTicket(projectId, ticketId),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' })
      if (pageParam) {
        params.set('cursor', pageParam as string)
      }
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/activity?${params.toString()}`,
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch activity')
      }
      return res.json()
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!projectId && !!ticketId,
  })
}
