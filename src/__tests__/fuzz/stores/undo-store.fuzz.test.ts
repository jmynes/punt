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
  useUndoStore.setState({ undoStack: [], redoStack: [] })
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
        fc.property(fc.uuid(), fc.uuid(), fc.string(), (projectId, columnId, toastId) => {
          resetStore()
          const store = useUndoStore.getState()
          const ticket = createTestTicket({ projectId, columnId })

          store.pushDeleted(projectId, ticket, columnId, toastId)

          const popped = useUndoStore.getState().popUndo()

          expect(popped).toBeDefined()
          expect(popped?.projectId).toBe(projectId)
          expect(popped?.toastId).toBe(toastId)
          expect(popped?.action.type).toBe('delete')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should grow stack with each push', () => {
      fc.assert(
        fc.property(fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }), (toastIds) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          for (let i = 0; i < toastIds.length; i++) {
            const ticket = createTestTicket({ number: i + 1 })
            store.pushDeleted(projectId, ticket, columnId, toastIds[i])

            const currentStack = useUndoStore.getState().undoStack
            expect(currentStack.length).toBe(i + 1)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should pop in LIFO order', () => {
      fc.assert(
        fc.property(fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), (toastIds) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Push all
          for (const toastId of toastIds) {
            const ticket = createTestTicket()
            store.pushDeleted(projectId, ticket, columnId, toastId)
          }

          // Pop all and verify reverse order
          const poppedIds: string[] = []
          let entry = useUndoStore.getState().popUndo()
          while (entry) {
            poppedIds.push(entry.toastId as string)
            entry = useUndoStore.getState().popUndo()
          }

          expect(poppedIds).toEqual([...toastIds].reverse())
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Redo stack behavior', () => {
    it('should clear redo stack on new non-redo action', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (toastId1, toastId2) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Push and undo to populate redo stack
          const ticket1 = createTestTicket()
          store.pushDeleted(projectId, ticket1, columnId, toastId1)
          const entry = useUndoStore.getState().popUndo()
          if (entry) {
            useUndoStore.getState().pushRedo(entry)
          }

          // Redo stack should have 1 entry
          expect(useUndoStore.getState().redoStack.length).toBe(1)

          // Push new action (isRedo=false, the default)
          const ticket2 = createTestTicket()
          useUndoStore.getState().pushDeleted(projectId, ticket2, columnId, toastId2)

          // Redo stack should be cleared
          expect(useUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should preserve redo stack on redo action', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (toastId1, toastId2) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Push, undo, then push with isRedo=true
          const ticket1 = createTestTicket()
          store.pushDeleted(projectId, ticket1, columnId, toastId1)
          const entry = useUndoStore.getState().popUndo()
          if (entry) {
            useUndoStore.getState().pushRedo(entry)
          }

          const redoLengthBefore = useUndoStore.getState().redoStack.length

          // Push with isRedo=true
          const ticket2 = createTestTicket()
          useUndoStore.getState().pushDeleted(projectId, ticket2, columnId, toastId2, true)

          // Redo stack should be preserved
          expect(useUndoStore.getState().redoStack.length).toBe(redoLengthBefore)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('removeEntry', () => {
    it('should only remove matching toastId', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }),
          fc.nat(),
          (toastIds, removeIdx) => {
            resetStore()
            const store = useUndoStore.getState()
            const projectId = 'test-project'
            const columnId = 'col-1'
            const uniqueIds = [...new Set(toastIds)] // Ensure unique

            if (uniqueIds.length < 2) return

            // Push all
            for (const toastId of uniqueIds) {
              const ticket = createTestTicket()
              store.pushDeleted(projectId, ticket, columnId, toastId)
            }

            const targetIdx = removeIdx % uniqueIds.length
            const targetId = uniqueIds[targetIdx]

            useUndoStore.getState().removeEntry(targetId)

            const remaining = useUndoStore.getState().undoStack
            const remainingIds = remaining.map((e) => e.toastId)

            // Target should be removed
            expect(remainingIds).not.toContain(targetId)

            // Others should remain
            for (let i = 0; i < uniqueIds.length; i++) {
              if (i !== targetIdx) {
                expect(remainingIds).toContain(uniqueIds[i])
              }
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle removing non-existent entry gracefully', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (existingId, nonExistentId) => {
          fc.pre(existingId !== nonExistentId)

          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          const ticket = createTestTicket()
          store.pushDeleted(projectId, ticket, columnId, existingId)

          const lengthBefore = useUndoStore.getState().undoStack.length

          // Remove non-existent
          useUndoStore.getState().removeEntry(nonExistentId)

          // Length should be unchanged
          expect(useUndoStore.getState().undoStack.length).toBe(lengthBefore)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('undoByToastId and redoByToastId', () => {
    it('should move entry from undo to redo stack', () => {
      fc.assert(
        fc.property(fc.uuid(), (toastId) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          const ticket = createTestTicket()
          store.pushDeleted(projectId, ticket, columnId, toastId)

          const entry = useUndoStore.getState().undoByToastId(toastId)

          expect(entry).toBeDefined()
          expect(useUndoStore.getState().undoStack.length).toBe(0)
          expect(useUndoStore.getState().redoStack.length).toBe(1)
          expect(useUndoStore.getState().redoStack[0].toastId).toBe(toastId)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should move entry from redo to undo stack', () => {
      fc.assert(
        fc.property(fc.uuid(), (toastId) => {
          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          const ticket = createTestTicket()
          store.pushDeleted(projectId, ticket, columnId, toastId)

          // Undo first
          useUndoStore.getState().undoByToastId(toastId)

          // Then redo
          const entry = useUndoStore.getState().redoByToastId(toastId)

          expect(entry).toBeDefined()
          expect(useUndoStore.getState().redoStack.length).toBe(0)
          expect(useUndoStore.getState().undoStack.length).toBe(1)
          expect(useUndoStore.getState().undoStack[0].toastId).toBe(toastId)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return undefined for non-existent toastId', () => {
      fc.assert(
        fc.property(fc.uuid(), (nonExistentId) => {
          resetStore()
          const store = useUndoStore.getState()

          const undoResult = store.undoByToastId(nonExistentId)
          const redoResult = useUndoStore.getState().redoByToastId(nonExistentId)

          expect(undoResult).toBeUndefined()
          expect(redoResult).toBeUndefined()
        }),
        FUZZ_CONFIG.quick,
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
            const toastId = crypto.randomUUID()

            const tickets = ticketIds.map((id) => ({
              ticket: createTestTicket({ id, projectId }),
              columnId,
            }))

            store.pushDeletedBatch(projectId, tickets, toastId)

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
            const toastId = crypto.randomUUID()

            const tickets = ticketIds.map((id) => ({
              ticket: createTestTicket({ id, projectId }),
              columnId,
            }))

            store.pushPaste(projectId, tickets, toastId)

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
            const toastId = crypto.randomUUID()

            const moves = [{ ticketId: crypto.randomUUID(), fromColumnId, toColumnId }]

            store.pushMove(projectId, moves, fromName, toName, toastId)

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
          const toastId = crypto.randomUUID()

          const before = createTestTicket({ id: ticketId, title: 'Before' })
          const after = createTestTicket({ id: ticketId, title: 'After' })

          store.pushUpdate(projectId, [{ ticketId, before, after }], toastId)

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
          const toastId = crypto.randomUUID()
          const ticket = createTestTicket({ projectId })

          store.pushTicketCreate(projectId, ticket, columnId, toastId)

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
        fc.property(fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), (toastIds) => {
          // Ensure unique toastIds to avoid potential issues
          const uniqueToastIds = [...new Set(toastIds)]
          if (uniqueToastIds.length === 0) return

          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'

          // Build up redo stack by pushing entries directly
          // We use pushRedo to avoid the clear-redo-on-push behavior
          for (const toastId of uniqueToastIds) {
            const ticket = createTestTicket()
            const entry = {
              action: { type: 'delete' as const, tickets: [{ ticket, columnId }] },
              timestamp: Date.now(),
              toastId,
              projectId,
            }
            store.pushRedo(entry)
          }

          expect(useUndoStore.getState().redoStack.length).toBe(uniqueToastIds.length)

          useUndoStore.getState().clearRedo()

          expect(useUndoStore.getState().redoStack.length).toBe(0)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('updateToastId', () => {
    it('should update toast ID in undo stack', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (oldId, newId) => {
          fc.pre(oldId !== newId)

          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'
          const ticket = createTestTicket()

          store.pushDeleted(projectId, ticket, columnId, oldId)
          useUndoStore.getState().updateUndoToastId(oldId, newId)

          const entry = useUndoStore.getState().undoStack[0]
          expect(entry.toastId).toBe(newId)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should update toast ID in redo stack', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.uuid(), (oldId, newId) => {
          fc.pre(oldId !== newId)

          resetStore()
          const store = useUndoStore.getState()
          const projectId = 'test-project'
          const columnId = 'col-1'
          const ticket = createTestTicket()

          store.pushDeleted(projectId, ticket, columnId, oldId)
          const entry = useUndoStore.getState().popUndo()
          if (entry) {
            useUndoStore.getState().pushRedo(entry)
          }

          useUndoStore.getState().updateRedoToastId(oldId, newId)

          const redoEntry = useUndoStore.getState().redoStack[0]
          expect(redoEntry.toastId).toBe(newId)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})
