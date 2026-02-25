import { create } from 'zustand'
import type { TicketRestoreData } from '@/lib/actions/types'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

interface DeletedTicket {
  ticket: TicketWithRelations
  columnId: string
  restoreData?: TicketRestoreData
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

interface SprintMovedTicket {
  ticketId: string
  fromSprintId: string | null
  toSprintId: string | null
}

interface AttachmentInfo {
  id: string
  filename: string
  originalName: string
  mimetype: string
  size: number
  url: string
}

interface AttachmentAction {
  projectId: string
  ticketId: string
  ticketKey: string
  attachment: AttachmentInfo
}

/** Metadata for tracking activity entries for undo/redo cleanup */
export interface ActivityMeta {
  /** Activity entry IDs created by the action */
  activityIds?: string[]
  /** Group ID for batch activity entries */
  groupId?: string
  /** Ticket ID for deletion endpoint */
  ticketId?: string
}

// Different types of undoable actions
// Note: projectCreate and projectDelete are not supported since projects are now server-backed
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
  | { type: 'ticketCreate'; ticket: TicketWithRelations; columnId: string }
  | {
      type: 'sprintMove'
      moves: SprintMovedTicket[]
      fromSprintName: string
      toSprintName: string
    }
  | {
      type: 'columnRename'
      columnId: string
      oldName: string
      newName: string
      oldIcon: string | null
      newIcon: string | null
      oldColor: string | null
      newColor: string | null
    }
  | {
      type: 'columnDelete'
      column: ColumnWithTickets
      movedToColumnId: string
    }
  | {
      type: 'columnCreate'
      columnId: string
      columnName: string
    }
  | {
      type: 'attachmentAdd'
      attachments: AttachmentAction[]
    }
  | {
      type: 'attachmentDelete'
      attachments: AttachmentAction[]
    }

interface UndoEntry {
  action: UndoAction
  timestamp: number
  projectId: string // Store which project this action belongs to
  /** Activity entry metadata for undo/redo cleanup */
  activityMeta?: ActivityMeta
}

interface UndoState {
  // Stack of undo entries
  undoStack: UndoEntry[]
  // Stack of redo entries
  redoStack: UndoEntry[]
  // Whether an async undo/redo operation (e.g. API call) is in flight
  isProcessing: boolean
  setProcessing: (v: boolean) => void
  // Atomically check and set isProcessing - returns true if acquired, false if already processing
  tryStartProcessing: () => boolean

  // Add a delete action to the undo stack
  pushDeleted: (
    projectId: string,
    ticket: TicketWithRelations,
    columnId: string,
    isRedo?: boolean,
  ) => void
  pushDeletedBatch: (projectId: string, tickets: DeletedTicket[], isRedo?: boolean) => void

  // Add a paste action to the undo stack
  pushPaste: (projectId: string, tickets: PastedTicket[], isRedo?: boolean) => void

  // Update a ticket ID in a paste entry (called when temp ticket is replaced with server ticket)
  updatePastedTicketId: (
    projectId: string,
    tempId: string,
    serverTicket: TicketWithRelations,
  ) => void

  // Add a move action to the undo stack
  pushMove: (
    projectId: string,
    moves: MovedTicket[],
    fromColumnName: string,
    toColumnName: string,
    originalColumns?: ColumnWithTickets[], // Optional: store original column state for precise undo (before move)
    afterColumns?: ColumnWithTickets[], // Optional: store state after move for precise redo
    isRedo?: boolean,
  ) => void

  // Add an update action to the undo stack
  pushUpdate: (projectId: string, tickets: UpdatedTicket[], isRedo?: boolean) => void

  // Add a sprint move action to the undo stack
  pushSprintMove: (
    projectId: string,
    moves: SprintMovedTicket[],
    fromSprintName: string,
    toSprintName: string,
    isRedo?: boolean,
  ) => void

  // Add a ticket create action to the undo stack
  pushTicketCreate: (
    projectId: string,
    ticket: TicketWithRelations,
    columnId: string,
    isRedo?: boolean,
  ) => void

  // Add a column rename action to the undo stack
  pushColumnRename: (
    projectId: string,
    columnId: string,
    oldName: string,
    newName: string,
    oldIcon: string | null,
    newIcon: string | null,
    oldColor: string | null,
    newColor: string | null,
    isRedo?: boolean,
  ) => void

  // Add a column delete action to the undo stack
  pushColumnDelete: (
    projectId: string,
    column: ColumnWithTickets,
    movedToColumnId: string,
    isRedo?: boolean,
  ) => void

  // Add a column create action to the undo stack
  pushColumnCreate: (
    projectId: string,
    columnId: string,
    columnName: string,
    isRedo?: boolean,
  ) => void

  // Add an attachment add action to the undo stack
  pushAttachmentAdd: (projectId: string, attachments: AttachmentAction[], isRedo?: boolean) => void

  // Add an attachment delete action to the undo stack
  pushAttachmentDelete: (
    projectId: string,
    attachments: AttachmentAction[],
    isRedo?: boolean,
  ) => void

  // Pop and return the most recent undo entry
  popUndo: () => UndoEntry | undefined

  // Push to redo stack (when undoing)
  pushRedo: (item: UndoEntry) => void

  // Pop from redo stack (for redo)
  popRedo: () => UndoEntry | undefined

  // Update the ticket in a ticketCreate entry (used after redo re-creates with new server ID)
  updateTicketCreateEntry: (oldTicketId: string, newTicket: TicketWithRelations) => void

  // Clear redo stack (when a new action is performed)
  clearRedo: () => void

  // Check if undo/redo is available
  canUndo: () => boolean
  canRedo: () => boolean
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  isProcessing: false,
  setProcessing: (v) => set({ isProcessing: v }),
  tryStartProcessing: () => {
    const state = get()
    if (state.isProcessing) return false
    set({ isProcessing: true })
    return true
  },

  pushDeleted: (projectId, ticket, columnId, isRedo = false) => {
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushDeletedBatch: (projectId, tickets, isRedo = false) => {
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushPaste: (projectId, tickets, isRedo = false) => {
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  updatePastedTicketId: (projectId, tempId, serverTicket) => {
    console.debug('[SessionLog] Internal: Updating pasted ticket ID', {
      projectId,
      tempId,
      serverId: serverTicket.id,
    })
    set((state) => ({
      undoStack: state.undoStack.map((entry) => {
        if (entry.projectId !== projectId || entry.action.type !== 'paste') {
          return entry
        }
        const pasteAction = entry.action
        const updatedTickets = pasteAction.tickets.map((pt) =>
          pt.ticket.id === tempId ? { ...pt, ticket: serverTicket } : pt,
        )
        // Only update if a ticket was actually changed
        if (updatedTickets.some((t, i) => t !== pasteAction.tickets[i])) {
          return { ...entry, action: { ...pasteAction, tickets: updatedTickets } }
        }
        return entry
      }),
      redoStack: state.redoStack.map((entry) => {
        if (entry.projectId !== projectId || entry.action.type !== 'paste') {
          return entry
        }
        const pasteAction = entry.action
        const updatedTickets = pasteAction.tickets.map((pt) =>
          pt.ticket.id === tempId ? { ...pt, ticket: serverTicket } : pt,
        )
        if (updatedTickets.some((t, i) => t !== pasteAction.tickets[i])) {
          return { ...entry, action: { ...pasteAction, tickets: updatedTickets } }
        }
        return entry
      }),
    }))
  },

  pushMove: (
    projectId,
    moves,
    fromColumnName,
    toColumnName,
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushUpdate: (projectId, tickets, isRedo = false) => {
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
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushSprintMove: (projectId, moves, fromSprintName, toSprintName, isRedo = false) => {
    console.debug(`[SessionLog] Action: Sprint Move ${isRedo ? '(Redo)' : ''}`, {
      count: moves.length,
      from: fromSprintName,
      to: toSprintName,
      ticketIds: moves.map((m) => m.ticketId),
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'sprintMove',
            moves: moves.map((m) => ({ ...m })),
            fromSprintName,
            toSprintName,
          },
          timestamp: Date.now(),
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushTicketCreate: (projectId, ticket, columnId, isRedo = false) => {
    console.debug(`[SessionLog] Action: Ticket Create ${isRedo ? '(Redo)' : ''}`, {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: { type: 'ticketCreate', ticket: { ...ticket }, columnId },
          timestamp: Date.now(),
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushColumnRename: (
    projectId,
    columnId,
    oldName,
    newName,
    oldIcon,
    newIcon,
    oldColor,
    newColor,
    isRedo = false,
  ) => {
    console.debug(`[SessionLog] Action: Column Rename ${isRedo ? '(Redo)' : ''}`, {
      columnId,
      oldName,
      newName,
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'columnRename',
            columnId,
            oldName,
            newName,
            oldIcon,
            newIcon,
            oldColor,
            newColor,
          },
          timestamp: Date.now(),
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushColumnDelete: (projectId, column, movedToColumnId, isRedo = false) => {
    console.debug(`[SessionLog] Action: Column Delete ${isRedo ? '(Redo)' : ''}`, {
      columnId: column.id,
      columnName: column.name,
      ticketCount: column.tickets.length,
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'columnDelete',
            column: {
              ...column,
              tickets: column.tickets.map((t) => ({ ...t })),
            },
            movedToColumnId,
          },
          timestamp: Date.now(),
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushColumnCreate: (projectId, columnId, columnName, isRedo = false) => {
    console.debug(`[SessionLog] Action: Column Create ${isRedo ? '(Redo)' : ''}`, {
      columnId,
      columnName,
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'columnCreate',
            columnId,
            columnName,
          },
          timestamp: Date.now(),
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushAttachmentAdd: (projectId, attachments, isRedo = false) => {
    console.debug(`[SessionLog] Action: Attachment Add ${isRedo ? '(Redo)' : ''}`, {
      count: attachments.length,
      attachmentIds: attachments.map((a) => a.attachment.id),
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'attachmentAdd',
            attachments: attachments.map((a) => ({ ...a, attachment: { ...a.attachment } })),
          },
          timestamp: Date.now(),
          projectId,
        },
      ],
      redoStack: isRedo ? state.redoStack : [],
    }))
  },

  pushAttachmentDelete: (projectId, attachments, isRedo = false) => {
    console.debug(`[SessionLog] Action: Attachment Delete ${isRedo ? '(Redo)' : ''}`, {
      count: attachments.length,
      attachmentIds: attachments.map((a) => a.attachment.id),
      projectId,
    })
    set((state) => ({
      undoStack: [
        ...state.undoStack,
        {
          action: {
            type: 'attachmentDelete',
            attachments: attachments.map((a) => ({ ...a, attachment: { ...a.attachment } })),
          },
          timestamp: Date.now(),
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

  updateTicketCreateEntry: (oldTicketId, newTicket) =>
    set((state) => {
      const updateStack = (stack: UndoEntry[]) =>
        stack.map((e) => {
          if (e.action.type === 'ticketCreate' && e.action.ticket.id === oldTicketId) {
            return { ...e, action: { ...e.action, ticket: { ...newTicket } } }
          }
          return e
        })
      return {
        undoStack: updateStack(state.undoStack),
        redoStack: updateStack(state.redoStack),
      }
    }),

  clearRedo: () => set({ redoStack: [] }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}))

// Expose the store to the window for debugging
if (typeof window !== 'undefined') {
  ;(window as Window & { undoStore?: typeof useUndoStore }).undoStore = useUndoStore
}
