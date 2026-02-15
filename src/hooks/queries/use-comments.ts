'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ticketKeys } from '@/hooks/queries/use-tickets'
import { getTabId } from '@/hooks/use-realtime'
import type { UserSummary } from '@/lib/data-provider'
import { showToast } from '@/lib/toast'

export interface CommentInfo {
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
  return useQuery<CommentInfo[]>({
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
      return res.json() as Promise<CommentInfo>
    },
    onSuccess: (newComment, { projectId, ticketId }) => {
      // Optimistically add the comment to the cache
      queryClient.setQueryData<CommentInfo[]>(commentKeys.forTicket(projectId, ticketId), (old) =>
        old ? [...old, newComment] : [newComment],
      )
      // Invalidate tickets query to update comment count
      queryClient.invalidateQueries({
        queryKey: ticketKeys.byProject(projectId),
      })
      showToast.success('Comment added')
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

/**
 * Update a comment
 */
export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      commentId,
      content,
    }: {
      projectId: string
      ticketId: string
      commentId: string
      content: string
    }) => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Tab-Id': getTabId(),
          },
          body: JSON.stringify({ content }),
        },
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update comment')
      }
      return res.json() as Promise<CommentInfo>
    },
    onMutate: async ({ projectId, ticketId, commentId, content }) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.forTicket(projectId, ticketId),
      })

      const previousComments = queryClient.getQueryData<CommentInfo[]>(
        commentKeys.forTicket(projectId, ticketId),
      )

      // Optimistically update the comment
      if (previousComments) {
        queryClient.setQueryData<CommentInfo[]>(
          commentKeys.forTicket(projectId, ticketId),
          previousComments.map((c) =>
            c.id === commentId ? { ...c, content, updatedAt: new Date().toISOString() } : c,
          ),
        )
      }

      return { previousComments }
    },
    onSuccess: () => {
      showToast.success('Comment updated')
    },
    onError: (err, { projectId, ticketId }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          commentKeys.forTicket(projectId, ticketId),
          context.previousComments,
        )
      }
      showToast.error(err.message)
    },
    onSettled: (_, __, { projectId, ticketId }) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.forTicket(projectId, ticketId),
      })
    },
  })
}

/**
 * Delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      commentId,
    }: {
      projectId: string
      ticketId: string
      commentId: string
    }) => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comments/${commentId}`,
        {
          method: 'DELETE',
          headers: { 'X-Tab-Id': getTabId() },
        },
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete comment')
      }
      return res.json()
    },
    onMutate: async ({ projectId, ticketId, commentId }) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.forTicket(projectId, ticketId),
      })

      const previousComments = queryClient.getQueryData<CommentInfo[]>(
        commentKeys.forTicket(projectId, ticketId),
      )

      // Optimistically remove the comment
      if (previousComments) {
        queryClient.setQueryData<CommentInfo[]>(
          commentKeys.forTicket(projectId, ticketId),
          previousComments.filter((c) => c.id !== commentId),
        )
      }

      return { previousComments }
    },
    onSuccess: () => {
      showToast.success('Comment deleted')
    },
    onError: (err, { projectId, ticketId }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          commentKeys.forTicket(projectId, ticketId),
          context.previousComments,
        )
      }
      showToast.error(err.message)
    },
    onSettled: (_, __, { projectId, ticketId }) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.forTicket(projectId, ticketId),
      })
      // Invalidate tickets query to update comment count
      queryClient.invalidateQueries({
        queryKey: ticketKeys.byProject(projectId),
      })
    },
  })
}
