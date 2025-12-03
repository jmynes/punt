import { create } from 'zustand'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

interface BoardState {
	columns: ColumnWithTickets[]
	setColumns: (columns: ColumnWithTickets[]) => void

	// Optimistic updates for drag and drop
	moveTicket: (ticketId: string, fromColumnId: string, toColumnId: string, newOrder: number) => void

	// Update a single ticket
	updateTicket: (ticketId: string, updates: Partial<TicketWithRelations>) => void

	// Add a new ticket
	addTicket: (columnId: string, ticket: TicketWithRelations) => void

	// Remove a ticket
	removeTicket: (ticketId: string) => void
}

export const useBoardStore = create<BoardState>((set) => ({
	columns: [],
	setColumns: (columns) => set({ columns }),

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
