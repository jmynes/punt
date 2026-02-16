'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { showToast } from '@/lib/toast'
import type { RepoProvider } from '@/types'

export const repositoryKeys = {
  all: ['repository'] as const,
  detail: (projectKey: string) => ['repository', projectKey] as const,
}

export interface RepositoryConfig {
  projectId: string
  projectKey: string
  projectName: string
  // Project-level settings
  repositoryUrl: string | null
  repositoryProvider: RepoProvider | null
  localPath: string | null
  defaultBranch: string | null
  branchTemplate: string | null
  agentGuidance: string | null
  monorepoPath: string | null
  // Effective values (with system defaults)
  effectiveBranchTemplate: string
  effectiveAgentGuidance: string | null
  // System defaults for reference
  systemDefaults: {
    branchTemplate: string
    agentGuidance: string | null
  }
}

/**
 * Fetch repository configuration for a project
 */
export function useRepositoryConfig(projectKey: string) {
  return useQuery<RepositoryConfig>({
    queryKey: repositoryKeys.detail(projectKey),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectKey}/repository`, {
        headers: { 'X-Tab-Id': getTabId() },
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch repository config' }))
        throw new Error(error.error || 'Failed to fetch repository config')
      }
      return res.json()
    },
    staleTime: 1000 * 60, // 1 minute
  })
}

export interface UpdateRepositoryInput {
  repositoryUrl?: string | null
  repositoryProvider?: RepoProvider | null
  localPath?: string | null
  defaultBranch?: string | null
  branchTemplate?: string | null
  agentGuidance?: string | null
  monorepoPath?: string | null
}

/**
 * Update repository configuration for a project
 */
export function useUpdateRepository(projectKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateRepositoryInput) => {
      const res = await fetch(`/api/projects/${projectKey}/repository`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: 'Failed to update repository config' }))
        throw new Error(error.error || 'Failed to update repository config')
      }
      return res.json() as Promise<RepositoryConfig>
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: repositoryKeys.detail(projectKey) })

      // Snapshot previous value
      const previousConfig = queryClient.getQueryData<RepositoryConfig>(
        repositoryKeys.detail(projectKey),
      )

      // Optimistic update
      if (previousConfig) {
        queryClient.setQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey), {
          ...previousConfig,
          ...data,
          // Recalculate effective values
          effectiveBranchTemplate: data.branchTemplate ?? previousConfig.effectiveBranchTemplate,
          effectiveAgentGuidance:
            data.agentGuidance !== undefined
              ? data.agentGuidance
              : previousConfig.effectiveAgentGuidance,
        })
      }

      return { previousConfig }
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousConfig) {
        queryClient.setQueryData(repositoryKeys.detail(projectKey), context.previousConfig)
      }
      showToast.error(err.message)
    },
    onSuccess: () => {
      showToast.success('Repository settings updated')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: repositoryKeys.detail(projectKey) })
    },
  })
}
