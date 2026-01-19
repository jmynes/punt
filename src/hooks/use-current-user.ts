'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { UserSummary } from '@/types'

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 */
export function useCurrentUser(): UserSummary | null {
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
 */
export function useIsAuthenticated(): { isAuthenticated: boolean; isLoading: boolean } {
  const { status } = useSession()

  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  }
}

/**
 * Check if the current user is a system admin
 */
export function useIsSystemAdmin(): { isSystemAdmin: boolean; isLoading: boolean } {
  const { data: session, status } = useSession()

  return {
    isSystemAdmin: session?.user?.isSystemAdmin ?? false,
    isLoading: status === 'loading',
  }
}

// Demo members for backwards compatibility and fallback
export const DEMO_MEMBERS: UserSummary[] = [
  { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
  { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
  { id: 'user-3', name: 'Bob Johnson', email: 'bob@punt.local', avatar: null },
  { id: 'user-4', name: 'Carol Williams', email: 'carol@punt.local', avatar: null },
]

/**
 * Get project members (fetched from API)
 * Falls back to demo data when projectId is not provided (for backwards compatibility)
 */
export function useProjectMembers(projectId?: string): UserSummary[] {
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

  // Return demo data as fallback when no projectId or data not loaded yet
  return data || DEMO_MEMBERS
}
