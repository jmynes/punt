/**
 * Ticket-related arbitraries for fuzz testing.
 */
import * as fc from 'fast-check'
import { maliciousString } from './primitives'

/**
 * Ticket type enum values
 */
export const ticketType = fc.constantFrom('task', 'bug', 'story', 'epic')

/**
 * Ticket priority enum values
 */
export const ticketPriority = fc.constantFrom('low', 'medium', 'high', 'critical')

/**
 * Valid ticket number (positive integer)
 */
export const ticketNumber = fc.nat({ max: 100000 })

/**
 * Ticket order (non-negative integer)
 */
export const ticketOrder = fc.nat({ max: 1000 })

/**
 * Story points (common values)
 */
export const storyPoints = fc.option(fc.constantFrom(1, 2, 3, 5, 8, 13, 21), { nil: null })

/**
 * Base ticket arbitrary with minimal required fields
 */
export const ticketBase = fc.record({
  id: fc.uuid(),
  projectId: fc.uuid(),
  columnId: fc.uuid(),
  number: ticketNumber,
  title: fc.string({ minLength: 1, maxLength: 500 }),
  description: fc.option(fc.string({ maxLength: 10000 }), { nil: null }),
  type: ticketType,
  priority: ticketPriority,
  order: ticketOrder,
  storyPoints,
  estimate: fc.option(fc.nat({ max: 480 }), { nil: null }), // Minutes, max 8 hours
  startDate: fc.option(fc.date(), { nil: null }),
  dueDate: fc.option(fc.date(), { nil: null }),
  environment: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  affectedVersion: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  fixVersion: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
  parentId: fc.option(fc.uuid(), { nil: null }),
  sprintId: fc.option(fc.uuid(), { nil: null }),
  assigneeId: fc.option(fc.uuid(), { nil: null }),
  reporterId: fc.uuid(),
  isCarriedOver: fc.boolean(),
  carriedOverCount: fc.nat({ max: 10 }),
  carriedFromSprintId: fc.option(fc.uuid(), { nil: null }),
  labels: fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      color: fc
        .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 6, maxLength: 6 })
        .map((chars) => `#${chars.join('')}`),
      projectId: fc.uuid(),
    }),
    { maxLength: 10 },
  ),
  watchers: fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      email: fc.option(fc.emailAddress(), { nil: null }),
      avatar: fc.option(fc.webUrl(), { nil: null }),
    }),
    { maxLength: 10 },
  ),
  assignee: fc.option(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      email: fc.option(fc.emailAddress(), { nil: null }),
      avatar: fc.option(fc.webUrl(), { nil: null }),
    }),
    { nil: null },
  ),
  reporter: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    email: fc.option(fc.emailAddress(), { nil: null }),
    avatar: fc.option(fc.webUrl(), { nil: null }),
  }),
})

/**
 * Ticket with malicious content for security testing
 */
export const maliciousTicket = fc.record({
  id: fc.uuid(),
  projectId: fc.uuid(),
  columnId: fc.uuid(),
  number: ticketNumber,
  title: maliciousString,
  description: fc.option(maliciousString, { nil: null }),
  type: ticketType,
  priority: ticketPriority,
  order: ticketOrder,
  storyPoints,
  estimate: fc.option(fc.nat({ max: 480 }), { nil: null }),
  startDate: fc.option(fc.date(), { nil: null }),
  dueDate: fc.option(fc.date(), { nil: null }),
  environment: fc.option(maliciousString, { nil: null }),
  affectedVersion: fc.option(maliciousString, { nil: null }),
  fixVersion: fc.option(maliciousString, { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
  parentId: fc.option(fc.uuid(), { nil: null }),
  sprintId: fc.option(fc.uuid(), { nil: null }),
  assigneeId: fc.option(fc.uuid(), { nil: null }),
  reporterId: fc.uuid(),
  isCarriedOver: fc.boolean(),
  carriedOverCount: fc.nat({ max: 10 }),
  carriedFromSprintId: fc.option(fc.uuid(), { nil: null }),
  labels: fc.constant([]),
  watchers: fc.constant([]),
  assignee: fc.constant(null),
  reporter: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    email: fc.option(fc.emailAddress(), { nil: null }),
    avatar: fc.constant(null),
  }),
})

/**
 * Array of tickets for batch operations
 */
export const ticketArray = fc.array(ticketBase, { minLength: 0, maxLength: 50 })

/**
 * Ticket IDs array (for multi-select operations)
 */
export const ticketIds = fc.array(fc.uuid(), { minLength: 0, maxLength: 20 })
