/**
 * Fuzz tests for board store invariants.
 * Tests that board operations maintain data consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from '@/stores/board-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { batchMoveOperation, columnsArray, moveOperation } from '../arbitraries'
import { ticketBase } from '../arbitraries/ticket'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useBoardStore.setState({ projects: {}, searchQueries: {} })
}

// Reset store before each test suite
beforeEach(() => {
  resetStore()
})

describe('Board Store Fuzz Tests', () => {
  describe('setColumns and getColumns', () => {
    it('should return equivalent data after setColumns', () => {
      fc.assert(
        fc.property(fc.uuid(), columnsArray, (projectId, columns) => {
          resetStore()
          const store = useBoardStore.getState()

          store.setColumns(projectId, columns)
          const retrieved = store.getColumns(projectId)

          // Should have same number of columns
          expect(retrieved.length).toBe(columns.length)

          // Each column should have same id and tickets count
          for (let i = 0; i < columns.length; i++) {
            expect(retrieved[i].id).toBe(columns[i].id)
            expect(retrieved[i].tickets.length).toBe(columns[i].tickets.length)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return default columns for unknown project', () => {
      fc.assert(
        fc.property(fc.uuid(), (projectId) => {
          resetStore()
          const store = useBoardStore.getState()
          const columns = store.getColumns(projectId)

          // Should return default columns (4 columns)
          expect(columns.length).toBe(4)
          expect(columns[0].name).toBe('To Do')
          expect(columns[1].name).toBe('In Progress')
          expect(columns[2].name).toBe('Review')
          expect(columns[3].name).toBe('Done')
        }),
        FUZZ_CONFIG.quick,
      )
    })
  })

  describe('moveTicket', () => {
    it('should preserve total ticket count after move', () => {
      fc.assert(
        fc.property(columnsArray, fc.nat({ max: 10 }), (columns, newOrder) => {
          resetStore()
          // Skip if no tickets to move
          const allTickets = columns.flatMap((c) => c.tickets)
          if (allTickets.length === 0 || columns.length < 2) return

          const projectId = columns[0].projectId
          const ticketToMove = allTickets[0]
          const fromColumn = columns.find((c) => c.id === ticketToMove.columnId)
          const toColumn = columns.find((c) => c.id !== ticketToMove.columnId)

          if (!fromColumn || !toColumn) return

          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          const initialCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          store.moveTicket(
            projectId,
            ticketToMove.id,
            fromColumn.id,
            toColumn.id,
            Math.min(newOrder, toColumn.tickets.length),
          )

          const finalCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          expect(finalCount).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should update ticket columnId after move', () => {
      fc.assert(
        fc.property(columnsArray, (columns) => {
          resetStore()
          const allTickets = columns.flatMap((c) => c.tickets)
          if (allTickets.length === 0 || columns.length < 2) return

          const projectId = columns[0].projectId
          const ticketToMove = allTickets[0]
          const fromColumn = columns.find((c) => c.id === ticketToMove.columnId)
          const toColumn = columns.find((c) => c.id !== ticketToMove.columnId)

          if (!fromColumn || !toColumn) return

          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          store.moveTicket(projectId, ticketToMove.id, fromColumn.id, toColumn.id, 0)

          const updatedColumns = store.getColumns(projectId)
          const movedTicket = updatedColumns
            .flatMap((c) => c.tickets)
            .find((t) => t.id === ticketToMove.id)

          expect(movedTicket?.columnId).toBe(toColumn.id)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should maintain valid ticket orders after move', () => {
      fc.assert(
        fc.property(columnsArray, (columns) => {
          resetStore()
          const allTickets = columns.flatMap((c) => c.tickets)
          if (allTickets.length === 0 || columns.length < 2) return

          const projectId = columns[0].projectId
          const ticketToMove = allTickets[0]
          const fromColumn = columns.find((c) => c.id === ticketToMove.columnId)
          const toColumn = columns.find((c) => c.id !== ticketToMove.columnId)

          if (!fromColumn || !toColumn) return

          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          store.moveTicket(projectId, ticketToMove.id, fromColumn.id, toColumn.id, 0)

          const updatedColumns = store.getColumns(projectId)

          // Check that target column has consecutive orders (it gets reordered)
          const targetCol = updatedColumns.find((c) => c.id === toColumn.id)
          if (targetCol) {
            const orders = targetCol.tickets.map((t) => t.order).sort((a, b) => a - b)
            for (let i = 0; i < orders.length; i++) {
              expect(orders[i]).toBe(i)
            }
          }

          // Check that all columns have unique, non-negative orders
          for (const column of updatedColumns) {
            const orders = column.tickets.map((t) => t.order)
            const uniqueOrders = new Set(orders)
            expect(uniqueOrders.size).toBe(orders.length) // All unique
            for (const order of orders) {
              expect(order).toBeGreaterThanOrEqual(0)
            }
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('moveTickets (batch)', () => {
    it('should preserve total ticket count after batch move', () => {
      fc.assert(
        fc.property(columnsArray, (columns) => {
          resetStore()
          const allTickets = columns.flatMap((c) => c.tickets)
          if (allTickets.length < 2 || columns.length < 2) return

          const projectId = columns[0].projectId
          const ticketsToMove = allTickets.slice(0, Math.min(3, allTickets.length))
          const ticketIds = ticketsToMove.map((t) => t.id)
          const toColumn = columns[columns.length - 1]

          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          const initialCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          store.moveTickets(projectId, ticketIds, toColumn.id, 0)

          const finalCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          expect(finalCount).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle moving to same column', () => {
      fc.assert(
        fc.property(columnsArray, (columns) => {
          resetStore()
          const firstColumn = columns[0]
          if (firstColumn.tickets.length < 2) return

          const projectId = columns[0].projectId
          const ticketIds = firstColumn.tickets.slice(0, 2).map((t) => t.id)

          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          const initialCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          // Move within same column
          store.moveTickets(projectId, ticketIds, firstColumn.id, 0)

          const finalCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          expect(finalCount).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('addTicket and removeTicket', () => {
    it('should return to original state after add then remove', () => {
      fc.assert(
        fc.property(columnsArray, ticketBase, (columns, newTicket) => {
          resetStore()
          if (columns.length === 0) return

          const projectId = columns[0].projectId
          const targetColumn = columns[0]

          // Ensure ticket belongs to the right project/column
          const ticket = {
            ...newTicket,
            projectId,
            columnId: targetColumn.id,
          } as TicketWithRelations

          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          const initialCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          store.addTicket(projectId, targetColumn.id, ticket)

          const afterAddCount = store.getColumns(projectId).flatMap((c) => c.tickets).length
          expect(afterAddCount).toBe(initialCount + 1)

          store.removeTicket(projectId, ticket.id)

          const finalCount = store.getColumns(projectId).flatMap((c) => c.tickets).length
          expect(finalCount).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle removing non-existent ticket gracefully', () => {
      fc.assert(
        fc.property(columnsArray, fc.uuid(), (columns, fakeTicketId) => {
          resetStore()
          if (columns.length === 0) return

          const projectId = columns[0].projectId
          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          const initialCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

          // Remove non-existent ticket - should not crash
          store.removeTicket(projectId, fakeTicketId)

          const finalCount = store.getColumns(projectId).flatMap((c) => c.tickets).length
          expect(finalCount).toBe(initialCount)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('getNextTicketNumber', () => {
    it('should return max+1 or 1 for empty board', () => {
      fc.assert(
        fc.property(columnsArray, (columns) => {
          resetStore()
          const projectId = columns[0]?.projectId || 'test-project'
          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          const allTickets = store.getColumns(projectId).flatMap((c) => c.tickets)
          const nextNumber = store.getNextTicketNumber(projectId)

          if (allTickets.length === 0) {
            expect(nextNumber).toBe(1)
          } else {
            const maxNumber = Math.max(...allTickets.map((t) => t.number))
            expect(nextNumber).toBe(maxNumber + 1)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should always return a positive integer', () => {
      fc.assert(
        fc.property(fc.uuid(), (projectId) => {
          const store = useBoardStore.getState()
          const nextNumber = store.getNextTicketNumber(projectId)

          expect(nextNumber).toBeGreaterThanOrEqual(1)
          expect(Number.isInteger(nextNumber)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('updateTicket', () => {
    it('should update ticket properties without changing count', () => {
      fc.assert(
        fc.property(
          columnsArray,
          fc.string({ minLength: 1, maxLength: 100 }),
          (columns, newTitle) => {
            resetStore()
            const allTickets = columns.flatMap((c) => c.tickets)
            if (allTickets.length === 0) return

            const projectId = columns[0].projectId
            const ticketToUpdate = allTickets[0]

            const store = useBoardStore.getState()
            store.setColumns(projectId, columns)

            const initialCount = store.getColumns(projectId).flatMap((c) => c.tickets).length

            store.updateTicket(projectId, ticketToUpdate.id, { title: newTitle })

            const finalCount = store.getColumns(projectId).flatMap((c) => c.tickets).length
            expect(finalCount).toBe(initialCount)

            // Verify the update
            const updated = store
              .getColumns(projectId)
              .flatMap((c) => c.tickets)
              .find((t) => t.id === ticketToUpdate.id)
            expect(updated?.title).toBe(newTitle)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle updating non-existent ticket gracefully', () => {
      fc.assert(
        fc.property(columnsArray, fc.uuid(), (columns, fakeTicketId) => {
          resetStore()
          if (columns.length === 0) return

          const projectId = columns[0].projectId
          const store = useBoardStore.getState()
          store.setColumns(projectId, columns)

          // Should not crash
          store.updateTicket(projectId, fakeTicketId, { title: 'New Title' })

          // State should be unchanged
          const count = store.getColumns(projectId).flatMap((c) => c.tickets).length
          expect(count).toBe(columns.flatMap((c) => c.tickets).length)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Search queries', () => {
    it('should set and get search queries correctly', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.string(), (projectId, query) => {
          const store = useBoardStore.getState()

          store.setSearchQuery(projectId, query)
          const retrieved = store.getSearchQuery(projectId)

          expect(retrieved).toBe(query)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return empty string for unknown project', () => {
      fc.assert(
        fc.property(fc.uuid(), (projectId) => {
          const store = useBoardStore.getState()
          const query = store.getSearchQuery(projectId)

          expect(query).toBe('')
        }),
        FUZZ_CONFIG.quick,
      )
    })
  })
})
