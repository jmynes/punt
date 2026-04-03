'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/base-path'
import { DEMO_TEAM_SUMMARIES, DEMO_USER_SUMMARY, isDemoMode } from '@/lib/demo'
import type { UserSummary } from '@/types'

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 * In demo mode, always returns the demo user
 */
export function useCurrentUser(): UserSummary | null {
  const demo = isDemoMode()
  const { data: session, status } = useSession()

  if (demo) {
    return DEMO_USER_SUMMARY
  }

  if (status === 'loading' || !session?.user) {
    return null
  }

  return {
    id: session.user.id,
    username: session.user.username || '',
    name: session.user.name || 'Unknown',
    email: session.user.email || '',
    avatar: session.user.avatar || null,
    avatarColor: session.user.avatarColor || null,
    isSystemAdmin: session.user.isSystemAdmin ?? false,
  }
}

/**
 * Check if the current user is authenticated
 * In demo mode, always returns authenticated
 */
export function useIsAuthenticated(): { isAuthenticated: boolean; isLoading: boolean } {
  const demo = isDemoMode()
  const { status } = useSession()

  if (demo) {
    return { isAuthenticated: true, isLoading: false }
  }

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
  const demo = isDemoMode()
  const { data: session, status } = useSession()

  if (demo) {
    return { isSystemAdmin: false, isLoading: false }
  }

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
  const demo = isDemoMode()
  const { data } = useQuery({
    queryKey: ['project', projectId, 'members'],
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${projectId}/members`)
      if (!res.ok) {
        throw new Error('Failed to fetch project members')
      }
      const responseData = await res.json()
      return responseData.map((m: { user: UserSummary }) => m.user) as UserSummary[]
    },
    enabled: !!projectId && !demo,
  })

  if (demo) {
    return [DEMO_USER_SUMMARY, ...DEMO_TEAM_SUMMARIES]
  }

  return data || []
}
