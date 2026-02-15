'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTabId } from '@/hooks/use-realtime'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import type { Permission, ProjectMemberWithRole } from '@/types'

// Query keys for members
export const memberKeys = {
  all: ['members'] as const,
  byProject: (projectId: string) => ['members', 'project', projectId] as const,
  single: (projectId: string, memberId: string) =>
    ['members', 'project', projectId, memberId] as const,
}

// Extended member type with effective permissions
export interface MemberDetails extends ProjectMemberWithRole {
  effectivePermissions: Permission[]
}

/**
 * Fetch all members for a project
 * Note: Not using DataProvider because the members-tab needs full ProjectMemberWithRole data,
 * not just UserSummary. The DataProvider's getProjectMembers is for simpler use cases.
 */
export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMemberWithRole[]>({
    queryKey: memberKeys.byProject(projectId),
    queryFn: async () => {
      // Demo mode: return demo member
      if (isDemoMode()) {
        const members = demoStorage.getMembers(projectId) as Array<{
          id: string
          roleId: string
          userId: string
          user: {
            id: string
            name: string
            email: string | null
            avatar: string | null
            avatarColor: string | null
          }
          role: { id: string; name: string; position: number }
        }>
        return members.map((m) => ({
          id: m.id,
          roleId: m.roleId,
          overrides: null,
          userId: m.userId,
          projectId,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: m.user,
          role: m.role,
        }))
      }

      const res = await fetch(`/api/projects/${projectId}/members`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch members')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Fetch a single member with details
 */
export function useMember(projectId: string, memberId: string) {
  return useQuery<MemberDetails>({
    queryKey: memberKeys.single(projectId, memberId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch member')
      }
      return res.json()
    },
    enabled: !!projectId && !!memberId,
    staleTime: 1000 * 60,
  })
}

interface UpdateMemberData {
  memberId: string
  roleId?: string
  overrides?: Permission[] | null
}

/**
 * Update a member's role or overrides
 */
export function useUpdateMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, ...data }: UpdateMemberData) => {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update member')
      }
      return res.json() as Promise<MemberDetails>
    },
    onSuccess: (_data, variables) => {
      showToast.success('Member updated')
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      queryClient.invalidateQueries({
        queryKey: memberKeys.single(projectId, variables.memberId),
      })
      // Also invalidate roles to update member counts
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

/**
 * Remove a member from the project
 */
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove member')
      }
      return res.json()
    },
    onSuccess: () => {
      showToast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      // Also invalidate roles to update member counts
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
      // Invalidate available users as the removed member is now available
      queryClient.invalidateQueries({ queryKey: availableUserKeys.byProject(projectId) })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

// Query keys for available users
export const availableUserKeys = {
  all: ['available-users'] as const,
  byProject: (projectId: string) => ['available-users', 'project', projectId] as const,
}

interface AddMemberData {
  userId: string
  roleId: string
}

/**
 * Add a new member to the project
 */
export function useAddMember(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: AddMemberData) => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add member')
      }
      return res.json() as Promise<ProjectMemberWithRole>
    },
    onSuccess: () => {
      showToast.success('Member added')
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      // Also invalidate roles to update member counts
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
      // Invalidate available users as the added member is no longer available
      queryClient.invalidateQueries({ queryKey: availableUserKeys.byProject(projectId) })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

/**
 * Fetch available users (not in the project)
 */
export function useAvailableUsers(projectId: string, search = '') {
  return useQuery<
    Array<{
      id: string
      name: string
      email: string | null
      avatar: string | null
      avatarColor: string | null
    }>
  >({
    queryKey: [...availableUserKeys.byProject(projectId), search],
    queryFn: async () => {
      // Demo mode: no available users
      if (isDemoMode()) {
        return []
      }

      const url = new URL(`/api/projects/${projectId}/available-users`, window.location.origin)
      if (search) {
        url.searchParams.set('search', search)
      }
      const res = await fetch(url.toString())
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch available users')
      }
      return res.json()
    },
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds
  })
}
