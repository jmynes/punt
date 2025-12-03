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

	// Pre-filled data for creating a ticket (e.g., when cloning)
	prefillTicketData: Partial<TicketFormData> | null
	openCreateTicketWithData: (data: Partial<TicketFormData>) => void
	clearPrefillData: () => void

	// Ticket detail drawer
	activeTicketId: string | null
	setActiveTicketId: (id: string | null) => void
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
	setCreateTicketOpen: (open) => set({ createTicketOpen: open, prefillTicketData: open ? null : null }),
	createProjectOpen: false,
	setCreateProjectOpen: (open) => set({ createProjectOpen: open }),

	// Pre-filled data for creating a ticket (e.g., when cloning)
	prefillTicketData: null,
	openCreateTicketWithData: (data) => set({ createTicketOpen: true, prefillTicketData: data }),
	clearPrefillData: () => set({ prefillTicketData: null }),

	// Ticket detail drawer
	activeTicketId: null,
	setActiveTicketId: (id) => set({ activeTicketId: id }),
}))
