import { create } from 'zustand'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

interface DeletedTicket {
  ticket: TicketWithRelations
  columnId: string
}

interface MovedTicket {
  ticketId: string
  fromColumnId: string
  toColumnId: string
}

interface PastedTicket {
  ticket: TicketWithRelations
  columnId: string
}

interface UpdatedTicket {
  ticketId: string
  before: TicketWithRelations
  after: TicketWithRelations
}

// Different types of undoable actions
type UndoAction =
  | { type: 'delete'; tickets: DeletedTicket[] }
  | {
      type: 'move'
      moves: MovedTicket[]
      fromColumnName: string
      toColumnName: string
      originalColumns?: ColumnWithTickets[] // Store original column state for precise undo (before move)
      afterColumns?: ColumnWithTickets[] // Store state after move for precise redo
    }
  | { type: 'paste'; tickets: PastedTicket[] }
  | { type: 'update'; tickets: UpdatedTicket[] }

interface UndoEntry {
  action: UndoAction
  timestamp: number
  toastId: string | number
}

interface UndoState {
  // Stack of undo entries
  undoStack: UndoEntry[]
  // Stack of redo entries
  redoStack: UndoEntry[]

  // Add a delete action to the undo stack
  pushDeleted: (ticket: TicketWithRelations, columnId: string, toastId: string | number) => void
  pushDeletedBatch: (tickets: DeletedTicket[], toastId: string | number) => void

  // Add a paste action to the undo stack
  pushPaste: (tickets: PastedTicket[], toastId: string | number) => void

  // Add a move action to the undo stack
  pushMove: (
    moves: MovedTicket[],
    fromColumnName: string,
    toColumnName: string,
    toastId: string | number,
    originalColumns?: ColumnWithTickets[], // Optional: store original column state for precise undo (before move)
    afterColumns?: ColumnWithTickets[], // Optional: store state after move for precise redo
  ) => void

  // Add an update action to the undo stack
  pushUpdate: (tickets: UpdatedTicket[], toastId: string | number) => void

  // Pop and return the most recent undo entry
  popUndo: () => UndoEntry | undefined

  // Push to redo stack (when undoing)
  pushRedo: (item: UndoEntry) => void

  // Pop from redo stack (for redo)
  popRedo: () => UndoEntry | undefined

  // Remove a specific undo entry by toastId
  removeEntry: (toastId: string | number) => void

  // Clear redo stack (when a new action is performed)
  clearRedo: () => void

  // Legacy aliases for backwards compatibility
  popDeleted: () => UndoEntry | undefined
  removeDeleted: (toastId: string | number) => void
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushDeleted: (ticket, columnId, toastId) =>
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'delete', tickets: [{ ticket, columnId }] },
          timestamp: Date.now(),
          toastId,
        },
      ],
      redoStack: [],
    })),

  pushDeletedBatch: (tickets, toastId) =>
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'delete', tickets },
          timestamp: Date.now(),
          toastId,
        },
      ],
      redoStack: [],
    })),

  pushPaste: (tickets, toastId) =>
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'paste', tickets },
          timestamp: Date.now(),
          toastId,
        },
      ],
      redoStack: [],
    })),

  pushMove: (moves, fromColumnName, toColumnName, toastId, originalColumns, afterColumns) =>
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'move',
            moves,
            fromColumnName,
            toColumnName,
            originalColumns: originalColumns
              ? originalColumns.map((col) => ({
                  ...col,
                  tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
                }))
              : undefined,
            afterColumns: afterColumns
              ? afterColumns.map((col) => ({
                  ...col,
                  tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
                }))
              : undefined,
          },
          timestamp: Date.now(),
          toastId,
        },
      ],
      redoStack: [],
    })),

  pushUpdate: (tickets, toastId) =>
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'update',
            tickets: tickets.map((t) => ({
              ticketId: t.ticketId,
              before: { ...t.before },
              after: { ...t.after },
            })),
          },
          timestamp: Date.now(),
          toastId,
        },
      ],
      redoStack: [],
    })),

  popUndo: () => {
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

  removeEntry: (toastId) =>
    set((state) => ({
      undoStack: state.undoStack.filter((d) => d.toastId !== toastId),
    })),

  clearRedo: () => set({ redoStack: [] }),

  // Legacy aliases
  popDeleted: () => get().popUndo(),
  removeDeleted: (toastId) => get().removeEntry(toastId),
}))
