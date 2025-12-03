import { create } from 'zustand'
import type { TicketWithRelations } from '@/types'

interface DeletedTicket {
	ticket: TicketWithRelations
	columnId: string
}

// An undo entry can be a single ticket or a batch
interface UndoEntry {
	tickets: DeletedTicket[]
	deletedAt: number
	toastId: string | number
}

interface UndoState {
	// Stack of undo entries (each can contain multiple tickets)
	undoStack: UndoEntry[]
	// Stack of redo entries
	redoStack: UndoEntry[]

	// Add a single deleted ticket to the undo stack
	pushDeleted: (ticket: TicketWithRelations, columnId: string, toastId: string | number) => void

	// Add multiple deleted tickets as a single undo entry
	pushDeletedBatch: (tickets: DeletedTicket[], toastId: string | number) => void

	// Pop and return the most recent undo entry
	popDeleted: () => UndoEntry | undefined

	// Push to redo stack (when undoing)
	pushRedo: (item: UndoEntry) => void

	// Pop from redo stack (for redo)
	popRedo: () => UndoEntry | undefined

	// Remove a specific undo entry by toastId
	removeDeleted: (toastId: string | number) => void

	// Clear redo stack (when a new action is performed)
	clearRedo: () => void
}

export const useUndoStore = create<UndoState>((set, get) => ({
	undoStack: [],
	redoStack: [],

	pushDeleted: (ticket, columnId, toastId) =>
		set((state) => ({
			undoStack: [...state.undoStack, { tickets: [{ ticket, columnId }], deletedAt: Date.now(), toastId }],
			redoStack: [], // Clear redo stack when new action is performed
		})),

	pushDeletedBatch: (tickets, toastId) =>
		set((state) => ({
			undoStack: [...state.undoStack, { tickets, deletedAt: Date.now(), toastId }],
			redoStack: [], // Clear redo stack when new action is performed
		})),

	popDeleted: () => {
		const state = get()
		if (state.undoStack.length === 0) return undefined

		const item = state.undoStack[state.undoStack.length - 1]
		set({ undoStack: state.undoStack.slice(0, -1) })
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
			undoStack: state.undoStack.filter((d) => d.toastId !== toastId),
		})),

	clearRedo: () => set({ redoStack: [] }),
}))

