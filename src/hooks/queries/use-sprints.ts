'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ticketKeys } from '@/hooks/queries/use-tickets'
import { getTabId } from '@/hooks/use-realtime'
import { demoStorage, isDemoMode } from '@/lib/demo'
import type {
  ProjectSprintSettingsData,
  SprintCompletionOptions,
  SprintCompletionResult,
  SprintWithMetrics,
} from '@/types'

// Query keys for sprints
export const sprintKeys = {
  all: ['sprints'] as const,
  byProject: (projectId: string) => ['sprints', 'project', projectId] as const,
  detail: (projectId: string, sprintId: string) => ['sprints', projectId, sprintId] as const,
  active: (projectId: string) => ['sprints', 'active', projectId] as const,
  settings: (projectId: string) => ['sprints', 'settings', projectId] as const,
}

/**
 * Fetch all sprints for a project
 */
export function useProjectSprints(projectId: string) {
  return useQuery<SprintWithMetrics[]>({
    queryKey: sprintKeys.byProject(projectId),
    queryFn: async () => {
      // Demo mode: return from localStorage
      if (isDemoMode()) {
        const sprints = demoStorage.getSprints(projectId)
        // Add empty metrics for demo sprints
        return sprints.map((s) => ({
          ...s,
          _count: { tickets: 0 },
          completedTicketCount: 0,
          incompleteTicketCount: 0,
          completedStoryPoints: 0,
          incompleteStoryPoints: 0,
        }))
      }

      const res = await fetch(`/api/projects/${projectId}/sprints`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch sprints')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Fetch the active sprint for a project
 */
export function useActiveSprint(projectId: string) {
  return useQuery<SprintWithMetrics | null>({
    queryKey: sprintKeys.active(projectId),
    queryFn: async () => {
      // Demo mode: return from localStorage
      if (isDemoMode()) {
        const sprint = demoStorage.getActiveSprint(projectId)
        if (!sprint) return null
        return {
          ...sprint,
          _count: { tickets: 0 },
          completedTicketCount: 0,
          incompleteTicketCount: 0,
          completedStoryPoints: 0,
          incompleteStoryPoints: 0,
        }
      }

      const res = await fetch(`/api/projects/${projectId}/sprints/active`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch active sprint')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds
  })
}

/**
 * Fetch a specific sprint's details
 */
export function useSprintDetail(projectId: string, sprintId: string) {
  return useQuery<SprintWithMetrics>({
    queryKey: sprintKeys.detail(projectId, sprintId),
    queryFn: async () => {
      // Demo mode: return from localStorage
      if (isDemoMode()) {
        const sprints = demoStorage.getSprints(projectId)
        const sprint = sprints.find((s) => s.id === sprintId)
        if (!sprint) throw new Error('Sprint not found')
        return {
          ...sprint,
          _count: { tickets: 0 },
          completedTicketCount: 0,
          incompleteTicketCount: 0,
          completedStoryPoints: 0,
          incompleteStoryPoints: 0,
        }
      }

      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch sprint')
      }
      return res.json()
    },
    enabled: !!projectId && !!sprintId,
    staleTime: 1000 * 60,
  })
}

/**
 * Fetch sprint settings for a project
 */
export function useSprintSettings(projectId: string) {
  return useQuery<ProjectSprintSettingsData>({
    queryKey: sprintKeys.settings(projectId),
    queryFn: async () => {
      // Demo mode: return default settings
      if (isDemoMode()) {
        return {
          defaultSprintDuration: 14,
          autoCarryOverIncomplete: true,
          doneColumnIds: [],
        }
      }

      const res = await fetch(`/api/projects/${projectId}/sprints/settings`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch sprint settings')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Create a new sprint
 */
export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      goal?: string | null
      startDate?: Date | null
      endDate?: Date | null
      budget?: number | null
    }) => {
      // Demo mode: create in localStorage
      if (isDemoMode()) {
        const sprint = demoStorage.createSprint(projectId, {
          name: data.name,
          goal: data.goal ?? undefined,
          startDate: data.startDate ?? undefined,
          endDate: data.endDate ?? undefined,
        })
        return {
          ...sprint,
          _count: { tickets: 0 },
          completedTicketCount: 0,
          incompleteTicketCount: 0,
          completedStoryPoints: 0,
          incompleteStoryPoints: 0,
        } as SprintWithMetrics
      }

      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create sprint')
      }
      return res.json() as Promise<SprintWithMetrics>
    },
    onSuccess: () => {
      toast.success('Sprint created')
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Update a sprint
 */
export function useUpdateSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sprintId,
      ...data
    }: {
      sprintId: string
      name?: string
      goal?: string | null
      startDate?: Date | null
      endDate?: Date | null
      budget?: number | null
    }) => {
      // Demo mode: update in localStorage
      if (isDemoMode()) {
        const sprint = demoStorage.updateSprint(projectId, sprintId, data)
        if (!sprint) throw new Error('Sprint not found')
        return {
          ...sprint,
          _count: { tickets: 0 },
          completedTicketCount: 0,
          incompleteTicketCount: 0,
          completedStoryPoints: 0,
          incompleteStoryPoints: 0,
        } as SprintWithMetrics
      }

      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update sprint')
      }
      return res.json() as Promise<SprintWithMetrics>
    },
    onSuccess: (_, { sprintId }) => {
      toast.success('Sprint updated')
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(projectId, sprintId) })
      queryClient.invalidateQueries({ queryKey: sprintKeys.active(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Delete a sprint
 */
export function useDeleteSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sprintId: string) => {
      // Demo mode: delete from localStorage
      if (isDemoMode()) {
        demoStorage.deleteSprint(projectId, sprintId)
        return { success: true }
      }

      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}`, {
        method: 'DELETE',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete sprint')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sprint deleted')
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Start a sprint
 */
export function useStartSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sprintId,
      startDate,
      endDate,
    }: {
      sprintId: string
      startDate?: Date
      endDate?: Date
    }) => {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ startDate, endDate }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to start sprint')
      }
      return res.json() as Promise<SprintWithMetrics>
    },
    onSuccess: () => {
      toast.success('Sprint started')
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: sprintKeys.active(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Complete a sprint
 */
export function useCompleteSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sprintId,
      options,
    }: {
      sprintId: string
      options: Omit<SprintCompletionOptions, 'extendDays'>
    }) => {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(options),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to complete sprint')
      }
      return res.json() as Promise<SprintCompletionResult>
    },
    onSuccess: (result) => {
      const { ticketDisposition } = result
      const carried = ticketDisposition.carriedOver.length
      const backlog = ticketDisposition.movedToBacklog.length
      const completed = ticketDisposition.completed.length

      let message = 'Sprint completed!'
      if (carried > 0) {
        message += ` ${carried} ticket${carried > 1 ? 's' : ''} carried over.`
      }
      if (backlog > 0) {
        message += ` ${backlog} ticket${backlog > 1 ? 's' : ''} moved to backlog.`
      }
      if (completed > 0) {
        message += ` ${completed} completed.`
      }

      toast.success(message)
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: sprintKeys.active(projectId) })
      // Also invalidate tickets as they may have been moved
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Extend a sprint
 */
export function useExtendSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sprintId,
      days,
      newEndDate,
    }: {
      sprintId: string
      days: number
      newEndDate?: Date
    }) => {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ days, newEndDate }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to extend sprint')
      }
      return res.json() as Promise<SprintWithMetrics>
    },
    onSuccess: (result) => {
      const endDateStr = result.endDate ? new Date(result.endDate).toLocaleDateString() : 'unknown'
      toast.success(`Sprint extended until ${endDateStr}`)
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: sprintKeys.active(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Update a ticket's sprint assignment (for drag-and-drop)
 */
export function useUpdateTicketSprint(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, sprintId }: { ticketId: string; sprintId: string | null }) => {
      // Demo mode: update in localStorage
      if (isDemoMode()) {
        const sprints = demoStorage.getSprints(projectId)
        const sprint = sprintId ? sprints.find((s) => s.id === sprintId) : null
        const updated = demoStorage.updateTicket(projectId, ticketId, {
          sprintId,
          sprint: sprint ?? null,
        })
        if (!updated) throw new Error('Ticket not found')
        return updated
      }

      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ sprintId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update ticket')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidate both sprints and tickets queries
      queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
    // Don't show toast here - we handle it in the component for better UX
  })
}

/**
 * Update sprint settings
 */
export function useUpdateSprintSettings(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<ProjectSprintSettingsData>) => {
      const res = await fetch(`/api/projects/${projectId}/sprints/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update sprint settings')
      }
      return res.json() as Promise<ProjectSprintSettingsData>
    },
    onSuccess: () => {
      toast.success('Sprint settings updated')
      queryClient.invalidateQueries({ queryKey: sprintKeys.settings(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}
