'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
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
      if (isDemoMode()) {
        const links = demoStorage.getTicketLinks(projectId, ticketId)
        return links
          .map((link) => {
            const isOutward = link.sourceTicketId === ticketId
            const linkedTicketId = isOutward ? link.targetTicketId : link.sourceTicketId
            const linkedTicket = demoStorage.getTicket(projectId, linkedTicketId)
            if (!linkedTicket) return null
            return {
              id: link.id,
              linkType: link.linkType as LinkType,
              linkedTicket: {
                id: linkedTicket.id,
                number: linkedTicket.number,
                title: linkedTicket.title,
                type: linkedTicket.type,
                priority: linkedTicket.priority,
                columnId: linkedTicket.columnId,
                resolution: linkedTicket.resolution,
                storyPoints: linkedTicket.storyPoints,
                assignee: linkedTicket.assignee,
              },
              direction: isOutward ? ('outward' as const) : ('inward' as const),
            } satisfies TicketLinkSummary
          })
          .filter((l): l is TicketLinkSummary => l !== null)
      }
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await apiFetch(`/api/projects/${projectId}/tickets/${ticketId}/links`, {
        headers,
      })
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
      if (isDemoMode()) {
        const link = demoStorage.createTicketLink(projectId, {
          sourceTicketId: ticketId,
          targetTicketId,
          linkType,
        })
        const linkedTicket = demoStorage.getTicket(projectId, targetTicketId)
        return {
          id: link.id,
          linkType,
          linkedTicket: linkedTicket
            ? {
                id: linkedTicket.id,
                number: linkedTicket.number,
                title: linkedTicket.title,
                type: linkedTicket.type,
                priority: linkedTicket.priority,
                columnId: linkedTicket.columnId,
                resolution: linkedTicket.resolution,
                storyPoints: linkedTicket.storyPoints,
                assignee: linkedTicket.assignee,
              }
            : {
                id: targetTicketId,
                number: 0,
                title: '',
                type: 'task' as const,
                priority: 'medium' as const,
                columnId: '',
                resolution: null,
                storyPoints: null,
                assignee: null,
              },
          direction: 'outward' as const,
        } as TicketLinkSummary
      }
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await apiFetch(`/api/projects/${projectId}/tickets/${ticketId}/links`, {
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
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

interface UpdateLinkInput {
  projectId: string
  ticketId: string
  linkId: string
  linkType: LinkType
  targetTicketId: string
}

/**
 * Update the link type of an existing ticket link
 */
export function useUpdateTicketLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, ticketId, linkId, linkType }: UpdateLinkInput) => {
      if (isDemoMode()) {
        // Demo storage doesn't support link updates; delete and recreate
        const allLinks = demoStorage.getTicketLinks(projectId, ticketId)
        const existing = allLinks.find((l) => l.id === linkId)
        if (existing) {
          demoStorage.deleteTicketLink(projectId, linkId)
          demoStorage.createTicketLink(projectId, {
            sourceTicketId: existing.sourceTicketId,
            targetTicketId: existing.targetTicketId,
            linkType,
          })
        }
        return {}
      }
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await apiFetch(`/api/projects/${projectId}/tickets/${ticketId}/links/${linkId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ linkType }),
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
      showToast.success('Link type updated')
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

interface CreateBulkLinksInput {
  projectId: string
  ticketId: string
  links: { linkType: LinkType; targetTicketId: string }[]
}

interface BulkLinkResult {
  succeeded: TicketLinkSummary[]
  failed: { targetTicketId: string; error: string }[]
}

/**
 * Create multiple ticket links in parallel.
 * Uses Promise.allSettled so partial failures don't block successful ones.
 */
export function useCreateTicketLinks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      ticketId,
      links,
    }: CreateBulkLinksInput): Promise<BulkLinkResult> => {
      if (isDemoMode()) {
        const succeeded: TicketLinkSummary[] = []
        for (const { linkType: lt, targetTicketId: ttId } of links) {
          const link = demoStorage.createTicketLink(projectId, {
            sourceTicketId: ticketId,
            targetTicketId: ttId,
            linkType: lt,
          })
          const linkedTicket = demoStorage.getTicket(projectId, ttId)
          succeeded.push({
            id: link.id,
            linkType: lt,
            linkedTicket: linkedTicket
              ? {
                  id: linkedTicket.id,
                  number: linkedTicket.number,
                  title: linkedTicket.title,
                  type: linkedTicket.type,
                  priority: linkedTicket.priority,
                  columnId: linkedTicket.columnId,
                  resolution: linkedTicket.resolution,
                  storyPoints: linkedTicket.storyPoints,
                  assignee: linkedTicket.assignee,
                }
              : {
                  id: ttId,
                  number: 0,
                  title: '',
                  type: 'task' as const,
                  priority: 'medium' as const,
                  columnId: '',
                  resolution: null,
                  storyPoints: null,
                  assignee: null,
                },
            direction: 'outward' as const,
          })
        }
        return { succeeded, failed: [] }
      }
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const results = await Promise.allSettled(
        links.map(async ({ linkType, targetTicketId }) => {
          const res = await apiFetch(`/api/projects/${projectId}/tickets/${ticketId}/links`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ linkType, targetTicketId }),
          })

          if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Request failed' }))
            throw { targetTicketId, error: error.error || `HTTP ${res.status}` }
          }

          return (await res.json()) as TicketLinkSummary
        }),
      )

      const succeeded: TicketLinkSummary[] = []
      const failed: { targetTicketId: string; error: string }[] = []

      for (const result of results) {
        if (result.status === 'fulfilled') {
          succeeded.push(result.value)
        } else {
          const reason = result.reason as { targetTicketId: string; error: string }
          failed.push(reason)
        }
      }

      return { succeeded, failed }
    },
    onSuccess: ({ succeeded, failed }, { projectId, ticketId, links }) => {
      // Invalidate source ticket links
      queryClient.invalidateQueries({ queryKey: ticketLinkKeys.byTicket(projectId, ticketId) })
      // Invalidate all target ticket links
      for (const link of links) {
        queryClient.invalidateQueries({
          queryKey: ticketLinkKeys.byTicket(projectId, link.targetTicketId),
        })
      }
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })

      if (succeeded.length > 0 && failed.length === 0) {
        showToast.success(
          succeeded.length === 1 ? 'Link created' : `${succeeded.length} links created`,
        )
      } else if (succeeded.length > 0 && failed.length > 0) {
        showToast.warning(`${succeeded.length} link(s) created, ${failed.length} failed`)
      } else if (failed.length > 0) {
        showToast.error(`Failed to create ${failed.length} link(s)`)
      }
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
      if (isDemoMode()) {
        demoStorage.deleteTicketLink(projectId, linkId)
        return {}
      }
      const tabId = getTabId()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(tabId && { 'X-Tab-Id': tabId }),
      }

      const res = await apiFetch(`/api/projects/${projectId}/tickets/${ticketId}/links/${linkId}`, {
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
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}
