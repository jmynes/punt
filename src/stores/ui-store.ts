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

  // Sprint modals
  sprintCreateOpen: boolean
  setSprintCreateOpen: (open: boolean) => void
  sprintEditOpen: boolean
  sprintEditId: string | null
  openSprintEdit: (sprintId: string) => void
  closeSprintEdit: () => void
  sprintCompleteOpen: boolean
  sprintCompleteId: string | null
  openSprintComplete: (sprintId: string) => void
  closeSprintComplete: () => void
  sprintStartOpen: boolean
  sprintStartId: string | null
  openSprintStart: (sprintId: string) => void
  closeSprintStart: () => void

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

  // Sprint modals
  sprintCreateOpen: false,
  setSprintCreateOpen: (open) => set({ sprintCreateOpen: open }),
  sprintEditOpen: false,
  sprintEditId: null,
  openSprintEdit: (sprintId) => set({ sprintEditOpen: true, sprintEditId: sprintId }),
  closeSprintEdit: () => set({ sprintEditOpen: false, sprintEditId: null }),
  sprintCompleteOpen: false,
  sprintCompleteId: null,
  openSprintComplete: (sprintId) => set({ sprintCompleteOpen: true, sprintCompleteId: sprintId }),
  closeSprintComplete: () => set({ sprintCompleteOpen: false, sprintCompleteId: null }),
  sprintStartOpen: false,
  sprintStartId: null,
  openSprintStart: (sprintId) => set({ sprintStartOpen: true, sprintStartId: sprintId }),
  closeSprintStart: () => set({ sprintStartOpen: false, sprintStartId: null }),

  // Pre-filled data for creating a ticket (e.g., when cloning)
  prefillTicketData: null,
  openCreateTicketWithData: (data) => set({ createTicketOpen: true, prefillTicketData: data }),
  clearPrefillData: () => set({ prefillTicketData: null }),

  // Ticket detail drawer
  activeTicketId: null,
  setActiveTicketId: (id) => set({ activeTicketId: id, drawerFocusField: null }),
  drawerFocusField: null,
  openTicketWithFocus: (ticketId, field) =>
    set({ activeTicketId: ticketId, drawerFocusField: field }),
  clearDrawerFocusField: () => set({ drawerFocusField: null }),
}))
