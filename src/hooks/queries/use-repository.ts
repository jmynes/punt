'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
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
  pattern: string // The primary keyword (e.g., "fixes", "closes", "wip")
  action: CommitPatternAction
  isRegex?: boolean // Whether pattern is a regex
  enabled?: boolean
  keywords?: string[] // Additional keywords that trigger the same action
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
    environmentBranches: EnvironmentBranch[] | null
    commitPatterns: CommitPattern[] | null
  }
}

/**
 * Build a demo RepositoryConfig for a given project key.
 * In demo mode there is no backend, so we return sensible defaults.
 */
function getDemoRepositoryConfig(projectKey: string): RepositoryConfig {
  const projects = demoStorage.getProjects()
  const project = projects.find((p) => p.key === projectKey)

  return {
    projectId: project?.id ?? '',
    projectKey,
    projectName: project?.name ?? projectKey,
    repositoryUrl: null,
    repositoryProvider: null,
    localPath: null,
    defaultBranch: null,
    branchTemplate: null,
    agentGuidance: null,
    monorepoPath: null,
    environmentBranches: null,
    commitPatterns: null,
    hasWebhookSecret: false,
    effectiveBranchTemplate: '{type}/{key}-{slug}',
    effectiveAgentGuidance: null,
    systemDefaults: {
      branchTemplate: '{type}/{key}-{slug}',
      agentGuidance: null,
      environmentBranches: null,
      commitPatterns: null,
    },
  }
}

/**
 * Fetch repository configuration for a project
 */
export function useRepositoryConfig(projectKey: string) {
  return useQuery<RepositoryConfig>({
    queryKey: repositoryKeys.detail(projectKey),
    queryFn: async () => {
      if (isDemoMode()) {
        return getDemoRepositoryConfig(projectKey)
      }

      const res = await apiFetch(`/api/projects/${projectKey}/repository`, {
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
      if (isDemoMode()) {
        // In demo mode, merge the update into the current cached config
        const current =
          queryClient.getQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey)) ??
          getDemoRepositoryConfig(projectKey)
        const updated: RepositoryConfig = {
          ...current,
          ...data,
          effectiveBranchTemplate: data.branchTemplate ?? current.effectiveBranchTemplate,
          effectiveAgentGuidance:
            data.agentGuidance !== undefined ? data.agentGuidance : current.effectiveAgentGuidance,
        }
        return updated
      }

      const res = await apiFetch(`/api/projects/${projectKey}/repository`, {
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
    onSuccess: (data) => {
      showToast.success('Repository settings updated')
      // In demo mode, set the returned data directly into the cache so the
      // optimistic update isn't reverted by a refetch returning original defaults.
      if (isDemoMode() && data) {
        queryClient.setQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey), data)
      }
    },
    onSettled: () => {
      // Skip invalidation in demo mode – there is no backend to refetch from,
      // and the refetch would overwrite the optimistic/saved data with the
      // original defaults from getDemoRepositoryConfig().
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: repositoryKeys.detail(projectKey) })
      }
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
      if (isDemoMode()) {
        const current =
          queryClient.getQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey)) ??
          getDemoRepositoryConfig(projectKey)
        return { ...current, commitPatterns: patterns }
      }

      const res = await apiFetch(`/api/projects/${projectKey}/repository`, {
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
    onSuccess: (data) => {
      showToast.success('Commit patterns updated')
      if (isDemoMode() && data) {
        queryClient.setQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey), data)
      }
    },
    onSettled: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: repositoryKeys.detail(projectKey) })
      }
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
      if (isDemoMode()) {
        const current =
          queryClient.getQueryData<RepositoryConfig>(repositoryKeys.detail(projectKey)) ??
          getDemoRepositoryConfig(projectKey)
        if (action === 'generate') {
          return {
            ...current,
            hasWebhookSecret: true,
            webhookSecret: `demo-whsec-${crypto.randomUUID()}`,
          }
        }
        return { ...current, hasWebhookSecret: false, webhookSecret: undefined }
      }

      const res = await apiFetch(`/api/projects/${projectKey}/repository`, {
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
