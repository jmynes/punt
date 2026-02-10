'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import { getDataProvider } from '@/lib/data-provider'
import type { LabelSummary } from '@/types'

// Label with ticket count for management views
export interface LabelWithCount extends LabelSummary {
  _count?: {
    tickets: number
  }
}

// Query keys for labels
export const labelKeys = {
  all: ['labels'] as const,
  byProject: (projectId: string) => ['labels', 'project', projectId] as const,
  byProjectWithCounts: (projectId: string) =>
    ['labels', 'project', projectId, 'with-counts'] as const,
}

/**
 * Fetch all labels for a project
 */
export function useProjectLabels(projectId: string) {
  return useQuery<LabelSummary[]>({
    queryKey: labelKeys.byProject(projectId),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.getLabels(projectId)
    },
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Fetch all labels for a project with ticket counts.
 * Used in the labels management page.
 */
export function useProjectLabelsWithCounts(projectId: string) {
  return useQuery<LabelWithCount[]>({
    queryKey: labelKeys.byProjectWithCounts(projectId),
    queryFn: async () => {
      const tabId = getTabId()
      const res = await fetch(`/api/projects/${projectId}/labels?include_count=true`, {
        headers: {
          'X-Tab-Id': tabId,
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch labels')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Create a new label
 */
export function useCreateLabel(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const provider = getDataProvider(getTabId())
      return provider.createLabel(projectId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: labelKeys.byProjectWithCounts(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Update a label
 */
export function useUpdateLabel(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      labelId,
      ...data
    }: {
      labelId: string
      name?: string
      color?: string
    }) => {
      const provider = getDataProvider(getTabId())
      return provider.updateLabel(projectId, labelId, data)
    },
    onSuccess: () => {
      toast.success('Label updated')
      queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: labelKeys.byProjectWithCounts(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * Delete a label
 */
export function useDeleteLabel(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (labelId: string) => {
      const provider = getDataProvider(getTabId())
      await provider.deleteLabel(projectId, labelId)
      return { success: true }
    },
    onSuccess: () => {
      toast.success('Label deleted')
      queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: labelKeys.byProjectWithCounts(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}
