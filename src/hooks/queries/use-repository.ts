'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { showToast } from '@/lib/toast'
import type { RepoProvider } from '@/types'

export interface EnvironmentBranch {
  id: string
  environment: string
  branchName: string
  color?: string
}

export type CommitPatternAction = 'close' | 'in_progress' | 'reference'

export interface CommitPattern {
  id: string
  pattern: string // The pattern text (e.g., "fixes", "closes", "wip")
  action: CommitPatternAction
  isRegex?: boolean // Whether pattern is a regex
  enabled?: boolean
}

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
  environmentBranches: EnvironmentBranch[] | null
  commitPatterns: CommitPattern[] | null
  // Webhook integration
  hasWebhookSecret: boolean
  webhookSecret?: string // Only present when newly generated
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
  environmentBranches?: EnvironmentBranch[] | null
  commitPatterns?: CommitPattern[] | null
  // Webhook secret actions
  generateWebhookSecret?: boolean
  clearWebhookSecret?: boolean
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

/**
 * Update commit patterns for a project
 */
export function useCommitPatterns(projectKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patterns: CommitPattern[] | null) => {
      const res = await fetch(`/api/projects/${projectKey}/repository`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ commitPatterns: patterns }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to update commit patterns' }))
        throw new Error(error.error || 'Failed to update commit patterns')
      }
      return res.json() as Promise<RepositoryConfig>
    },
    onMutate: async (patterns) => {
      await queryClient.cancelQueries({ queryKey: repositoryKeys.detail(projectKey) })
      const previousConfig = queryClient.getQueryData<RepositoryConfig>(
        repositoryKeys.detail(projectKey),
      )
      if (previousConfig) {
        queryClient.setQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey), {
          ...previousConfig,
          commitPatterns: patterns,
        })
      }
      return { previousConfig }
    },
    onError: (err, _, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(repositoryKeys.detail(projectKey), context.previousConfig)
      }
      showToast.error(err.message)
    },
    onSuccess: () => {
      showToast.success('Commit patterns updated')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: repositoryKeys.detail(projectKey) })
    },
  })
}

/**
 * Generate or clear webhook secret for a project
 * Returns the new secret when generating (for copying)
 */
export function useWebhookSecret(projectKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: 'generate' | 'clear') => {
      const res = await fetch(`/api/projects/${projectKey}/repository`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({
          generateWebhookSecret: action === 'generate',
          clearWebhookSecret: action === 'clear',
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to update webhook secret' }))
        throw new Error(error.error || 'Failed to update webhook secret')
      }
      return res.json() as Promise<RepositoryConfig>
    },
    onError: (err) => {
      showToast.error(err.message)
    },
    onSuccess: (data, action) => {
      if (action === 'generate') {
        showToast.success('Webhook secret generated')
      } else {
        showToast.success('Webhook secret removed')
      }
      // Update the query cache
      queryClient.setQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey), data)
    },
  })
}
