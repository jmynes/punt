import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // Copy/paste behavior
  openSinglePastedTicket: boolean
  setOpenSinglePastedTicket: (value: boolean) => void

  // Date picker max year for ticket forms
  ticketDateMaxYearMode: 'default' | 'custom'
  setTicketDateMaxYearMode: (value: 'default' | 'custom') => void
  ticketDateMaxYear: number
  setTicketDateMaxYear: (value: number) => void

  // Ticket drawer unsaved changes behavior
  autoSaveOnDrawerClose: boolean
  setAutoSaveOnDrawerClose: (value: boolean) => void

  // Role editor unsaved changes behavior
  autoSaveOnRoleEditorClose: boolean
  setAutoSaveOnRoleEditorClose: (value: boolean) => void

  // Custom saved colors for color pickers
  customColors: string[]
  addCustomColor: (color: string) => void
  removeCustomColor: (color: string) => void

  // Sidebar settings section expanded state
  sidebarExpandedSections: Record<string, boolean> // keyed by 'admin' or project ID
  setSidebarSectionExpanded: (key: string, expanded: boolean) => void
  toggleSidebarSection: (key: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default: open single pasted ticket
      openSinglePastedTicket: true,
      setOpenSinglePastedTicket: (value) => set({ openSinglePastedTicket: value }),

      // Default: use default max year (current year + 5)
      ticketDateMaxYearMode: 'default',
      setTicketDateMaxYearMode: (value) => set({ ticketDateMaxYearMode: value }),
      ticketDateMaxYear: new Date().getFullYear() + 5,
      setTicketDateMaxYear: (value) => set({ ticketDateMaxYear: value }),

      // Default: show confirmation dialog for unsaved changes
      autoSaveOnDrawerClose: false,
      setAutoSaveOnDrawerClose: (value) => set({ autoSaveOnDrawerClose: value }),

      // Default: show confirmation dialog for unsaved role changes
      autoSaveOnRoleEditorClose: false,
      setAutoSaveOnRoleEditorClose: (value) => set({ autoSaveOnRoleEditorClose: value }),

      // Sidebar settings sections - default collapsed
      sidebarExpandedSections: {},
      setSidebarSectionExpanded: (key, expanded) =>
        set((state) => ({
          sidebarExpandedSections: { ...state.sidebarExpandedSections, [key]: expanded },
        })),
      toggleSidebarSection: (key) =>
        set((state) => ({
          sidebarExpandedSections: {
            ...state.sidebarExpandedSections,
            [key]: !state.sidebarExpandedSections[key],
          },
        })),

      // Custom saved colors (max 20)
      customColors: [],
      addCustomColor: (color) =>
        set((state) => {
          const normalized = color.toLowerCase()
          if (state.customColors.includes(normalized)) return state
          return { customColors: [normalized, ...state.customColors].slice(0, 20) }
        }),
      removeCustomColor: (color) =>
        set((state) => ({
          customColors: state.customColors.filter((c) => c !== color.toLowerCase()),
        })),
    }),
    {
      name: 'punt-settings',
    },
  ),
)
