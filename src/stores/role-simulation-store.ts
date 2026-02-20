import { create } from 'zustand'
import type { Permission, RoleSummary } from '@/types'

interface SimulatedRole {
  role: RoleSummary
  permissions: Permission[]
}

interface RoleSimulationState {
  // Per-project simulated role: projectId -> simulated role data
  simulatedRoles: Record<string, SimulatedRole>

  // Start simulating a role for a project
  startSimulation: (projectId: string, role: RoleSummary, permissions: Permission[]) => void

  // Stop simulating for a project
  stopSimulation: (projectId: string) => void

  // Stop all simulations
  stopAllSimulations: () => void

  // Get the simulated role for a project (null if not simulating)
  getSimulatedRole: (projectId: string) => SimulatedRole | null

  // Check if currently simulating for a project
  isSimulating: (projectId: string) => boolean

  // Pending navigation URL (for confirmation dialog when leaving simulation)
  pendingNavigation: string | null
  setPendingNavigation: (url: string | null) => void
}

export const useRoleSimulationStore = create<RoleSimulationState>((set, get) => ({
  simulatedRoles: {},

  startSimulation: (projectId, role, permissions) =>
    set((state) => ({
      simulatedRoles: {
        ...state.simulatedRoles,
        [projectId]: { role, permissions },
      },
    })),

  stopSimulation: (projectId) =>
    set((state) => {
      const { [projectId]: _, ...rest } = state.simulatedRoles
      return { simulatedRoles: rest, pendingNavigation: null }
    }),

  stopAllSimulations: () => set({ simulatedRoles: {}, pendingNavigation: null }),

  getSimulatedRole: (projectId) => get().simulatedRoles[projectId] ?? null,

  isSimulating: (projectId) => projectId in get().simulatedRoles,

  pendingNavigation: null,
  setPendingNavigation: (url) => set({ pendingNavigation: url }),
}))
