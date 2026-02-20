'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { DEMO_ROLE, isDemoMode } from '@/lib/demo'
import { ALL_PERMISSIONS } from '@/lib/permissions/constants'
import { useRoleSimulationStore } from '@/stores/role-simulation-store'
import type { Permission, RoleSummary } from '@/types'
import { useCurrentUser } from './use-current-user'

// Query keys for permissions
export const permissionKeys = {
  myPermissions: (projectId: string) => ['permissions', 'my', projectId] as const,
  myRealPermissions: (projectId: string) => ['permissions', 'my-real', projectId] as const,
}

interface MyPermissionsResponse {
  permissions: Permission[]
  role: RoleSummary
  overrides: Permission[]
  isSystemAdmin: boolean
}

/**
 * Fetch current user's effective permissions in a project.
 * When role simulation is active, returns the simulated role's permissions instead.
 * In demo mode, returns full permissions (owner role).
 */
export function useMyPermissions(projectId: string) {
  const user = useCurrentUser()
  const simulatedRole = useRoleSimulationStore((s) => s.getSimulatedRole(projectId))

  const query = useQuery<MyPermissionsResponse>({
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

  // If simulating a role, override the query data with simulated permissions
  const data = useMemo(() => {
    if (simulatedRole && query.data) {
      return {
        permissions: simulatedRole.permissions,
        role: simulatedRole.role,
        overrides: [],
        // Simulation disables system admin privileges to show true role behavior
        isSystemAdmin: false,
      }
    }
    return query.data
  }, [simulatedRole, query.data])

  return {
    ...query,
    data,
  }
}

/**
 * Fetch the current user's real (non-simulated) permissions.
 * Used internally by the role simulation UI to determine
 * which roles the user is allowed to simulate.
 */
export function useMyRealPermissions(projectId: string) {
  const user = useCurrentUser()

  return useQuery<MyPermissionsResponse>({
    queryKey: permissionKeys.myRealPermissions(projectId),
    queryFn: async () => {
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
    staleTime: 1000 * 60,
  })
}

/**
 * Check if the current user has a specific permission in a project.
 * Returns undefined while loading, true/false once loaded.
 * Respects role simulation when active.
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
 * Respects role simulation when active.
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
 * Respects role simulation when active.
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
