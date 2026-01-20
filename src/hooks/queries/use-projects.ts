'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import { type ProjectSummary, useProjectsStore } from '@/stores/projects-store'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
}

/**
 * Fetch all projects for the current user and sync with Zustand store
 */
export function useProjects() {
  const { setProjects, setLoading, setError } = useProjectsStore()

  const query = useQuery<ProjectSummary[]>({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch projects')
      }
      return res.json()
    },
    staleTime: 1000 * 60, // 1 minute
  })

  // Sync with Zustand store
  useEffect(() => {
    if (query.data) {
      setProjects(query.data)
    }
  }, [query.data, setProjects])

  useEffect(() => {
    setLoading(query.isLoading)
  }, [query.isLoading, setLoading])

  useEffect(() => {
    if (query.error) {
      setError(query.error.message)
    }
  }, [query.error, setError])

  return query
}

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient()
  const { addProject, removeProject } = useProjectsStore()

  return useMutation({
    mutationFn: async (data: {
      name: string
      key: string
      color: string
      description?: string
    }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create project')
      }
      return res.json() as Promise<ProjectSummary>
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.all })

      // Snapshot previous value
      const previousProjects = queryClient.getQueryData<ProjectSummary[]>(projectKeys.all)

      // Optimistic update with temp ID
      const tempProject: ProjectSummary = {
        id: `temp-${Date.now()}`,
        ...data,
        role: 'owner',
      }
      addProject(tempProject)

      return { previousProjects, tempProject }
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.tempProject) {
        removeProject(context.tempProject.id)
      }
      toast.error(err.message)
    },
    onSuccess: (newProject, _, context) => {
      // Replace temp project with real one
      if (context?.tempProject) {
        removeProject(context.tempProject.id)
        addProject(newProject)
      }
      toast.success('Project created')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

/**
 * Update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()
  const { updateProject: updateProjectInStore } = useProjectsStore()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      name?: string
      key?: string
      color?: string
      description?: string | null
    }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update project')
      }
      return res.json() as Promise<ProjectSummary>
    },
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })

      const previousProjects = queryClient.getQueryData<ProjectSummary[]>(projectKeys.all)

      // Optimistic update
      updateProjectInStore(id, data)

      return { previousProjects }
    },
    onError: (err, _, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.all, context.previousProjects)
      }
      toast.error(err.message)
    },
    onSuccess: () => {
      toast.success('Project updated')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

/**
 * Delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()
  const { removeProject } = useProjectsStore()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete project')
      }
      return res.json()
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })

      const previousProjects = queryClient.getQueryData<ProjectSummary[]>(projectKeys.all)
      const deletedProject = previousProjects?.find((p) => p.id === id)

      // Optimistic update
      removeProject(id)

      return { previousProjects, deletedProject }
    },
    onError: (err, _, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.all, context.previousProjects)
      }
      toast.error(err.message)
    },
    onSuccess: () => {
      toast.success('Project deleted')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
