'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import { demoStorage, isDemoMode } from '@/lib/demo'
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
      // Demo mode: return from localStorage
      if (isDemoMode()) {
        return demoStorage.getLabels(projectId)
      }

      const res = await fetch(`/api/projects/${projectId}/labels`)
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
      // Demo mode: create in localStorage
      if (isDemoMode()) {
        return demoStorage.createLabel(projectId, data)
      }

      const res = await fetch(`/api/projects/${projectId}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create label')
      }
      return res.json() as Promise<LabelSummary>
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
      // Demo mode: update in localStorage
      if (isDemoMode()) {
        const updated = demoStorage.updateLabel(projectId, labelId, data)
        if (!updated) throw new Error('Label not found')
        return updated
      }

      const res = await fetch(`/api/projects/${projectId}/labels/${labelId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update label')
      }
      return res.json() as Promise<LabelSummary>
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
      // Demo mode: delete from localStorage
      if (isDemoMode()) {
        demoStorage.deleteLabel(projectId, labelId)
        return { success: true }
      }

      const res = await fetch(`/api/projects/${projectId}/labels/${labelId}`, {
        method: 'DELETE',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete label')
      }
      return res.json()
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
