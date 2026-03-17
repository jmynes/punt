'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import type { Permission, RoleWithPermissions } from '@/types'

// Query keys for roles
export const roleKeys = {
  all: ['roles'] as const,
  byProject: (projectId: string) => ['roles', 'project', projectId] as const,
  single: (projectId: string, roleId: string) => ['roles', 'project', projectId, roleId] as const,
}

/**
 * Fetch all roles for a project
 */
export function useProjectRoles(projectId: string) {
  return useQuery<RoleWithPermissions[]>({
    queryKey: roleKeys.byProject(projectId),
    queryFn: async () => {
      // Demo mode: return demo roles
      if (isDemoMode()) {
        const roles = demoStorage.getRoles(projectId)
        // Return roles with all permissions enabled for owner
        return roles.map((role) => ({
          ...role,
          permissions: [
            'project.settings',
            'members.invite',
            'members.manage',
            'members.admin',
            'board.manage',
            'tickets.create',
            'tickets.manage_own',
            'tickets.manage_any',
            'sprints.manage',
            'labels.manage',
            'comments.manage_any',
            'attachments.manage_any',
          ] as Permission[],
        }))
      }

      const res = await apiFetch(`/api/projects/${projectId}/roles`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch roles')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Fetch a single role
 */
export function useRole(projectId: string, roleId: string) {
  return useQuery<RoleWithPermissions>({
    queryKey: roleKeys.single(projectId, roleId),
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${projectId}/roles/${roleId}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch role')
      }
      return res.json()
    },
    enabled: !!projectId && !!roleId,
    staleTime: 1000 * 60,
  })
}

interface CreateRoleData {
  name: string
  color: string
  description?: string
  permissions: Permission[]
}

/**
 * Create a new role
 */
export function useCreateRole(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateRoleData) => {
      if (isDemoMode()) {
        // In demo mode, create a role in memory
        const newRole: RoleWithPermissions = {
          id: crypto.randomUUID(),
          name: data.name,
          color: data.color,
          description: data.description ?? null,
          isDefault: false,
          position: 999,
          permissions: data.permissions ?? [],
        }
        const current = queryClient.getQueryData<RoleWithPermissions[]>(
          roleKeys.byProject(projectId),
        )
        queryClient.setQueryData(roleKeys.byProject(projectId), [...(current ?? []), newRole])
        return newRole
      }

      const res = await apiFetch(`/api/projects/${projectId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create role')
      }
      return res.json() as Promise<RoleWithPermissions>
    },
    onSuccess: () => {
      showToast.success('Role created')
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
      }
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

interface UpdateRoleData {
  roleId: string
  name?: string
  color?: string
  description?: string | null
  permissions?: Permission[]
}

/**
 * Update a role
 */
export function useUpdateRole(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ roleId, ...data }: UpdateRoleData) => {
      if (isDemoMode()) {
        // In demo mode, update role in the query cache
        const current = queryClient.getQueryData<RoleWithPermissions[]>(
          roleKeys.byProject(projectId),
        )
        const updatedRoles = (current ?? []).map((r) => (r.id === roleId ? { ...r, ...data } : r))
        queryClient.setQueryData(roleKeys.byProject(projectId), updatedRoles)
        const updated = updatedRoles.find((r) => r.id === roleId)
        if (!updated) throw new Error('Role not found')
        return updated
      }

      const res = await apiFetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update role')
      }
      return res.json() as Promise<RoleWithPermissions>
    },
    onSuccess: (_data, variables) => {
      showToast.success('Role updated')
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
        queryClient.invalidateQueries({
          queryKey: roleKeys.single(projectId, variables.roleId),
        })
        queryClient.invalidateQueries({ queryKey: ['members', 'project', projectId] })
      }
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

/**
 * Delete a role
 */
export function useDeleteRole(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (roleId: string) => {
      if (isDemoMode()) {
        // In demo mode, remove role from the query cache
        const current = queryClient.getQueryData<RoleWithPermissions[]>(
          roleKeys.byProject(projectId),
        )
        queryClient.setQueryData(
          roleKeys.byProject(projectId),
          (current ?? []).filter((r) => r.id !== roleId),
        )
        return { success: true }
      }

      const res = await apiFetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete role')
      }
      return res.json()
    },
    onSuccess: () => {
      showToast.success('Role deleted')
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
      }
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

/**
 * Reset all project roles to system admin defaults
 */
export function useResetRolesToDefaults(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        // In demo mode, return the current roles (already have all permissions)
        const currentRoles = queryClient.getQueryData<RoleWithPermissions[]>(
          roleKeys.byProject(projectId),
        )
        return currentRoles ?? []
      }

      const res = await apiFetch(`/api/projects/${projectId}/roles/reset-defaults`, {
        method: 'POST',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reset roles to defaults')
      }
      return res.json() as Promise<RoleWithPermissions[]>
    },
    onSuccess: (data) => {
      showToast.success('Roles reset to system defaults')
      queryClient.setQueryData(roleKeys.byProject(projectId), data)
      // Also invalidate members since their role data might have changed
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ['members', 'project', projectId] })
      }
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

/**
 * Reorder roles
 */
export function useReorderRoles(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (roleIds: string[]) => {
      if (isDemoMode()) {
        // In demo mode, reorder roles in the query cache
        const current = queryClient.getQueryData<RoleWithPermissions[]>(
          roleKeys.byProject(projectId),
        )
        if (!current) return []
        const reordered = roleIds
          .map((id, index) => {
            const role = current.find((r) => r.id === id)
            return role ? { ...role, position: index } : null
          })
          .filter(Boolean) as RoleWithPermissions[]
        return reordered
      }

      const res = await apiFetch(`/api/projects/${projectId}/roles/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({ roleIds }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reorder roles')
      }
      return res.json() as Promise<RoleWithPermissions[]>
    },
    onSuccess: (data) => {
      // Update the cache with the new order
      queryClient.setQueryData(roleKeys.byProject(projectId), data)
    },
    onError: (err) => {
      showToast.error(err.message)
      // Refetch to restore correct order
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
      }
    },
  })
}
