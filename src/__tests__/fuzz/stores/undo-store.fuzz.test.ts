/**
 * Fuzz tests for undo store invariants.
 * Tests that undo/redo operations maintain consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useUndoStore.setState({ undoStack: [], redoStack: [], isProcessing: false })
}

// Reset store before each test suite
beforeEach(() => {
  resetStore()
})

// Simple ticket factory for testing
function createTestTicket(overrides: Partial<TicketWithRelations> = {}): TicketWithRelations {
  return {
    id: crypto.randomUUID(),
    projectId: 'test-project',
    columnId: 'col-1',
    number: 1,
    title: 'Test Ticket',
    description: null,
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: null,
    estimate: null,
    startDate: null,
    dueDate: null,
    environment: null,
    affectedVersion: null,
    fixVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    parentId: null,
    sprintId: null,
    assigneeId: null,
    reporterId: 'user-1',
    isCarriedOver: false,
    carriedOverCount: 0,
    carriedFromSprintId: null,
    labels: [],
    watchers: [],
    assignee: null,
    reporter: { id: 'user-1', name: 'User', email: null, avatar: null },
    ...overrides,
  } as TicketWithRelations
}

describe('Undo Store Fuzz Tests', () => {
  describe('Push and pop operations', () => {
    it('should return same entry after push then pop', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (projectId, columnId) => {
          resetStore()
          const store = useUndoStore.getState()
          const ticket = createTestTicket({ projectId, columnId })

          store.pushDeleted(projectId, ticket, columnId)

          const popped = useUndoStore.getState().popUndo()

          expect(popped).toBeDefined()
          expect(popped?.projectId).toBe(projectId)
          expect(popped?.action.type).toBe('delete')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should grow stack with each push', () => {
      fc.assert(
        fc.property(fc.nat({ max: 20 }), (count) => {
          fc.pre(count >= 1)
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          for (let i = 0; i < count; i++) {
            const ticket = createTestTicket({ number: i + 1 })
            store.pushDeleted(projectId, ticket, columnId)

            const currentStack = useUndoStore.getState().undoStack
            expect(currentStack.length).toBe(i + 1)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should pop in LIFO order', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (count) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Push all tickets with unique numbers
          const ticketNumbers: number[] = []
          for (let i = 0; i < count; i++) {
            const ticket = createTestTicket({ number: i + 1 })
            ticketNumbers.push(i + 1)
            store.pushDeleted(projectId, ticket, columnId)
          }

          // Pop all and verify reverse order
          const poppedNumbers: number[] = []
          let entry = useUndoStore.getState().popUndo()
          while (entry) {
            if (entry.action.type === 'delete' && entry.action.tickets[0]) {
              poppedNumbers.push(entry.action.tickets[0].ticket.number)
            }
            entry = useUndoStore.getState().popUndo()
          }

          expect(poppedNumbers).toEqual([...ticketNumbers].reverse())
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Redo stack behavior', () => {
    it('should clear redo stack on new non-redo action', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (projectId1, projectId2) => {
          resetStore()
          const store = useUndoStore.getState()
          const columnId = 'col-1'

          // Push and undo to populate redo stack
          const ticket1 = createTestTicket()
          store.pushDeleted(projectId1, ticket1, columnId)
          const entry = useUndoStore.getState().popUndo()
          if (entry) {
            useUndoStore.getState().pushRedo(entry)
          }

          // Redo stack should have 1 entry
          expect(useUndoStore.getState().redoStack.length).toBe(1)

          // Push new action (isRedo=false, the default)
          const ticket2 = createTestTicket()
          useUndoStore.getState().pushDeleted(projectId2, ticket2, columnId)

          // Redo stack should be cleared
          expect(useUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should preserve redo stack on redo action', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (projectId1, projectId2) => {
          resetStore()
          const store = useUndoStore.getState()
          const columnId = 'col-1'

          // Push, undo, then push with isRedo=true
          const ticket1 = createTestTicket()
          store.pushDeleted(projectId1, ticket1, columnId)
          const entry = useUndoStore.getState().popUndo()
          if (entry) {
            useUndoStore.getState().pushRedo(entry)
          }

          const redoLengthBefore = useUndoStore.getState().redoStack.length

          // Push with isRedo=true
          const ticket2 = createTestTicket()
          useUndoStore.getState().pushDeleted(projectId2, ticket2, columnId, true)

          // Redo stack should be preserved
          expect(useUndoStore.getState().redoStack.length).toBe(redoLengthBefore)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Different action types', () => {
    it('should handle delete batch actions', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (projectId, ticketIds) => {
            resetStore()
            const store = useUndoStore.getState()
            const columnId = 'col-1'

            const tickets = ticketIds.map((id) => ({
              ticket: createTestTicket({ id, projectId }),
              columnId,
            }))

            store.pushDeletedBatch(projectId, tickets)

            const entry = useUndoStore.getState().popUndo()

            expect(entry?.action.type).toBe('delete')
            if (entry?.action.type === 'delete') {
              expect(entry.action.tickets.length).toBe(tickets.length)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle paste actions', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (projectId, ticketIds) => {
            resetStore()
            const store = useUndoStore.getState()
            const columnId = 'col-1'

            const tickets = ticketIds.map((id) => ({
              ticket: createTestTicket({ id, projectId }),
              columnId,
            }))

            store.pushPaste(projectId, tickets)

            const entry = useUndoStore.getState().popUndo()

            expect(entry?.action.type).toBe('paste')
            if (entry?.action.type === 'paste') {
              expect(entry.action.tickets.length).toBe(tickets.length)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle move actions', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (projectId, fromColumnId, toColumnId, fromName, toName) => {
            resetStore()
            const store = useUndoStore.getState()

            const moves = [{ ticketId: crypto.randomUUID(), fromColumnId, toColumnId }]

            store.pushMove(projectId, moves, fromName, toName)

            const entry = useUndoStore.getState().popUndo()

            expect(entry?.action.type).toBe('move')
            if (entry?.action.type === 'move') {
              expect(entry.action.moves.length).toBe(1)
              expect(entry.action.fromColumnName).toBe(fromName)
              expect(entry.action.toColumnName).toBe(toName)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle update actions', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (projectId, ticketId) => {
          resetStore()
          const store = useUndoStore.getState()

          const before = createTestTicket({ id: ticketId, title: 'Before' })
          const after = createTestTicket({ id: ticketId, title: 'After' })

          store.pushUpdate(projectId, [{ ticketId, before, after }])

          const entry = useUndoStore.getState().popUndo()

          expect(entry?.action.type).toBe('update')
          if (entry?.action.type === 'update') {
            expect(entry.action.tickets.length).toBe(1)
            expect(entry.action.tickets[0].before.title).toBe('Before')
            expect(entry.action.tickets[0].after.title).toBe('After')
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle ticket create actions', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (projectId, columnId) => {
          resetStore()
          const store = useUndoStore.getState()
          const ticket = createTestTicket({ projectId })

          store.pushTicketCreate(projectId, ticket, columnId)

          const entry = useUndoStore.getState().popUndo()

          expect(entry?.action.type).toBe('ticketCreate')
          if (entry?.action.type === 'ticketCreate') {
            expect(entry.action.ticket.id).toBe(ticket.id)
            expect(entry.action.columnId).toBe(columnId)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('clearRedo', () => {
    it('should empty redo stack', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (count) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Build up redo stack by pushing entries directly
          for (let i = 0; i < count; i++) {
            const ticket = createTestTicket()
            const entry = {
              action: { type: 'delete' as const, tickets: [{ ticket, columnId }] },
              timestamp: Date.now(),
              projectId,
            }
            store.pushRedo(entry)
          }

          expect(useUndoStore.getState().redoStack.length).toBe(count)

          useUndoStore.getState().clearRedo()

          expect(useUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('canUndo and canRedo', () => {
    it('should report correct undo/redo availability', () => {
      fc.assert(
        fc.property(fc.nat({ max: 5 }), (count) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Initially both should be false
          expect(useUndoStore.getState().canUndo()).toBe(false)
          expect(useUndoStore.getState().canRedo()).toBe(false)

          // Push entries
          for (let i = 0; i < count; i++) {
            const ticket = createTestTicket()
            store.pushDeleted(projectId, ticket, columnId)
          }

          // Can undo should reflect count
          expect(useUndoStore.getState().canUndo()).toBe(count > 0)
          expect(useUndoStore.getState().canRedo()).toBe(false)

          // Pop and push to redo
          if (count > 0) {
            const entry = useUndoStore.getState().popUndo()
            if (entry) {
              useUndoStore.getState().pushRedo(entry)
            }
            expect(useUndoStore.getState().canRedo()).toBe(true)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
