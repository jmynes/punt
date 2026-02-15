'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ticketKeys } from '@/hooks/queries/use-tickets'
import { getTabId } from '@/hooks/use-realtime'
import { showToast } from '@/lib/toast'
import type { UserSummary } from '@/types'

export interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  isSystemGenerated: boolean
  source: string | null
  ticketId: string
  authorId: string
  author: UserSummary
}

export const commentKeys = {
  all: ['comments'] as const,
  forTicket: (projectId: string, ticketId: string) => ['comments', projectId, ticketId] as const,
}

/**
 * Fetch comments for a ticket
 */
export function useTicketComments(projectId: string, ticketId: string) {
  return useQuery<Comment[]>({
    queryKey: commentKeys.forTicket(projectId, ticketId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/comments`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch comments')
      }
      return res.json()
    },
    enabled: !!projectId && !!ticketId,
  })
}

/**
 * Add a comment to a ticket
 */
export function useAddComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      content,
    }: {
      projectId: string
      ticketId: string
      content: string
    }) => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add comment')
      }
      return res.json() as Promise<Comment>
    },
    onSuccess: (_, { projectId, ticketId }) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.forTicket(projectId, ticketId),
      })
      // Also invalidate tickets query to update comment count
      queryClient.invalidateQueries({
        queryKey: ticketKeys.byProject(projectId),
      })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}
