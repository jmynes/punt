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

  // Show undo/redo buttons on toast notifications
  showUndoButtons: boolean
  setShowUndoButtons: (value: boolean) => void

  // Toast notification preferences
  toastAutoDismiss: boolean
  setToastAutoDismiss: (value: boolean) => void
  toastDismissDelay: number // in milliseconds
  setToastDismissDelay: (value: number) => void
  errorToastAutoDismiss: boolean
  setErrorToastAutoDismiss: (value: boolean) => void

  // Sidebar settings section expanded state
  sidebarExpandedSections: Record<string, boolean> // keyed by 'admin' or project ID
  setSidebarSectionExpanded: (key: string, expanded: boolean) => void
  toggleSidebarSection: (key: string) => void

  // Hide warning when removing saved colors from swatches
  hideColorRemovalWarning: boolean
  setHideColorRemovalWarning: (value: boolean) => void

  // Keep ticket selection after context menu actions
  keepSelectionAfterAction: boolean
  setKeepSelectionAfterAction: (value: boolean) => void

  // Persist table sort configuration across page refreshes
  persistTableSort: boolean
  setPersistTableSort: (value: boolean) => void

  // Projects where user has dismissed the "Add Column" button
  dismissedAddColumnProjects: string[]
  dismissAddColumn: (projectId: string) => void
  undismissAddColumn: (projectId: string) => void

  // Particle animations for celebrations and warnings
  enableParticleAnimations: boolean
  setEnableParticleAnimations: (value: boolean) => void

  // Chat panel visibility
  showChatPanel: boolean
  setShowChatPanel: (value: boolean) => void

  // Collapse attachments section by default in ticket drawer
  collapseAttachmentsByDefault: boolean
  setCollapseAttachmentsByDefault: (value: boolean) => void
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

      // Show undo/redo buttons on toast notifications (on by default)
      showUndoButtons: true,
      setShowUndoButtons: (value) => set({ showUndoButtons: value }),

      // Toast notification preferences (all auto-dismiss on by default)
      toastAutoDismiss: true,
      setToastAutoDismiss: (value) => set({ toastAutoDismiss: value }),
      toastDismissDelay: 4000, // 4 seconds default
      setToastDismissDelay: (value) => set({ toastDismissDelay: value }),
      errorToastAutoDismiss: true,
      setErrorToastAutoDismiss: (value) => set({ errorToastAutoDismiss: value }),

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

      // Hide color removal warning (off by default - show warning)
      hideColorRemovalWarning: false,
      setHideColorRemovalWarning: (value) => set({ hideColorRemovalWarning: value }),

      // Keep selection after context menu actions (on by default)
      keepSelectionAfterAction: true,
      setKeepSelectionAfterAction: (value) => set({ keepSelectionAfterAction: value }),

      // Persist table sort across refreshes (on by default)
      persistTableSort: true,
      setPersistTableSort: (value) => set({ persistTableSort: value }),

      // Add column dismiss per project
      dismissedAddColumnProjects: [],
      dismissAddColumn: (projectId) =>
        set((state) => {
          if (state.dismissedAddColumnProjects.includes(projectId)) return state
          return { dismissedAddColumnProjects: [...state.dismissedAddColumnProjects, projectId] }
        }),
      undismissAddColumn: (projectId) =>
        set((state) => ({
          dismissedAddColumnProjects: state.dismissedAddColumnProjects.filter(
            (id) => id !== projectId,
          ),
        })),

      // Particle animations (on by default)
      enableParticleAnimations: true,
      setEnableParticleAnimations: (value) => set({ enableParticleAnimations: value }),

      // Chat panel visibility (on by default)
      showChatPanel: true,
      setShowChatPanel: (value) => set({ showChatPanel: value }),

      // Collapse attachments section by default (off by default - expanded)
      collapseAttachmentsByDefault: false,
      setCollapseAttachmentsByDefault: (value) => set({ collapseAttachmentsByDefault: value }),
    }),
    {
      name: 'punt-settings',
    },
  ),
)
