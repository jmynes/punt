'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import { getDataProvider } from '@/lib/data-provider'
import type { LabelSummary } from '@/types'

// Query keys for labels
export const labelKeys = {
  all: ['labels'] as const,
  byProject: (projectId: string) => ['labels', 'project', projectId] as const,
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
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}
