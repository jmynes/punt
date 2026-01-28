'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { DEMO_TEAM_SUMMARIES, DEMO_USER_SUMMARY, isDemoMode } from '@/lib/demo'
import type { UserSummary } from '@/types'

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 * In demo mode, always returns the demo user
 */
export function useCurrentUser(): UserSummary | null {
  // Demo mode: return demo user without session hook
  // isDemoMode() is constant based on env vars, safe to check before hooks
  if (isDemoMode()) {
    return DEMO_USER_SUMMARY
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const { data: session, status } = useSession()

  if (status === 'loading' || !session?.user) {
    return null
  }

  return {
    id: session.user.id,
    name: session.user.name || 'Unknown',
    email: session.user.email || '',
    avatar: session.user.avatar || null,
    isSystemAdmin: session.user.isSystemAdmin ?? false,
  }
}

/**
 * Check if the current user is authenticated
 * In demo mode, always returns authenticated
 */
export function useIsAuthenticated(): { isAuthenticated: boolean; isLoading: boolean } {
  if (isDemoMode()) {
    return { isAuthenticated: true, isLoading: false }
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const { status } = useSession()

  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  }
}

/**
 * Check if the current user is a system admin
 * In demo mode, returns false (demo user is not admin)
 */
export function useIsSystemAdmin(): { isSystemAdmin: boolean; isLoading: boolean } {
  if (isDemoMode()) {
    return { isSystemAdmin: false, isLoading: false }
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const { data: session, status } = useSession()

  return {
    isSystemAdmin: session?.user?.isSystemAdmin ?? false,
    isLoading: status === 'loading',
  }
}

/**
 * Get project members (fetched from API)
 * Returns empty array while loading
 * In demo mode, returns demo user and team members
 */
export function useProjectMembers(projectId?: string): UserSummary[] {
  // Demo mode: always return demo members (no API call needed)
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  if (isDemoMode()) {
    return [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES]
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const { data } = useQuery({
    queryKey: ['project', projectId, 'members'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`)
      if (!res.ok) {
        throw new Error('Failed to fetch project members')
      }
      const responseData = await res.json()
      return responseData.map((m: { user: UserSummary }) => m.user) as UserSummary[]
    },
    enabled: !!projectId,
  })

  return data || []
}
