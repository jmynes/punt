import { create } from 'zustand'
import type { TicketWithRelations } from '@/types'

interface DeletedTicket {
	ticket: TicketWithRelations
	columnId: string
	deletedAt: number
	toastId: string | number
}

interface UndoState {
	// Stack of deleted tickets that can be undone
	deletedTickets: DeletedTicket[]
	// Stack of undone deletions that can be redone
	redoStack: DeletedTicket[]

	// Add a deleted ticket to the undo stack
	pushDeleted: (ticket: TicketWithRelations, columnId: string, toastId: string | number) => void

	// Pop and return the most recent deleted ticket (for undo)
	popDeleted: () => DeletedTicket | undefined

	// Push to redo stack (when undoing)
	pushRedo: (item: DeletedTicket) => void

	// Pop from redo stack (for redo)
	popRedo: () => DeletedTicket | undefined

	// Remove a specific deleted ticket (when timeout expires)
	removeDeleted: (toastId: string | number) => void

	// Clear redo stack (when a new action is performed)
	clearRedo: () => void
}

export const useUndoStore = create<UndoState>((set, get) => ({
	deletedTickets: [],
	redoStack: [],

	pushDeleted: (ticket, columnId, toastId) =>
		set((state) => ({
			deletedTickets: [...state.deletedTickets, { ticket, columnId, deletedAt: Date.now(), toastId }],
			redoStack: [], // Clear redo stack when new action is performed
		})),

	popDeleted: () => {
		const state = get()
		if (state.deletedTickets.length === 0) return undefined

		const item = state.deletedTickets[state.deletedTickets.length - 1]
		set({ deletedTickets: state.deletedTickets.slice(0, -1) })
		return item
	},

	pushRedo: (item) =>
		set((state) => ({
			redoStack: [...state.redoStack, item],
		})),

	popRedo: () => {
		const state = get()
		if (state.redoStack.length === 0) return undefined

		const item = state.redoStack[state.redoStack.length - 1]
		set({ redoStack: state.redoStack.slice(0, -1) })
		return item
	},

	removeDeleted: (toastId) =>
		set((state) => ({
			deletedTickets: state.deletedTickets.filter((d) => d.toastId !== toastId),
		})),

	clearRedo: () => set({ redoStack: [] }),
}))

