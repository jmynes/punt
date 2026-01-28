/**
 * Column and board-related arbitraries for fuzz testing.
 */
import * as fc from 'fast-check'
import { corruptedJson } from './primitives'
import { ticketBase } from './ticket'

/**
 * Column order (non-negative integer)
 */
export const columnOrder = fc.nat({ max: 20 })

/**
 * Valid column arbitrary
 */
export const column = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  order: columnOrder,
  projectId: fc.uuid(),
})

/**
 * Column with tickets
 */
export const columnWithTickets = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  order: columnOrder,
  projectId: fc.uuid(),
  tickets: fc.array(ticketBase, { minLength: 0, maxLength: 20 }),
})

/**
 * Valid columns array (board state)
 */
export const columnsArray = fc
  .array(columnWithTickets, { minLength: 1, maxLength: 10 })
  .map((columns) =>
    // Ensure consistent projectId and sequential order
    columns.map((col, index) => ({
      ...col,
      projectId: columns[0].projectId,
      order: index,
      tickets: col.tickets.map((ticket, ticketIndex) => ({
        ...ticket,
        projectId: columns[0].projectId,
        columnId: col.id,
        order: ticketIndex,
      })),
    })),
  )

/**
 * Corrupted columns data - various ways localStorage data can be corrupted
 */
export const corruptedColumns = fc.oneof(
  // Not an array
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.string(),
  fc.dictionary(fc.string(), fc.anything()),
  // Array of non-objects
  fc.array(fc.integer()),
  fc.array(fc.string()),
  fc.array(fc.constant(null)),
  // Array with missing required fields
  fc.array(fc.record({ id: fc.uuid() })), // Missing tickets
  fc.array(fc.record({ tickets: fc.array(fc.anything()) })), // Missing id
  fc.array(
    fc.record({
      id: fc.uuid(),
      tickets: fc.constant('not-an-array'), // tickets is not an array
    }),
  ),
  // Array with invalid tickets
  fc.array(
    fc.record({
      id: fc.uuid(),
      tickets: fc.array(fc.integer()), // tickets should be objects
    }),
  ),
  // Deeply nested garbage
  fc
    .jsonValue()
    .filter((v) => !Array.isArray(v)),
  // Mixed valid and invalid
  fc
    .tuple(columnWithTickets, corruptedJson)
    .map(([col, garbage]) => [col, garbage]),
)

/**
 * Board state arbitrary (project -> columns mapping)
 */
export const boardState = fc.dictionary(fc.uuid(), columnsArray)

/**
 * Corrupted board state
 */
export const corruptedBoardState = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.anything()),
  fc.string(),
  fc.dictionary(fc.string(), corruptedColumns),
)

/**
 * Move operation parameters
 */
export const moveOperation = fc.record({
  projectId: fc.uuid(),
  ticketId: fc.uuid(),
  fromColumnId: fc.uuid(),
  toColumnId: fc.uuid(),
  newOrder: fc.nat({ max: 100 }),
})

/**
 * Batch move operation parameters
 */
export const batchMoveOperation = fc.record({
  projectId: fc.uuid(),
  ticketIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
  toColumnId: fc.uuid(),
  newOrder: fc.nat({ max: 100 }),
})
