'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { showToast } from '@/lib/toast'
import type { LinkType, TicketLinkSummary } from '@/types'
import { ticketKeys } from './use-tickets'

export const ticketLinkKeys = {
  all: ['ticketLinks'] as const,
  byTicket: (projectId: string, ticketId: string) =>
    ['ticketLinks', 'project', projectId, 'ticket', ticketId] as const,
}

/**
 * Fetch all links for a ticket
 */
export function useTicketLinks(
  projectId: string,
  ticketId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<TicketLinkSummary[]>({
    queryKey: ticketLinkKeys.byTicket(projectId, ticketId),
    queryFn: async () => {
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/links`, { headers })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    staleTime: 1000 * 60, // 1 minute
    enabled: options?.enabled ?? true,
  })
}

interface CreateLinkInput {
  projectId: string
  ticketId: string
  linkType: LinkType
  targetTicketId: string
}

/**
 * Create a new ticket link
 */
export function useCreateTicketLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, ticketId, linkType, targetTicketId }: CreateLinkInput) => {
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/links`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ linkType, targetTicketId }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || `HTTP ${res.status}`)
      }

      return res.json() as Promise<TicketLinkSummary>
    },
    onSuccess: (_data, { projectId, ticketId, targetTicketId }) => {
      // Invalidate queries for both tickets
      queryClient.invalidateQueries({ queryKey: ticketLinkKeys.byTicket(projectId, ticketId) })
      queryClient.invalidateQueries({
        queryKey: ticketLinkKeys.byTicket(projectId, targetTicketId),
      })
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
      showToast.success('Link created')
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

interface DeleteLinkInput {
  projectId: string
  ticketId: string
  linkId: string
  targetTicketId: string
}

/**
 * Delete a ticket link
 */
export function useDeleteTicketLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, ticketId, linkId }: DeleteLinkInput) => {
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/links/${linkId}`, {
        method: 'DELETE',
        headers,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || `HTTP ${res.status}`)
      }

      return res.json()
    },
    onSuccess: (_data, { projectId, ticketId, targetTicketId }) => {
      // Invalidate queries for both tickets
      queryClient.invalidateQueries({ queryKey: ticketLinkKeys.byTicket(projectId, ticketId) })
      queryClient.invalidateQueries({
        queryKey: ticketLinkKeys.byTicket(projectId, targetTicketId),
      })
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
      showToast.success('Link removed')
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}
