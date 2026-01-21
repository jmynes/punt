import { create } from 'zustand'
import { logger } from '@/lib/logger'

export interface ProjectSummary {
  id: string
  name: string
  key: string
  color: string
  description?: string | null
  role?: string
  _count?: {
    tickets: number
    members: number
  }
}

interface ProjectsState {
  projects: ProjectSummary[]
  isLoading: boolean
  error: string | null

  // Sync from server (called by React Query)
  setProjects: (projects: ProjectSummary[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Local operations (optimistic updates, will be synced by React Query)
  addProject: (project: ProjectSummary) => void
  updateProject: (id: string, updates: Partial<Omit<ProjectSummary, 'id'>>) => void
  removeProject: (id: string) => void

  // Getters
  getProject: (id: string) => ProjectSummary | undefined
  getProjectByKey: (key: string) => ProjectSummary | undefined
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  projects: [],
  isLoading: true,
  error: null,

  setProjects: (projects) => {
    logger.debug('Setting projects from server', { count: projects.length })
    set({ projects, isLoading: false, error: null })
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  addProject: (project) => {
    logger.info('Adding project (optimistic)', { projectId: project.id, name: project.name })
    set((state) => ({
      projects: [...state.projects, project],
    }))
  },

  updateProject: (id, updates) => {
    logger.info('Updating project (optimistic)', { projectId: id, updates })
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
  },

  removeProject: (id) => {
    logger.info('Removing project (optimistic)', { projectId: id })
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }))
  },

  getProject: (id) => {
    return get().projects.find((p) => p.id === id)
  },

  getProjectByKey: (key) => {
    return get().projects.find((p) => p.key.toLowerCase() === key.toLowerCase())
  },
}))
