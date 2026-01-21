'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import type { AttachmentInfo } from '@/types'

export const attachmentKeys = {
  all: ['attachments'] as const,
  forTicket: (projectId: string, ticketId: string) => ['attachments', projectId, ticketId] as const,
}

export interface UploadConfig {
  allowedTypes: string[]
  maxSizes: {
    image: number
    video: number
    document: number
  }
  maxAttachmentsPerTicket: number
}

/**
 * Fetch upload configuration
 */
export function useUploadConfig() {
  return useQuery<UploadConfig>({
    queryKey: ['upload-config'],
    queryFn: async () => {
      const res = await fetch('/api/upload')
      if (!res.ok) {
        throw new Error('Failed to fetch upload config')
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch attachments for a ticket
 */
export function useTicketAttachments(projectId: string, ticketId: string) {
  return useQuery<AttachmentInfo[]>({
    queryKey: attachmentKeys.forTicket(projectId, ticketId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/attachments`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch attachments')
      }
      return res.json()
    },
    enabled: !!projectId && !!ticketId,
  })
}

export interface AddAttachmentParams {
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
}

/**
 * Add attachments to a ticket
 */
export function useAddAttachments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      attachments,
    }: {
      projectId: string
      ticketId: string
      attachments: AddAttachmentParams[]
    }) => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ attachments }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add attachments')
      }
      return res.json() as Promise<AttachmentInfo[]>
    },
    onSuccess: (_, { projectId, ticketId }) => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.forTicket(projectId, ticketId),
      })
      // Also invalidate ticket query to update attachment count
      queryClient.invalidateQueries({
        queryKey: ['tickets', projectId, ticketId],
      })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Remove an attachment from a ticket
 */
export function useRemoveAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      attachmentId,
    }: {
      projectId: string
      ticketId: string
      attachmentId: string
    }) => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
          headers: { 'X-Tab-Id': getTabId() },
        },
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove attachment')
      }
      return res.json()
    },
    onMutate: async ({ projectId, ticketId, attachmentId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: attachmentKeys.forTicket(projectId, ticketId),
      })

      // Snapshot previous value
      const previousAttachments = queryClient.getQueryData<AttachmentInfo[]>(
        attachmentKeys.forTicket(projectId, ticketId),
      )

      // Optimistically remove the attachment
      if (previousAttachments) {
        queryClient.setQueryData<AttachmentInfo[]>(
          attachmentKeys.forTicket(projectId, ticketId),
          previousAttachments.filter((a) => a.id !== attachmentId),
        )
      }

      return { previousAttachments }
    },
    onError: (err, { projectId, ticketId }, context) => {
      // Rollback on error
      if (context?.previousAttachments) {
        queryClient.setQueryData(
          attachmentKeys.forTicket(projectId, ticketId),
          context.previousAttachments,
        )
      }
      toast.error(err.message)
    },
    onSettled: (_, __, { projectId, ticketId }) => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.forTicket(projectId, ticketId),
      })
      // Also invalidate ticket query to update attachment count
      queryClient.invalidateQueries({
        queryKey: ['tickets', projectId, ticketId],
      })
    },
  })
}
