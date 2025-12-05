import { create } from 'zustand'

interface TicketOrigin {
  columnId: string
  position: number
}

interface SelectionState {
  // Set of selected ticket IDs
  selectedTicketIds: Set<string>

  // Last selected ticket ID (for shift+click range selection)
  lastSelectedId: string | null

  // Track original column and position for each selected ticket (for arrow key movement)
  ticketOrigins: Map<string, TicketOrigin>

  // Select a single ticket (clear others)
  selectTicket: (ticketId: string) => void

  // Toggle a ticket's selection (Ctrl+click)
  toggleTicket: (ticketId: string) => void

  // Select a range of tickets (Shift+click)
  selectRange: (ticketId: string, allTicketIds: string[]) => void

  // Add multiple tickets to selection
  addToSelection: (ticketIds: string[]) => void

  // Set origin for a ticket (used when tracking original position for arrow key movement)
  setTicketOrigin: (ticketId: string, origin: TicketOrigin) => void

  // Get origin for a ticket
  getTicketOrigin: (ticketId: string) => TicketOrigin | undefined

  // Check if a ticket is selected
  isSelected: (ticketId: string) => boolean

  // Clear all selections
  clearSelection: () => void

  // Get all selected ticket IDs as array
  getSelectedIds: () => string[]
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedTicketIds: new Set(),
  lastSelectedId: null,
  ticketOrigins: new Map(),

  selectTicket: (ticketId) =>
    set({
      selectedTicketIds: new Set([ticketId]),
      lastSelectedId: ticketId,
      ticketOrigins: new Map(), // Clear origins when selecting a new ticket
    }),

  toggleTicket: (ticketId) =>
    set((state) => {
      const newSet = new Set(state.selectedTicketIds)
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId)
      } else {
        newSet.add(ticketId)
      }
      return {
        selectedTicketIds: newSet,
        lastSelectedId: ticketId,
      }
    }),

  selectRange: (ticketId, allTicketIds) =>
    set((state) => {
      const lastId = state.lastSelectedId
      if (!lastId) {
        // No previous selection, just select this one
        return {
          selectedTicketIds: new Set([ticketId]),
          lastSelectedId: ticketId,
        }
      }

      // Find indices of last selected and current
      const lastIndex = allTicketIds.indexOf(lastId)
      const currentIndex = allTicketIds.indexOf(ticketId)

      if (lastIndex === -1 || currentIndex === -1) {
        // One of the tickets isn't in the list, just select current
        return {
          selectedTicketIds: new Set([ticketId]),
          lastSelectedId: ticketId,
        }
      }

      // Select all tickets in the range
      const startIndex = Math.min(lastIndex, currentIndex)
      const endIndex = Math.max(lastIndex, currentIndex)
      const rangeIds = allTicketIds.slice(startIndex, endIndex + 1)

      // Merge with existing selection
      const newSet = new Set(state.selectedTicketIds)
      for (const id of rangeIds) {
        newSet.add(id)
      }

      return {
        selectedTicketIds: newSet,
        lastSelectedId: ticketId,
      }
    }),

  addToSelection: (ticketIds) =>
    set((state) => {
      const newSet = new Set(state.selectedTicketIds)
      for (const id of ticketIds) {
        newSet.add(id)
      }
      return { selectedTicketIds: newSet }
    }),

  setTicketOrigin: (ticketId, origin) =>
    set((state) => {
      const newOrigins = new Map(state.ticketOrigins)
      newOrigins.set(ticketId, origin)
      return { ticketOrigins: newOrigins }
    }),

  getTicketOrigin: (ticketId) => get().ticketOrigins.get(ticketId),

  isSelected: (ticketId) => get().selectedTicketIds.has(ticketId),

  clearSelection: () =>
    set({
      selectedTicketIds: new Set(),
      lastSelectedId: null,
      ticketOrigins: new Map(), // Clear origins when clearing selection
    }),

  getSelectedIds: () => Array.from(get().selectedTicketIds),
}))
