'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { demoStorage, isDemoMode } from '@/lib/demo'
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

      const res = await fetch(`/api/projects/${projectId}/roles`)
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
      const res = await fetch(`/api/projects/${projectId}/roles/${roleId}`)
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
      const res = await fetch(`/api/projects/${projectId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      toast.success('Role created')
      queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
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
      const res = await fetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
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
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
      queryClient.invalidateQueries({
        queryKey: roleKeys.single(projectId, variables.roleId),
      })
      // Also invalidate members since their role data might have changed
      queryClient.invalidateQueries({ queryKey: ['members', 'project', projectId] })
    },
    onError: (err) => {
      toast.error(err.message)
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
      const res = await fetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete role')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Role deleted')
      queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
    },
    onError: (err) => {
      toast.error(err.message)
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
      const res = await fetch(`/api/projects/${projectId}/roles/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      toast.error(err.message)
      // Refetch to restore correct order
      queryClient.invalidateQueries({ queryKey: roleKeys.byProject(projectId) })
    },
  })
}
