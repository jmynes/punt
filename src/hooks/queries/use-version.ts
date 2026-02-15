'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateCheckResult } from '@/app/api/version/check/route'
import type { LocalVersionInfo } from '@/app/api/version/route'
import { isDemoMode } from '@/lib/demo'

export const versionKeys = {
  local: ['version', 'local'] as const,
  check: ['version', 'check'] as const,
}

// Demo mode version info
const DEMO_LOCAL_VERSION: LocalVersionInfo = {
  version: '0.0.0-demo',
  commit: 'demo',
  commitShort: 'demo',
  buildTime: null,
}

/**
 * Get local version info
 * This is a public endpoint, no auth required
 */
export function useLocalVersion() {
  return useQuery<LocalVersionInfo>({
    queryKey: versionKeys.local,
    queryFn: async () => {
      if (isDemoMode()) {
        return DEMO_LOCAL_VERSION
      }

      const res = await fetch('/api/version')
      if (!res.ok) {
        throw new Error('Failed to fetch version info')
      }
      return res.json()
    },
    staleTime: Infinity, // Version doesn't change during session
  })
}

/**
 * Check for updates against the configured repository
 * Requires system admin
 */
export function useCheckForUpdates() {
  const queryClient = useQueryClient()

  return useMutation<UpdateCheckResult>({
    mutationFn: async () => {
      if (isDemoMode()) {
        return {
          local: DEMO_LOCAL_VERSION,
          remote: {
            latestVersion: null,
            latestCommit: null,
            latestCommitShort: null,
            releaseUrl: null,
            releaseName: null,
            publishedAt: null,
          },
          updateAvailable: false,
          commitsBehind: false,
          repoUrl: 'https://github.com/jmynes/punt/',
          error: 'Update checking is disabled in demo mode',
        }
      }

      const res = await fetch('/api/version/check')
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || 'Failed to check for updates')
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Cache the result
      queryClient.setQueryData(versionKeys.check, data)
    },
  })
}

/**
 * Get the last update check result (from cache)
 */
export function useLastUpdateCheck() {
  return useQuery<UpdateCheckResult>({
    queryKey: versionKeys.check,
    queryFn: () => {
      // This will only return cached data, never fetch
      throw new Error('No cached update check')
    },
    enabled: false, // Don't auto-fetch, only use cached data
    staleTime: 1000 * 60 * 15, // Consider stale after 15 minutes
  })
}
