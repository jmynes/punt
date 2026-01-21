import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

      // Sprint planning view state
      planningViewOpen: false,
      setPlanningViewOpen: (open) => set({ planningViewOpen: open }),

      // Hydration
      _hasHydrated: false,
    }),
    {
      name: 'punt-sprint-store',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true
        }
      },
      // Only persist dismissedPrompts, not UI state
      partialize: (state) => ({
        dismissedPrompts: state.dismissedPrompts,
      }),
    },
  ),
)
