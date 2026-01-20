import { create } from 'zustand'
import type { TicketFormData } from '@/types'

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Mobile navigation
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void

  // Active project
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void

  // Modals
  createTicketOpen: boolean
  setCreateTicketOpen: (open: boolean) => void
  createProjectOpen: boolean
  setCreateProjectOpen: (open: boolean) => void
  editProjectOpen: boolean
  editProjectId: string | null
  openEditProject: (projectId: string) => void
  closeEditProject: () => void

  // Pre-filled data for creating a ticket (e.g., when cloning)
  prefillTicketData: Partial<TicketFormData> | null
  openCreateTicketWithData: (data: Partial<TicketFormData>) => void
  clearPrefillData: () => void

  // Ticket detail drawer
  activeTicketId: string | null
  setActiveTicketId: (id: string | null) => void
  drawerFocusField: string | null
  openTicketWithFocus: (ticketId: string, field: string) => void
  clearDrawerFocusField: () => void

  // Toast undo visibility
  showUndoButtons: boolean
  setShowUndoButtons: (show: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Mobile navigation
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

  // Active project
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),

  // Modals
  createTicketOpen: false,
  setCreateTicketOpen: (open) =>
    set({ createTicketOpen: open, prefillTicketData: open ? null : null }),
  createProjectOpen: false,
  setCreateProjectOpen: (open) => set({ createProjectOpen: open }),
  editProjectOpen: false,
  editProjectId: null,
  openEditProject: (projectId) => set({ editProjectOpen: true, editProjectId: projectId }),
  closeEditProject: () => set({ editProjectOpen: false, editProjectId: null }),

  // Pre-filled data for creating a ticket (e.g., when cloning)
  prefillTicketData: null,
  openCreateTicketWithData: (data) => set({ createTicketOpen: true, prefillTicketData: data }),
  clearPrefillData: () => set({ prefillTicketData: null }),

  // Ticket detail drawer
  activeTicketId: null,
  setActiveTicketId: (id) => set({ activeTicketId: id, drawerFocusField: null }),
  drawerFocusField: null,
  openTicketWithFocus: (ticketId, field) => set({ activeTicketId: ticketId, drawerFocusField: field }),
  clearDrawerFocusField: () => set({ drawerFocusField: null }),

  // Toast undo visibility (on by default)
  showUndoButtons: true,
  setShowUndoButtons: (show) => set({ showUndoButtons: show }),
}))
