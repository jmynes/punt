'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
 */
export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMemberWithRole[]>({
    queryKey: memberKeys.byProject(projectId),
    queryFn: async () => {
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
      toast.success('Member updated')
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      queryClient.invalidateQueries({
        queryKey: memberKeys.single(projectId, variables.memberId),
      })
      // Also invalidate roles to update member counts
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
    },
    onError: (err) => {
      toast.error(err.message)
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
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove member')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: memberKeys.byProject(projectId) })
      // Also invalidate roles to update member counts
      queryClient.invalidateQueries({ queryKey: ['roles', 'project', projectId] })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}
