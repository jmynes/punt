import { beforeEach, describe, expect, it } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { useUndoStore } from '../undo-store'

describe('Undo Store', () => {
  beforeEach(() => {
    useUndoStore.setState({
      undoStack: [],
      redoStack: [],
    })
  })

  describe('pushDeleted', () => {
    it('should add a delete entry to undo stack', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(ticket, 'col-1', 'toast-1')

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry).toBeDefined()
      expect(entry?.action.type).toBe('delete')
      expect(entry?.action.tickets).toHaveLength(1)
      expect(entry?.action.tickets[0].ticket.id).toBe('ticket-1')
      expect(entry?.toastId).toBe('toast-1')
    })

    it('should clear redo stack when pushing new action', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1' })
      const ticket2 = createMockTicket({ id: 'ticket-2' })
      useUndoStore.getState().pushDeleted(ticket1, 'col-1', 'toast-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) {
        useUndoStore.getState().pushRedo(entry)
      }
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().pushDeleted(ticket2, 'col-1', 'toast-2')
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })
  })

  describe('pushDeletedBatch', () => {
    it('should add multiple deleted tickets to undo stack', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1' })
      const ticket2 = createMockTicket({ id: 'ticket-2' })
      useUndoStore.getState().pushDeletedBatch(
        [
          { ticket: ticket1, columnId: 'col-1' },
          { ticket: ticket2, columnId: 'col-2' },
        ],
        'toast-1',
      )

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('delete')
      expect(entry?.action.tickets).toHaveLength(2)
    })
  })

  describe('pushMove', () => {
    it('should add a move entry to undo stack', () => {
      useUndoStore
        .getState()
        .pushMove(
          [{ ticketId: 'ticket-1', fromColumnId: 'col-1', toColumnId: 'col-2' }],
          'To Do',
          'Done',
          'toast-1',
        )

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry).toBeDefined()
      expect(entry?.action.type).toBe('move')
      if (entry?.action.type === 'move') {
        expect(entry.action.moves).toHaveLength(1)
        expect(entry.action.fromColumnName).toBe('To Do')
        expect(entry.action.toColumnName).toBe('Done')
      }
    })
  })

  describe('popUndo', () => {
    it('should return and remove the last undo entry', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(ticket, 'col-1', 'toast-1')
      expect(useUndoStore.getState().undoStack).toHaveLength(1)

      const entry = useUndoStore.getState().popUndo()
      expect(entry).toBeDefined()
      expect(entry?.toastId).toBe('toast-1')
      expect(useUndoStore.getState().undoStack).toHaveLength(0)
    })

    it('should return undefined if stack is empty', () => {
      const entry = useUndoStore.getState().popUndo()
      expect(entry).toBeUndefined()
    })
  })

  describe('pushRedo and popRedo', () => {
    it('should push and pop redo entries', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(ticket, 'col-1', 'toast-1')
      const entry = useUndoStore.getState().popUndo()
      expect(entry).toBeDefined()

      if (entry) {
        useUndoStore.getState().pushRedo(entry)
        expect(useUndoStore.getState().redoStack).toHaveLength(1)

        const redoEntry = useUndoStore.getState().popRedo()
        expect(redoEntry).toEqual(entry)
        expect(useUndoStore.getState().redoStack).toHaveLength(0)
      }
    })
  })

  describe('removeEntry', () => {
    it('should remove entry by toastId', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1' })
      const ticket2 = createMockTicket({ id: 'ticket-2' })
      useUndoStore.getState().pushDeleted(ticket1, 'col-1', 'toast-1')
      useUndoStore.getState().pushDeleted(ticket2, 'col-1', 'toast-2')
      expect(useUndoStore.getState().undoStack).toHaveLength(2)

      useUndoStore.getState().removeEntry('toast-1')
      expect(useUndoStore.getState().undoStack).toHaveLength(1)
      expect(useUndoStore.getState().undoStack[0]?.toastId).toBe('toast-2')
    })
  })

  describe('clearRedo', () => {
    it('should clear redo stack', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(ticket, 'col-1', 'toast-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) {
        useUndoStore.getState().pushRedo(entry)
      }
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().clearRedo()
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })
  })

  describe('legacy aliases', () => {
    it('should support popDeleted alias', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(ticket, 'col-1', 'toast-1')
      const entry = useUndoStore.getState().popDeleted()
      expect(entry).toBeDefined()
    })

    it('should support removeDeleted alias', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(ticket, 'col-1', 'toast-1')
      useUndoStore.getState().removeDeleted('toast-1')
      expect(useUndoStore.getState().undoStack).toHaveLength(0)
    })
  })
})
