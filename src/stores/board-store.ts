import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logger } from '@/lib/logger'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

// Helper to create default columns for a project
function createDefaultColumns(projectId: string): ColumnWithTickets[] {
  return [
    { id: `${projectId}-col-1`, name: 'Backlog', order: 0, projectId, tickets: [] },
    { id: `${projectId}-col-2`, name: 'To Do', order: 1, projectId, tickets: [] },
    { id: `${projectId}-col-3`, name: 'In Progress', order: 2, projectId, tickets: [] },
    { id: `${projectId}-col-4`, name: 'In Review', order: 3, projectId, tickets: [] },
    { id: `${projectId}-col-5`, name: 'Done', order: 4, projectId, tickets: [] },
  ]
}

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
  // Store columns per project: Record<projectId, ColumnWithTickets[]>
  projects: Record<string, ColumnWithTickets[]>
  
  // Get columns for a specific project (with default fallback)
  getColumns: (projectId: string) => ColumnWithTickets[]
  setColumns: (projectId: string, columns: ColumnWithTickets[]) => void

  // Hydration state
  _hasHydrated: boolean
  setHasHydrated: (value: boolean) => void

  // Search/filter (per project)
  searchQueries: Record<string, string>
  getSearchQuery: (projectId: string) => string
  setSearchQuery: (projectId: string, query: string) => void

  // Get the next ticket number (max + 1) for a project
  getNextTicketNumber: (projectId: string) => number

  // Optimistic updates for drag and drop
  moveTicket: (projectId: string, ticketId: string, fromColumnId: string, toColumnId: string, newOrder: number) => void

  // Move multiple tickets to a column (from any source columns)
  moveTickets: (projectId: string, ticketIds: string[], toColumnId: string, newOrder: number) => void

  // Reorder ticket within the same column
  reorderTicket: (projectId: string, columnId: string, ticketId: string, newIndex: number) => void

  // Reorder multiple tickets within the same column (for multi-select drag)
  reorderTickets: (projectId: string, columnId: string, ticketIds: string[], targetIndex: number) => void

  // Update a single ticket
  updateTicket: (projectId: string, ticketId: string, updates: Partial<TicketWithRelations>) => void

  // Add a new ticket
  addTicket: (projectId: string, columnId: string, ticket: TicketWithRelations) => void

  // Remove a ticket
  removeTicket: (projectId: string, ticketId: string) => void
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      projects: {},
      
      getColumns: (projectId: string) => {
        const state = get()
        if (!state.projects[projectId]) {
          return createDefaultColumns(projectId)
        }
        return state.projects[projectId]
      },
      
      setColumns: (projectId: string, columns: ColumnWithTickets[]) => 
        set((state) => ({
          projects: { ...state.projects, [projectId]: columns },
        })),

      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // Search/filter (per project)
      searchQueries: {},
      getSearchQuery: (projectId: string) => {
        return get().searchQueries[projectId] || ''
      },
      setSearchQuery: (projectId: string, query: string) =>
        set((state) => ({
          searchQueries: { ...state.searchQueries, [projectId]: query },
        })),

      // Get the next ticket number for a project
      getNextTicketNumber: (projectId: string) => {
        const columns = get().getColumns(projectId)
        const allTickets = columns.flatMap((col) => col.tickets)
        if (allTickets.length === 0) return 1
        return Math.max(...allTickets.map((t) => t.number)) + 1
      },

      moveTicket: (projectId, ticketId, fromColumnId, toColumnId, newOrder) =>
        set((state) => {
          logger.debug('Moving ticket', { projectId, ticketId, fromColumnId, toColumnId, newOrder })
          const _startTime = performance.now()

          const columns = state.getColumns(projectId)
          const newColumns = columns.map((column) => {
            // Remove from source column
            if (column.id === fromColumnId) {
              return {
                ...column,
                tickets: column.tickets.filter((t) => t.id !== ticketId),
              }
            }

            // Add to target column
            if (column.id === toColumnId) {
              const ticket = columns
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

          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),

      moveTickets: (projectId, ticketIds, toColumnId, newOrder) =>
        set((state) => {
          logger.debug('Moving multiple tickets', {
            projectId,
            ticketIds,
            toColumnId,
            newOrder,
            count: ticketIds.length,
          })
          const startTime = performance.now()

          const columns = state.getColumns(projectId)
          
          // Collect all tickets being moved from ALL columns
          // Sort by: 1) column order (leftmost first), 2) ticket order within column
          const ticketsToMove: Array<{
            ticket: TicketWithRelations
            columnOrder: number
            ticketOrder: number
          }> = []
          for (const column of columns) {
            for (const ticket of column.tickets) {
              if (ticketIds.includes(ticket.id)) {
                const ticketIndex = column.tickets.findIndex((t) => t.id === ticket.id)
                ticketsToMove.push({
                  ticket: { ...ticket, columnId: toColumnId },
                  columnOrder: column.order,
                  ticketOrder: ticketIndex,
                })
              }
            }
          }

          // Sort by column order first (leftmost first), then by ticket order within column
          ticketsToMove.sort((a, b) => {
            if (a.columnOrder !== b.columnOrder) {
              return a.columnOrder - b.columnOrder
            }
            return a.ticketOrder - b.ticketOrder
          })

          // Extract just the tickets in the correct order
          const sortedTickets = ticketsToMove.map((item) => item.ticket)

          if (sortedTickets.length === 0) return state

          const newColumns = columns.map((column) => {
            // Remove selected tickets from any column they're in
            const remainingTickets = column.tickets.filter((t) => !ticketIds.includes(t.id))

            // Add to target column
            if (column.id === toColumnId) {
              const newTickets = [...remainingTickets]
              // Insert all moving tickets at the target position (in correct order)
              newTickets.splice(newOrder, 0, ...sortedTickets)

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
          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),

      reorderTicket: (projectId, columnId, ticketId, newIndex) =>
        set((state) => {
          logger.debug('Reordering ticket', { projectId, columnId, ticketId, newIndex })
          const columns = state.getColumns(projectId)
          const newColumns = columns.map((column) => {
            if (column.id !== columnId) return column

            const tickets = [...column.tickets]
            const currentIndex = tickets.findIndex((t) => t.id === ticketId)
            if (currentIndex === -1 || currentIndex === newIndex) return column

            // Remove from current position
            const [ticket] = tickets.splice(currentIndex, 1)

            // Insert at the target position
            // When moving down (currentIndex < newIndex), use newIndex directly
            // because we want to insert at the position that corresponds to newIndex in the original array
            // After removal, if newIndex >= tickets.length, splice will insert at the end
            // Example: [1,2,3] move 1 to position 2
            //   Remove 1: [2,3] (length 2)
            //   Insert at 2: splice(2,0,1) -> [2,3,1] ✓ (splice inserts at end if index >= length)
            // When moving up (currentIndex > newIndex), use newIndex directly
            // Example: [1,2,3] move 3 to position 0
            //   Remove 3: [1,2] (indices 0,1)
            //   Insert at 0: splice(0,0,3) -> [3,1,2] ✓
            tickets.splice(newIndex, 0, ticket)

            // Update order for all tickets
            return {
              ...column,
              tickets: tickets.map((t, idx) => ({ ...t, order: idx })),
            }
          })

          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),

      reorderTickets: (projectId, columnId, ticketIds, targetIndex) =>
        set((state) => {
          logger.debug('Reordering multiple tickets', {
            projectId,
            columnId,
            ticketIds,
            targetIndex,
            count: ticketIds.length,
          })
          const columns = state.getColumns(projectId)
          const newColumns = columns.map((column) => {
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

          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),

      updateTicket: (projectId, ticketId, updates) =>
        set((state) => {
          logger.debug('Updating ticket', { projectId, ticketId, updates })

          const columns = state.getColumns(projectId)

          // Check if this is a column change (status change)
          if (updates.columnId) {
            const currentColumn = columns.find((col) =>
              col.tickets.some((t) => t.id === ticketId),
            )

            if (currentColumn && currentColumn.id !== updates.columnId) {
              // This is a column change - move the ticket
              const targetColumn = columns.find((col) => col.id === updates.columnId)
              if (!targetColumn) {
                logger.warn('Target column not found for ticket move', {
                  projectId,
                  ticketId,
                  targetColumnId: updates.columnId,
                })
                return state
              }

              const ticket = currentColumn.tickets.find((t) => t.id === ticketId)
              if (!ticket) {
                logger.warn('Ticket not found in source column', {
                  projectId,
                  ticketId,
                  sourceColumnId: currentColumn.id,
                })
                return state
              }

              const updatedTicket = { ...ticket, ...updates }

              const newColumns = columns.map((column) => {
                if (column.id === currentColumn.id) {
                  // Remove from source column
                  return {
                    ...column,
                    tickets: column.tickets.filter((t) => t.id !== ticketId),
                  }
                } else if (column.id === updates.columnId) {
                  // Add to target column at the end
                  return {
                    ...column,
                    tickets: [...column.tickets, updatedTicket],
                  }
                }
                return column
              })

              return {
                projects: { ...state.projects, [projectId]: newColumns },
              }
            }
          }

          // Regular update (no column change)
          const newColumns = columns.map((column) => ({
            ...column,
            tickets: column.tickets.map((ticket) =>
              ticket.id === ticketId ? { ...ticket, ...updates } : ticket,
            ),
          }))

          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),

      addTicket: (projectId, columnId, ticket) =>
        set((state) => {
          logger.info('Adding ticket', { projectId, ticketId: ticket.id, columnId, title: ticket.title })
          const columns = state.getColumns(projectId)
          const newColumns = columns.map((column) =>
            column.id === columnId ? { ...column, tickets: [...column.tickets, ticket] } : column,
          )
          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),

      removeTicket: (projectId, ticketId) =>
        set((state) => {
          logger.info('Removing ticket', { projectId, ticketId })
          const columns = state.getColumns(projectId)
          const newColumns = columns.map((column) => ({
            ...column,
            tickets: column.tickets.filter((t) => t.id !== ticketId),
          }))
          return {
            projects: { ...state.projects, [projectId]: newColumns },
          }
        }),
    }),
    {
      name: 'punt-board-storage',
      // Don't persist searchQueries or hydration state
      partialize: (state) => ({ projects: state.projects }),
      // Revive Date objects when loading from storage and mark as hydrated
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger.debug('Rehydrating board store from localStorage')
          // Revive dates in all projects
          const revivedProjects: Record<string, ColumnWithTickets[]> = {}
          for (const [projectId, columns] of Object.entries(state.projects)) {
            revivedProjects[projectId] = reviveDates(columns) as ColumnWithTickets[]
          }
          state.projects = revivedProjects
          state.setHasHydrated(true)
          logger.info('Board store rehydrated', { projectCount: Object.keys(state.projects).length })
        }
      },
    },
  ),
)
