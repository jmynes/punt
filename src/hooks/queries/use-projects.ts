'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import { getDataProvider, type ProjectSummary as ProviderProjectSummary } from '@/lib/data-provider'
import { type ProjectSummary, useProjectsStore } from '@/stores/projects-store'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
}

export interface ProjectDetail {
  id: string
  name: string
  key: string
  color: string
  description: string | null
  showAddColumnButton: boolean | null
  effectiveShowAddColumnButton: boolean
  createdAt: string
  updatedAt: string
  role: string
  _count: { tickets: number; members: number }
}

/**
 * Fetch a single project's details (including board settings)
 */
export function useProjectDetail(projectKey: string) {
  return useQuery<ProjectDetail>({
    queryKey: projectKeys.detail(projectKey),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectKey}`)
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch project' }))
        throw new Error(error.error || 'Failed to fetch project')
      }
      return res.json()
    },
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Fetch all projects for the current user and sync with Zustand store
 */
export function useProjects() {
  const { setProjects, setLoading, setError } = useProjectsStore()

  const query = useQuery<ProviderProjectSummary[], Error, ProjectSummary[]>({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.getProjects()
    },
    select: (data) => data as ProjectSummary[],
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
      const provider = getDataProvider(getTabId())
      return provider.createProject(data)
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
        addProject(newProject as ProjectSummary)
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
      showAddColumnButton?: boolean | null
    }) => {
      const provider = getDataProvider(getTabId())
      return provider.updateProject(id, data)
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
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      // Also invalidate the project detail cache
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) })
      }
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
      const provider = getDataProvider(getTabId())
      await provider.deleteProject(id)
      return { success: true }
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
