import { create } from 'zustand'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

// Default columns for a new project
const DEFAULT_COLUMNS: ColumnWithTickets[] = [
	{ id: 'col-1', name: 'Backlog', order: 0, projectId: 'project-1', tickets: [] },
	{ id: 'col-2', name: 'To Do', order: 1, projectId: 'project-1', tickets: [] },
	{ id: 'col-3', name: 'In Progress', order: 2, projectId: 'project-1', tickets: [] },
	{ id: 'col-4', name: 'In Review', order: 3, projectId: 'project-1', tickets: [] },
	{ id: 'col-5', name: 'Done', order: 4, projectId: 'project-1', tickets: [] },
]

interface BoardState {
	columns: ColumnWithTickets[]
	setColumns: (columns: ColumnWithTickets[]) => void

	// Search/filter
	searchQuery: string
	setSearchQuery: (query: string) => void

	// Optimistic updates for drag and drop
	moveTicket: (ticketId: string, fromColumnId: string, toColumnId: string, newOrder: number) => void

	// Move multiple tickets between columns (for multi-select drag)
	moveTickets: (ticketIds: string[], fromColumnId: string, toColumnId: string, newOrder: number) => void

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

export const useBoardStore = create<BoardState>((set) => ({
	columns: DEFAULT_COLUMNS,
	setColumns: (columns) => set({ columns }),

	// Search/filter
	searchQuery: '',
	setSearchQuery: (query) => set({ searchQuery: query }),

	moveTicket: (ticketId, fromColumnId, toColumnId, newOrder) =>
		set((state) => {
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

	moveTickets: (ticketIds, fromColumnId, toColumnId, newOrder) =>
		set((state) => {
			// Get the tickets being moved from the source column
			const sourceColumn = state.columns.find((c) => c.id === fromColumnId)
			if (!sourceColumn) return state

			const ticketsToMove = sourceColumn.tickets
				.filter((t) => ticketIds.includes(t.id))
				.map((t) => ({ ...t, columnId: toColumnId }))

			if (ticketsToMove.length === 0) return state

			const newColumns = state.columns.map((column) => {
				// Remove from source column
				if (column.id === fromColumnId) {
					return {
						...column,
						tickets: column.tickets
							.filter((t) => !ticketIds.includes(t.id))
							.map((t, idx) => ({ ...t, order: idx })),
					}
				}

				// Add to target column
				if (column.id === toColumnId) {
					const newTickets = [...column.tickets]
					// Insert all moving tickets at the target position
					newTickets.splice(newOrder, 0, ...ticketsToMove)

					// Update order for all tickets
					return {
						...column,
						tickets: newTickets.map((t, idx) => ({ ...t, order: idx })),
					}
				}

				return column
			})

			return { columns: newColumns }
		}),

	reorderTicket: (columnId, ticketId, newIndex) =>
		set((state) => {
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
		set((state) => ({
			columns: state.columns.map((column) => ({
				...column,
				tickets: column.tickets.map((ticket) =>
					ticket.id === ticketId ? { ...ticket, ...updates } : ticket,
				),
			})),
		})),

	addTicket: (columnId, ticket) =>
		set((state) => ({
			columns: state.columns.map((column) =>
				column.id === columnId ? { ...column, tickets: [...column.tickets, ticket] } : column,
			),
		})),

	removeTicket: (ticketId) =>
		set((state) => ({
			columns: state.columns.map((column) => ({
				...column,
				tickets: column.tickets.filter((t) => t.id !== ticketId),
			})),
		})),
}))
