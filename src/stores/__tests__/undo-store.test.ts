import { beforeEach, describe, expect, it } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { useUndoStore } from '../undo-store'

const PROJECT_ID = 'test-project-1'

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
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry).toBeDefined()
      expect(entry?.action.type).toBe('delete')
      if (entry?.action.type === 'delete') {
        expect(entry.action.tickets).toHaveLength(1)
        expect(entry.action.tickets[0].ticket.id).toBe('ticket-1')
      }
      expect(entry?.projectId).toBe(PROJECT_ID)
    })

    it('should clear redo stack when pushing new action', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1' })
      const ticket2 = createMockTicket({ id: 'ticket-2' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket1, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) {
        useUndoStore.getState().pushRedo(entry)
      }
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket2, 'col-1')
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })
  })

  describe('pushDeletedBatch', () => {
    it('should add multiple deleted tickets to undo stack', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1' })
      const ticket2 = createMockTicket({ id: 'ticket-2' })
      useUndoStore.getState().pushDeletedBatch(PROJECT_ID, [
        { ticket: ticket1, columnId: 'col-1' },
        { ticket: ticket2, columnId: 'col-2' },
      ])

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('delete')
      if (entry?.action.type === 'delete') {
        expect(entry.action.tickets).toHaveLength(2)
      }
    })
  })

  describe('pushMove', () => {
    it('should add a move entry to undo stack', () => {
      useUndoStore
        .getState()
        .pushMove(
          PROJECT_ID,
          [{ ticketId: 'ticket-1', fromColumnId: 'col-1', toColumnId: 'col-2' }],
          'To Do',
          'Done',
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
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      expect(useUndoStore.getState().undoStack).toHaveLength(1)

      const entry = useUndoStore.getState().popUndo()
      expect(entry).toBeDefined()
      expect(entry?.action.type).toBe('delete')
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
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
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

  describe('clearRedo', () => {
    it('should clear redo stack', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) {
        useUndoStore.getState().pushRedo(entry)
      }
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().clearRedo()
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })
  })

  describe('pushPaste', () => {
    it('should add paste action to undo stack', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushPaste(PROJECT_ID, [{ ticket, columnId: 'col-1' }])

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('paste')
      if (entry?.action.type === 'paste') {
        expect(entry.action.tickets).toHaveLength(1)
        expect(entry.action.tickets[0].ticket.id).toBe('ticket-1')
      }
    })

    it('should clear redo stack when not a redo operation', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      // First add something to redo stack
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      // Now push paste, should clear redo
      useUndoStore.getState().pushPaste(PROJECT_ID, [{ ticket, columnId: 'col-1' }])
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })

    it('should preserve redo stack when isRedo is true', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      // First add something to redo stack
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)

      // Push paste with isRedo=true
      useUndoStore.getState().pushPaste(PROJECT_ID, [{ ticket, columnId: 'col-1' }], true)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)
    })
  })

  describe('updatePastedTicketId', () => {
    it('should update ticket id in paste entry on undo stack', () => {
      const tempTicket = createMockTicket({ id: 'temp-1', title: 'Test' })
      useUndoStore.getState().pushPaste(PROJECT_ID, [{ ticket: tempTicket, columnId: 'col-1' }])

      const serverTicket = createMockTicket({ id: 'server-1', title: 'Test' })
      useUndoStore.getState().updatePastedTicketId(PROJECT_ID, 'temp-1', serverTicket)

      const entry = useUndoStore.getState().undoStack[0]
      if (entry?.action.type === 'paste') {
        expect(entry.action.tickets[0].ticket.id).toBe('server-1')
      }
    })

    it('should not update entries from other projects', () => {
      const ticket = createMockTicket({ id: 'temp-1' })
      useUndoStore.getState().pushPaste('other-project', [{ ticket, columnId: 'col-1' }])

      const serverTicket = createMockTicket({ id: 'server-1' })
      useUndoStore.getState().updatePastedTicketId(PROJECT_ID, 'temp-1', serverTicket)

      const entry = useUndoStore.getState().undoStack[0]
      if (entry?.action.type === 'paste') {
        expect(entry.action.tickets[0].ticket.id).toBe('temp-1')
      }
    })
  })

  describe('pushUpdate', () => {
    it('should add update action to undo stack', () => {
      const before = createMockTicket({ id: 'ticket-1', title: 'Before' })
      const after = createMockTicket({ id: 'ticket-1', title: 'After' })
      useUndoStore.getState().pushUpdate(PROJECT_ID, [{ ticketId: 'ticket-1', before, after }])

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('update')
      if (entry?.action.type === 'update') {
        expect(entry.action.tickets[0].before.title).toBe('Before')
        expect(entry.action.tickets[0].after.title).toBe('After')
      }
    })
  })

  describe('pushSprintMove', () => {
    it('should add sprint move action to undo stack', () => {
      useUndoStore
        .getState()
        .pushSprintMove(
          PROJECT_ID,
          [{ ticketId: 'ticket-1', fromSprintId: 'sprint-1', toSprintId: 'sprint-2' }],
          'Sprint 1',
          'Sprint 2',
        )

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('sprintMove')
      if (entry?.action.type === 'sprintMove') {
        expect(entry.action.moves).toHaveLength(1)
        expect(entry.action.fromSprintName).toBe('Sprint 1')
        expect(entry.action.toSprintName).toBe('Sprint 2')
      }
    })
  })

  describe('pushTicketCreate', () => {
    it('should add ticket create action to undo stack', () => {
      const ticket = createMockTicket({ id: 'ticket-1', title: 'New Ticket' })
      useUndoStore.getState().pushTicketCreate(PROJECT_ID, ticket, 'col-1')

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('ticketCreate')
      if (entry?.action.type === 'ticketCreate') {
        expect(entry.action.ticket.id).toBe('ticket-1')
        expect(entry.action.columnId).toBe('col-1')
      }
    })
  })

  describe('pushColumnRename', () => {
    it('should add column rename action to undo stack', () => {
      useUndoStore
        .getState()
        .pushColumnRename(PROJECT_ID, 'col-1', 'To Do', 'Todo', null, null, null, '#ff0000')

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('columnRename')
      if (entry?.action.type === 'columnRename') {
        expect(entry.action.oldName).toBe('To Do')
        expect(entry.action.newName).toBe('Todo')
        expect(entry.action.newColor).toBe('#ff0000')
      }
    })
  })

  describe('pushColumnDelete', () => {
    it('should add column delete action to undo stack', () => {
      const column = {
        id: 'col-1',
        name: 'To Do',
        order: 1,
        projectId: PROJECT_ID,
        icon: null,
        color: null,
        tickets: [createMockTicket({ id: 'ticket-1' })],
      }
      useUndoStore.getState().pushColumnDelete(PROJECT_ID, column, 'col-2')

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('columnDelete')
      if (entry?.action.type === 'columnDelete') {
        expect(entry.action.column.id).toBe('col-1')
        expect(entry.action.movedToColumnId).toBe('col-2')
      }
    })
  })

  describe('pushColumnCreate', () => {
    it('should add column create action to undo stack', () => {
      useUndoStore.getState().pushColumnCreate(PROJECT_ID, 'col-1', 'New Column')

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry?.action.type).toBe('columnCreate')
      if (entry?.action.type === 'columnCreate') {
        expect(entry.action.columnId).toBe('col-1')
        expect(entry.action.columnName).toBe('New Column')
      }
    })
  })

  describe('updateTicketCreateEntry', () => {
    it('should update ticket in ticketCreate entry', () => {
      const oldTicket = createMockTicket({ id: 'temp-1', title: 'Old' })
      useUndoStore.getState().pushTicketCreate(PROJECT_ID, oldTicket, 'col-1')

      const newTicket = createMockTicket({ id: 'server-1', title: 'New' })
      useUndoStore.getState().updateTicketCreateEntry('temp-1', newTicket)

      const entry = useUndoStore.getState().undoStack[0]
      if (entry?.action.type === 'ticketCreate') {
        expect(entry.action.ticket.id).toBe('server-1')
        expect(entry.action.ticket.title).toBe('New')
      }
    })

    it('should update ticket in redo stack as well', () => {
      const oldTicket = createMockTicket({ id: 'temp-1', title: 'Old' })
      useUndoStore.getState().pushTicketCreate(PROJECT_ID, oldTicket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)

      const newTicket = createMockTicket({ id: 'server-1', title: 'New' })
      useUndoStore.getState().updateTicketCreateEntry('temp-1', newTicket)

      const redoEntry = useUndoStore.getState().redoStack[0]
      if (redoEntry?.action.type === 'ticketCreate') {
        expect(redoEntry.action.ticket.id).toBe('server-1')
      }
    })
  })

  describe('pushAttachmentAdd', () => {
    const makeAttachmentAction = (id: string) => ({
      projectId: PROJECT_ID,
      ticketId: 'ticket-1',
      ticketKey: 'TEST-1',
      attachment: {
        id,
        filename: `${id}.png`,
        originalName: `${id}.png`,
        mimetype: 'image/png',
        size: 1024,
        url: `/uploads/${id}.png`,
      },
    })

    it('should add an attachmentAdd entry to undo stack', () => {
      const attachments = [makeAttachmentAction('att-1')]
      useUndoStore.getState().pushAttachmentAdd(PROJECT_ID, attachments)

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry).toBeDefined()
      expect(entry?.action.type).toBe('attachmentAdd')
      if (entry?.action.type === 'attachmentAdd') {
        expect(entry.action.attachments).toHaveLength(1)
        expect(entry.action.attachments[0].attachment.id).toBe('att-1')
      }
      expect(entry?.projectId).toBe(PROJECT_ID)
    })

    it('should clear redo stack when not a redo operation', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().pushAttachmentAdd(PROJECT_ID, [makeAttachmentAction('att-1')])
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })

    it('should preserve redo stack when isRedo is true', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().pushAttachmentAdd(PROJECT_ID, [makeAttachmentAction('att-1')], true)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)
    })
  })

  describe('pushAttachmentDelete', () => {
    const makeAttachmentAction = (id: string) => ({
      projectId: PROJECT_ID,
      ticketId: 'ticket-1',
      ticketKey: 'TEST-1',
      attachment: {
        id,
        filename: `${id}.pdf`,
        originalName: `${id}.pdf`,
        mimetype: 'application/pdf',
        size: 2048,
        url: `/uploads/${id}.pdf`,
      },
    })

    it('should add an attachmentDelete entry to undo stack', () => {
      const attachments = [makeAttachmentAction('att-1')]
      useUndoStore.getState().pushAttachmentDelete(PROJECT_ID, attachments)

      const entry = useUndoStore.getState().undoStack[0]
      expect(entry).toBeDefined()
      expect(entry?.action.type).toBe('attachmentDelete')
      if (entry?.action.type === 'attachmentDelete') {
        expect(entry.action.attachments).toHaveLength(1)
        expect(entry.action.attachments[0].attachment.id).toBe('att-1')
      }
      expect(entry?.projectId).toBe(PROJECT_ID)
    })

    it('should clear redo stack when not a redo operation', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore.getState().pushAttachmentDelete(PROJECT_ID, [makeAttachmentAction('att-1')])
      expect(useUndoStore.getState().redoStack).toHaveLength(0)
    })

    it('should preserve redo stack when isRedo is true', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)

      useUndoStore
        .getState()
        .pushAttachmentDelete(PROJECT_ID, [makeAttachmentAction('att-1')], true)
      expect(useUndoStore.getState().redoStack).toHaveLength(1)
    })
  })

  describe('isProcessing', () => {
    it('should default to false', () => {
      expect(useUndoStore.getState().isProcessing).toBe(false)
    })

    it('should set processing state', () => {
      useUndoStore.getState().setProcessing(true)
      expect(useUndoStore.getState().isProcessing).toBe(true)

      useUndoStore.getState().setProcessing(false)
      expect(useUndoStore.getState().isProcessing).toBe(false)
    })
  })

  describe('tryStartProcessing', () => {
    it('should acquire lock when not processing', () => {
      expect(useUndoStore.getState().tryStartProcessing()).toBe(true)
      expect(useUndoStore.getState().isProcessing).toBe(true)
    })

    it('should fail to acquire lock when already processing', () => {
      useUndoStore.getState().setProcessing(true)
      expect(useUndoStore.getState().tryStartProcessing()).toBe(false)
    })
  })

  describe('popRedo', () => {
    it('should return undefined if redo stack is empty', () => {
      const entry = useUndoStore.getState().popRedo()
      expect(entry).toBeUndefined()
    })
  })

  describe('canUndo and canRedo', () => {
    it('should return false when stacks are empty', () => {
      expect(useUndoStore.getState().canUndo()).toBe(false)
      expect(useUndoStore.getState().canRedo()).toBe(false)
    })

    it('should return true when undo stack has entries', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      expect(useUndoStore.getState().canUndo()).toBe(true)
      expect(useUndoStore.getState().canRedo()).toBe(false)
    })

    it('should return true when redo stack has entries', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useUndoStore.getState().pushDeleted(PROJECT_ID, ticket, 'col-1')
      const entry = useUndoStore.getState().popUndo()
      if (entry) useUndoStore.getState().pushRedo(entry)

      expect(useUndoStore.getState().canUndo()).toBe(false)
      expect(useUndoStore.getState().canRedo()).toBe(true)
    })
  })
})
