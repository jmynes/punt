import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logger } from '@/lib/logger'

export interface ProjectSummary {
  id: string
  name: string
  key: string
  color: string
  description?: string
}

// Default projects for demo
const defaultProjects: ProjectSummary[] = [
  { id: '1', name: 'PUNT', key: 'PUNT', color: '#f59e0b' },
  { id: '2', name: 'Backend API', key: 'API', color: '#10b981' },
  { id: '3', name: 'Mobile App', key: 'MOB', color: '#8b5cf6' },
]

// Generate next numeric ID based on existing projects
function getNextId(projects: ProjectSummary[]): string {
  const numericIds = projects
    .map((p) => parseInt(p.id, 10))
    .filter((id) => !isNaN(id))
  const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0
  return String(maxId + 1)
}

interface ProjectsState {
  projects: ProjectSummary[]

  // Hydration state for SSR
  _hasHydrated: boolean
  setHasHydrated: (value: boolean) => void

  // CRUD operations
  addProject: (project: Omit<ProjectSummary, 'id'>) => ProjectSummary
  restoreProject: (project: ProjectSummary) => void // For undo/redo - restores project with original ID
  updateProject: (id: string, updates: Partial<Omit<ProjectSummary, 'id'>>) => void
  removeProject: (id: string) => void

  // Getters
  getProject: (id: string) => ProjectSummary | undefined
  getProjectByKey: (key: string) => ProjectSummary | undefined
  isKeyTaken: (key: string, excludeId?: string) => boolean
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: defaultProjects,

      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      addProject: (projectData) => {
        const currentProjects = get().projects
        const newProject: ProjectSummary = {
          ...projectData,
          id: getNextId(currentProjects),
        }

        logger.info('Adding project', { projectId: newProject.id, name: newProject.name })

        set((state) => ({
          projects: [...state.projects, newProject],
        }))

        return newProject
      },

      restoreProject: (project) => {
        logger.info('Restoring project', { projectId: project.id, name: project.name })

        set((state) => ({
          projects: [...state.projects, { ...project }],
        }))
      },

      updateProject: (id, updates) => {
        logger.info('Updating project', { projectId: id, updates })

        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }))
      },

      removeProject: (id) => {
        logger.info('Removing project', { projectId: id })

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

      isKeyTaken: (key, excludeId) => {
        return get().projects.some(
          (p) => p.key.toLowerCase() === key.toLowerCase() && p.id !== excludeId,
        )
      },
    }),
    {
      name: 'punt-projects-storage',
      // Only persist projects, not hydration state
      partialize: (state) => ({ projects: state.projects }),
      // Mark as hydrated when rehydration completes
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger.debug('Rehydrating projects store from localStorage')
          state.setHasHydrated(true)
          logger.info('Projects store rehydrated', { projectCount: state.projects.length })
        }
      },
    },
  ),
)
