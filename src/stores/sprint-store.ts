import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SortConfig } from '@/stores/backlog-store'

interface DismissedPrompt {
  dismissedAt: number // timestamp
  action: 'later' | 'extend'
}

interface SprintState {
  // Track dismissed completion prompts per sprint
  dismissedPrompts: Record<string, DismissedPrompt>
  dismissSprintPrompt: (sprintId: string, action: 'later' | 'extend') => void
  shouldShowPrompt: (sprintId: string) => boolean
  clearDismissedPrompt: (sprintId: string) => void
  clearAllDismissedPrompts: () => void

  // Per-section sort configuration (keyed by sprint ID or 'backlog')
  sprintSorts: Record<string, SortConfig | null>
  getSprintSort: (sectionId: string) => SortConfig | null
  setSprintSort: (sectionId: string, sort: SortConfig | null) => void
  clearAllSprintSorts: () => void

  // Sprint planning view state
  planningViewOpen: boolean
  setPlanningViewOpen: (open: boolean) => void

  // Hydration flag
  _hasHydrated: boolean
}

// Re-prompt after 24 hours if dismissed with "later"
const LATER_DISMISS_DURATION = 24 * 60 * 60 * 1000 // 24 hours in ms

export const useSprintStore = create<SprintState>()(
  persist(
    (set, get) => ({
      dismissedPrompts: {},

      dismissSprintPrompt: (sprintId, action) =>
        set((state) => ({
          dismissedPrompts: {
            ...state.dismissedPrompts,
            [sprintId]: {
              dismissedAt: Date.now(),
              action,
            },
          },
        })),

      shouldShowPrompt: (sprintId) => {
        const dismissed = get().dismissedPrompts[sprintId]
        if (!dismissed) return true

        // If dismissed with "extend", the sprint was extended and prompt shouldn't show
        // until the sprint becomes expired again (which will be detected by the caller)
        if (dismissed.action === 'extend') return false

        // If dismissed with "later", re-prompt after 24 hours
        const timeSinceDismiss = Date.now() - dismissed.dismissedAt
        return timeSinceDismiss >= LATER_DISMISS_DURATION
      },

      clearDismissedPrompt: (sprintId) =>
        set((state) => {
          const { [sprintId]: _, ...rest } = state.dismissedPrompts
          return { dismissedPrompts: rest }
        }),

      clearAllDismissedPrompts: () => set({ dismissedPrompts: {} }),

      // Per-section sort configuration
      sprintSorts: {},
      getSprintSort: (sectionId) => get().sprintSorts[sectionId] ?? null,
      setSprintSort: (sectionId, sort) =>
        set((state) => ({
          sprintSorts: {
            ...state.sprintSorts,
            [sectionId]: sort,
          },
        })),
      clearAllSprintSorts: () => set({ sprintSorts: {} }),

      // Sprint planning view state
      planningViewOpen: false,
      setPlanningViewOpen: (open) => set({ planningViewOpen: open }),

      // Hydration
      _hasHydrated: false,
    }),
    {
      name: 'punt-sprint-store',
      version: 2,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true
        }
      },
      // Persist dismissedPrompts and sprint sort configuration
      partialize: (state) => ({
        dismissedPrompts: state.dismissedPrompts,
        sprintSorts: state.sprintSorts,
      }),
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>
        if (version < 2) {
          // Add sprintSorts for existing users upgrading from v1
          state.sprintSorts = {}
        }
        return state as SprintState
      },
    },
  ),
)
