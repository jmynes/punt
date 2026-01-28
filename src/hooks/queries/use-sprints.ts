'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ticketKeys } from '@/hooks/queries/use-tickets'
import { getTabId } from '@/hooks/use-realtime'
import { getDataProvider } from '@/lib/data-provider'
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
      const provider = getDataProvider(getTabId())
      // Provider returns SprintSummary but API actually returns SprintWithMetrics
      return provider.getSprints(projectId) as Promise<SprintWithMetrics[]>
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
      const provider = getDataProvider(getTabId())
      // Provider returns SprintSummary but API actually returns SprintWithMetrics
      return provider.getActiveSprint(projectId) as Promise<SprintWithMetrics | null>
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
      const provider = getDataProvider(getTabId())
      const sprints = (await provider.getSprints(projectId)) as SprintWithMetrics[]
      const sprint = sprints.find((s) => s.id === sprintId)
      if (!sprint) throw new Error('Sprint not found')
      return sprint
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
      const provider = getDataProvider(getTabId())
      return provider.getSprintSettings(projectId)
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
      const provider = getDataProvider(getTabId())
      // Provider returns SprintSummary but API actually returns SprintWithMetrics
      return provider.createSprint(projectId, {
        name: data.name,
        goal: data.goal ?? undefined,
        startDate: data.startDate ?? undefined,
        endDate: data.endDate ?? undefined,
      }) as Promise<SprintWithMetrics>
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
      const provider = getDataProvider(getTabId())
      // Provider returns SprintSummary but API actually returns SprintWithMetrics
      return provider.updateSprint(projectId, sprintId, {
        name: data.name,
        goal: data.goal ?? undefined,
        startDate: data.startDate,
        endDate: data.endDate,
      }) as Promise<SprintWithMetrics>
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
      const provider = getDataProvider(getTabId())
      await provider.deleteSprint(projectId, sprintId)
      return { success: true }
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
      const provider = getDataProvider(getTabId())
      // Provider returns SprintSummary but API actually returns SprintWithMetrics
      return provider.startSprint(projectId, sprintId, {
        startDate,
        endDate,
      }) as Promise<SprintWithMetrics>
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
      const provider = getDataProvider(getTabId())

      // Map SprintCompletionOptions.action to CompleteSprintInput.incompleteAction
      const actionMap: Record<string, 'backlog' | 'carryover' | 'keep'> = {
        close_to_backlog: 'backlog',
        close_to_next: 'carryover',
        close_keep: 'keep',
      }
      const incompleteAction = actionMap[options.action] ?? 'backlog'

      // Provider returns SprintSummary but API actually returns SprintCompletionResult
      return provider.completeSprint(projectId, sprintId, {
        incompleteAction,
        carryOverToSprintId: options.targetSprintId ?? null,
      }) as unknown as Promise<SprintCompletionResult>
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
      const provider = getDataProvider(getTabId())

      // Calculate the new end date if not provided
      let calculatedEndDate = newEndDate
      if (!calculatedEndDate) {
        const sprints = (await provider.getSprints(projectId)) as SprintWithMetrics[]
        const currentSprint = sprints.find((s) => s.id === sprintId)
        if (!currentSprint) throw new Error('Sprint not found')
        const currentEnd = currentSprint.endDate ?? new Date()
        calculatedEndDate = new Date(new Date(currentEnd).getTime() + days * 24 * 60 * 60 * 1000)
      }

      // Provider returns SprintSummary but API actually returns SprintWithMetrics
      return provider.extendSprint(projectId, sprintId, {
        newEndDate: calculatedEndDate,
      }) as Promise<SprintWithMetrics>
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
      const provider = getDataProvider(getTabId())
      return provider.updateTicket(projectId, ticketId, { sprintId })
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
      const provider = getDataProvider(getTabId())
      return provider.updateSprintSettings(projectId, data)
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
