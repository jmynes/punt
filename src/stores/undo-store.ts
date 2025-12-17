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
  projectId: string // Store which project this action belongs to
}

interface UndoState {
  // Stack of undo entries
  undoStack: UndoEntry[]
  // Stack of redo entries
  redoStack: UndoEntry[]

  // Add a delete action to the undo stack
  pushDeleted: (
    projectId: string,
    ticket: TicketWithRelations,
    columnId: string,
    toastId: string | number,
    isRedo?: boolean,
  ) => void
  pushDeletedBatch: (
    projectId: string,
    tickets: DeletedTicket[],
    toastId: string | number,
    isRedo?: boolean,
  ) => void

  // Add a paste action to the undo stack
  pushPaste: (projectId: string, tickets: PastedTicket[], toastId: string | number, isRedo?: boolean) => void

  // Add a move action to the undo stack
  pushMove: (
    projectId: string,
    moves: MovedTicket[],
    fromColumnName: string,
    toColumnName: string,
    toastId: string | number,
    originalColumns?: ColumnWithTickets[], // Optional: store original column state for precise undo (before move)
    afterColumns?: ColumnWithTickets[], // Optional: store state after move for precise redo
    isRedo?: boolean,
  ) => void

  // Add an update action to the undo stack
  pushUpdate: (
    projectId: string,
    tickets: UpdatedTicket[],
    toastId: string | number,
    isRedo?: boolean,
  ) => void

  // Pop and return the most recent undo entry
  popUndo: () => UndoEntry | undefined

  // Push to redo stack (when undoing)
  pushRedo: (item: UndoEntry) => void

  // Pop from redo stack (for redo)
  popRedo: () => UndoEntry | undefined

  // Undo a specific entry by toastId (moves from undoStack to redoStack)
  undoByToastId: (toastId: string | number) => UndoEntry | undefined

  // Redo a specific entry by toastId (moves from redoStack to undoStack)
  redoByToastId: (toastId: string | number) => UndoEntry | undefined

  // Update the toastId of an entry in the redo stack (used when a toast is replaced)
  updateRedoToastId: (oldId: string | number, newId: string | number) => void

  // Update the toastId of an entry in the undo stack (used when a toast is replaced)
  updateUndoToastId: (oldId: string | number, newId: string | number) => void

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

  pushDeleted: (projectId, ticket, columnId, toastId, isRedo = false) => {
    console.debug(`[SessionLog] Action: Delete ${isRedo ? '(Redo)' : ''}`, {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'delete', tickets: [{ ticket, columnId }] },
          timestamp: Date.now(),
          toastId,
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushDeletedBatch: (projectId, tickets, toastId, isRedo = false) => {
    console.debug(`[SessionLog] Action: Batch Delete ${isRedo ? '(Redo)' : ''}`, {
      count: tickets.length,
      ticketIds: tickets.map((t) => t.ticket.id),
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'delete', tickets },
          timestamp: Date.now(),
          toastId,
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushPaste: (projectId, tickets, toastId, isRedo = false) => {
    console.debug(`[SessionLog] Action: Paste ${isRedo ? '(Redo)' : ''}`, {
      count: tickets.length,
      ticketIds: tickets.map((t) => t.ticket.id),
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'paste', tickets },
          timestamp: Date.now(),
          toastId,
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushMove: (
    projectId,
    moves,
    fromColumnName,
    toColumnName,
    toastId,
    originalColumns,
    afterColumns,
    isRedo = false,
  ) => {
    console.debug(`[SessionLog] Action: Move ${isRedo ? '(Redo)' : ''}`, {
      count: moves.length,
      from: fromColumnName,
      to: toColumnName,
      ticketIds: moves.map((m) => m.ticketId),
      projectId,
    })
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushUpdate: (projectId, tickets, toastId, isRedo = false) => {
    console.debug(`[SessionLog] Action: Update ${isRedo ? '(Redo)' : ''}`, {
      count: tickets.length,
      ticketIds: tickets.map((t) => t.ticketId),
      projectId,
    })
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  popUndo: () => {
    const state = get()
    if (state.undoStack.length === 0) return undefined

    const item = state.undoStack[state.undoStack.length - 1]
    console.debug('[SessionLog] Action: Undo (Pop)', {
      type: item.action.type,
      timestamp: item.timestamp,
    })
    set({ undoStack: state.undoStack.slice(0, -1) })
    return item
  },

  pushRedo: (item) => {
    console.debug('[SessionLog] Internal: Pushing to Redo Stack', {
      type: item.action.type,
    })
    set((state) => ({
      redoStack: [...state.redoStack, item],
    }))
  },

  popRedo: () => {
    const state = get()
    if (state.redoStack.length === 0) return undefined

    const item = state.redoStack[state.redoStack.length - 1]
    console.debug('[SessionLog] Action: Redo (Pop)', {
      type: item.action.type,
      timestamp: item.timestamp,
    })
    set({ redoStack: state.redoStack.slice(0, -1) })
    return item
  },

  undoByToastId: (toastId) => {
    const state = get()
    const entryIndex = state.undoStack.findIndex((e) => e.toastId === toastId)
    if (entryIndex === -1) return undefined

    const entry = state.undoStack[entryIndex]
    console.debug('[SessionLog] Action: Undo by Toast', {
      type: entry.action.type,
      toastId,
    })
    const newUndoStack = [...state.undoStack]
    newUndoStack.splice(entryIndex, 1)

    set({
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, entry],
    })
    return entry
  },

  redoByToastId: (toastId) => {
    const state = get()
    const entryIndex = state.redoStack.findIndex((e) => e.toastId === toastId)
    if (entryIndex === -1) return undefined

    const entry = state.redoStack[entryIndex]
    console.debug('[SessionLog] Action: Redo by Toast', {
      type: entry.action.type,
      toastId,
    })
    const newRedoStack = [...state.redoStack]
    newRedoStack.splice(entryIndex, 1)

    set({
      redoStack: newRedoStack,
      undoStack: [...state.undoStack, entry],
    })
    return entry
  },

  updateRedoToastId: (oldId, newId) =>
    set((state) => ({
      redoStack: state.redoStack.map((e) => (e.toastId === oldId ? { ...e, toastId: newId } : e)),
    })),

  updateUndoToastId: (oldId, newId) =>
    set((state) => ({
      undoStack: state.undoStack.map((e) => (e.toastId === oldId ? { ...e, toastId: newId } : e)),
    })),

  removeEntry: (toastId) =>
    set((state) => ({
      undoStack: state.undoStack.filter((d) => d.toastId !== toastId),
    })),

  clearRedo: () => set({ redoStack: [] }),

  // Legacy aliases
  popDeleted: () => get().popUndo(),
  removeDeleted: (toastId) => get().removeEntry(toastId),
}))

// Log undo/redo stack changes to the console for debugging
useUndoStore.subscribe((state, prevState) => {
  if (state.undoStack !== prevState.undoStack || state.redoStack !== prevState.redoStack) {
    console.debug('[UndoStore] Stack changed', {
      undo: state.undoStack,
      redo: state.redoStack,
    })
  }
})

// Expose the store to the window for debugging
if (typeof window !== 'undefined') {
  ;(window as Window & { undoStore?: typeof useUndoStore }).undoStore = useUndoStore
}
