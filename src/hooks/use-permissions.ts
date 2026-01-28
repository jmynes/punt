'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { DEMO_ROLE, isDemoMode } from '@/lib/demo'
import { ALL_PERMISSIONS } from '@/lib/permissions/constants'
import type { Permission, RoleSummary } from '@/types'
import { useCurrentUser } from './use-current-user'

// Query keys for permissions
export const permissionKeys = {
  myPermissions: (projectId: string) => ['permissions', 'my', projectId] as const,
}

interface MyPermissionsResponse {
  permissions: Permission[]
  role: RoleSummary
  overrides: Permission[]
  isSystemAdmin: boolean
}

/**
 * Fetch current user's effective permissions in a project
 * In demo mode, returns full permissions (owner role)
 */
export function useMyPermissions(projectId: string) {
  const user = useCurrentUser()

  return useQuery<MyPermissionsResponse>({
    queryKey: permissionKeys.myPermissions(projectId),
    queryFn: async () => {
      // Demo mode: return full permissions as owner
      if (isDemoMode()) {
        return {
          permissions: ALL_PERMISSIONS,
          role: DEMO_ROLE as RoleSummary,
          overrides: [],
          isSystemAdmin: true,
        }
      }

      const res = await fetch(`/api/projects/${projectId}/my-permissions`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch permissions')
      }
      return res.json()
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Check if the current user has a specific permission in a project.
 * Returns undefined while loading, true/false once loaded.
 */
export function useHasPermission(projectId: string, permission: Permission): boolean | undefined {
  const { data, isLoading } = useMyPermissions(projectId)

  return useMemo(() => {
    if (isLoading || !data) return undefined
    return data.isSystemAdmin || data.permissions.includes(permission)
  }, [data, isLoading, permission])
}

/**
 * Check if the current user has any of the specified permissions.
 */
export function useHasAnyPermission(
  projectId: string,
  permissions: Permission[],
): boolean | undefined {
  const { data, isLoading } = useMyPermissions(projectId)

  return useMemo(() => {
    if (isLoading || !data) return undefined
    if (data.isSystemAdmin) return true
    return permissions.some((p) => data.permissions.includes(p))
  }, [data, isLoading, permissions])
}

/**
 * Check if the current user has all of the specified permissions.
 */
export function useHasAllPermissions(
  projectId: string,
  permissions: Permission[],
): boolean | undefined {
  const { data, isLoading } = useMyPermissions(projectId)

  return useMemo(() => {
    if (isLoading || !data) return undefined
    if (data.isSystemAdmin) return true
    return permissions.every((p) => data.permissions.includes(p))
  }, [data, isLoading, permissions])
}

/**
 * Check if the current user is a system admin.
 */
export function useIsSystemAdmin(): boolean {
  const user = useCurrentUser()
  return user?.isSystemAdmin ?? false
}
