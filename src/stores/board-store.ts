import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logger } from '@/lib/logger'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

// Default columns for a new project
const DEFAULT_COLUMNS: ColumnWithTickets[] = [
  { id: 'col-1', name: 'Backlog', order: 0, projectId: 'project-1', tickets: [] },
  { id: 'col-2', name: 'To Do', order: 1, projectId: 'project-1', tickets: [] },
  { id: 'col-3', name: 'In Progress', order: 2, projectId: 'project-1', tickets: [] },
  { id: 'col-4', name: 'In Review', order: 3, projectId: 'project-1', tickets: [] },
  { id: 'col-5', name: 'Done', order: 4, projectId: 'project-1', tickets: [] },
]

// Helper to revive Date objects from JSON
function reviveDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') {
    // Check if it looks like an ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
      return new Date(obj)
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(reviveDates)
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = reviveDates(value)
    }
    return result
  }
  return obj
}

interface BoardState {
  columns: ColumnWithTickets[]
  setColumns: (columns: ColumnWithTickets[]) => void

  // Hydration state
  _hasHydrated: boolean
  setHasHydrated: (value: boolean) => void

  // Search/filter
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Optimistic updates for drag and drop
  moveTicket: (ticketId: string, fromColumnId: string, toColumnId: string, newOrder: number) => void

  // Move multiple tickets to a column (from any source columns)
  moveTickets: (ticketIds: string[], toColumnId: string, newOrder: number) => void

  // Reorder ticket within the same column
  reorderTicket: (columnId: string, ticketId: string, newIndex: number) => void

  // Reorder multiple tickets within the same column (for multi-select drag)
  reorderTickets: (columnId: string, ticketIds: string[], targetIndex: number) => void

  // Update a single ticket
  updateTicket: (ticketId: string, updates: Partial<TicketWithRelations>) => void

  // Add a new ticket
  addTicket: (columnId: string, ticket: TicketWithRelations) => void

  // Remove a ticket
  removeTicket: (ticketId: string) => void
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      columns: DEFAULT_COLUMNS,
      setColumns: (columns) => set({ columns }),

      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // Search/filter
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      moveTicket: (ticketId, fromColumnId, toColumnId, newOrder) =>
        set((state) => {
          logger.debug('Moving ticket', { ticketId, fromColumnId, toColumnId, newOrder })
          const startTime = performance.now()

          const newColumns = state.columns.map((column) => {
            // Remove from source column
            if (column.id === fromColumnId) {
              return {
                ...column,
                tickets: column.tickets.filter((t) => t.id !== ticketId),
              }
            }

            // Add to target column
            if (column.id === toColumnId) {
              const ticket = state.columns
                .find((c) => c.id === fromColumnId)
                ?.tickets.find((t) => t.id === ticketId)

              if (!ticket) return column

              const updatedTicket = {
                ...ticket,
                columnId: toColumnId,
                order: newOrder,
              }

              const newTickets = [...column.tickets]
              newTickets.splice(newOrder, 0, updatedTicket)

              // Reorder remaining tickets
              return {
                ...column,
                tickets: newTickets.map((t, idx) => ({ ...t, order: idx })),
              }
            }

            return column
          })

          return { columns: newColumns }
        }),

      moveTickets: (ticketIds, toColumnId, newOrder) =>
        set((state) => {
          logger.debug('Moving multiple tickets', {
            ticketIds,
            toColumnId,
            newOrder,
            count: ticketIds.length,
          })
          const startTime = performance.now()

          // Collect all tickets being moved from ALL columns
          const ticketsToMove: TicketWithRelations[] = []
          for (const column of state.columns) {
            for (const ticket of column.tickets) {
              if (ticketIds.includes(ticket.id)) {
                ticketsToMove.push({ ...ticket, columnId: toColumnId })
              }
            }
          }

          if (ticketsToMove.length === 0) return state

          const newColumns = state.columns.map((column) => {
            // Remove selected tickets from any column they're in
            const remainingTickets = column.tickets.filter((t) => !ticketIds.includes(t.id))

            // Add to target column
            if (column.id === toColumnId) {
              const newTickets = [...remainingTickets]
              // Insert all moving tickets at the target position
              newTickets.splice(newOrder, 0, ...ticketsToMove)

              // Update order for all tickets
              return {
                ...column,
                tickets: newTickets.map((t, idx) => ({ ...t, order: idx })),
              }
            }

            // For other columns, just return with remaining tickets (selected ones removed)
            if (remainingTickets.length !== column.tickets.length) {
              return {
                ...column,
                tickets: remainingTickets.map((t, idx) => ({ ...t, order: idx })),
              }
            }

            return column
          })

          const duration = performance.now() - startTime
          logger.performance('moveTickets', duration, { count: ticketIds.length, toColumnId })
          return { columns: newColumns }
        }),

      reorderTicket: (columnId, ticketId, newIndex) =>
        set((state) => {
          logger.debug('Reordering ticket', { columnId, ticketId, newIndex })
          const newColumns = state.columns.map((column) => {
            if (column.id !== columnId) return column

            const tickets = [...column.tickets]
            const currentIndex = tickets.findIndex((t) => t.id === ticketId)
            if (currentIndex === -1 || currentIndex === newIndex) return column

            // Remove from current position and insert at new position
            const [ticket] = tickets.splice(currentIndex, 1)
            tickets.splice(newIndex, 0, ticket)

            // Update order for all tickets
            return {
              ...column,
              tickets: tickets.map((t, idx) => ({ ...t, order: idx })),
            }
          })

          return { columns: newColumns }
        }),

      reorderTickets: (columnId, ticketIds, targetIndex) =>
        set((state) => {
          logger.debug('Reordering multiple tickets', {
            columnId,
            ticketIds,
            targetIndex,
            count: ticketIds.length,
          })
          const newColumns = state.columns.map((column) => {
            if (column.id !== columnId) return column

            // Get all tickets not being moved
            const remainingTickets = column.tickets.filter((t) => !ticketIds.includes(t.id))

            // Get the tickets being moved, preserving their relative order
            const movingTickets = column.tickets.filter((t) => ticketIds.includes(t.id))

            if (movingTickets.length === 0) return column

            // Calculate the adjusted target index (accounting for removed items before target)
            const targetTicket = column.tickets[targetIndex]
            let adjustedIndex = targetTicket
              ? remainingTickets.findIndex((t) => t.id === targetTicket.id)
              : remainingTickets.length

            // If target was one of the moving tickets, insert at end
            if (adjustedIndex === -1) {
              adjustedIndex = remainingTickets.length
            }

            // Insert moving tickets at the target position
            const newTickets = [
              ...remainingTickets.slice(0, adjustedIndex),
              ...movingTickets,
              ...remainingTickets.slice(adjustedIndex),
            ]

            // Update order for all tickets
            return {
              ...column,
              tickets: newTickets.map((t, idx) => ({ ...t, order: idx })),
            }
          })

          return { columns: newColumns }
        }),

      updateTicket: (ticketId, updates) =>
        set((state) => {
          logger.debug('Updating ticket', { ticketId, updates })
          return {
            columns: state.columns.map((column) => ({
              ...column,
              tickets: column.tickets.map((ticket) =>
                ticket.id === ticketId ? { ...ticket, ...updates } : ticket,
              ),
            })),
          }
        }),

      addTicket: (columnId, ticket) =>
        set((state) => {
          logger.info('Adding ticket', { ticketId: ticket.id, columnId, title: ticket.title })
          return {
            columns: state.columns.map((column) =>
              column.id === columnId ? { ...column, tickets: [...column.tickets, ticket] } : column,
            ),
          }
        }),

      removeTicket: (ticketId) =>
        set((state) => {
          logger.info('Removing ticket', { ticketId })
          return {
            columns: state.columns.map((column) => ({
              ...column,
              tickets: column.tickets.filter((t) => t.id !== ticketId),
            })),
          }
        }),
    }),
    {
      name: 'punt-board-storage',
      // Don't persist searchQuery or hydration state
      partialize: (state) => ({ columns: state.columns }),
      // Revive Date objects when loading from storage and mark as hydrated
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger.debug('Rehydrating board store from localStorage')
          state.columns = reviveDates(state.columns) as ColumnWithTickets[]
          state.setHasHydrated(true)
          logger.info('Board store rehydrated', { columnCount: state.columns.length })
        }
      },
    },
  ),
)
