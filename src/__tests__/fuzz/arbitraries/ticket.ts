/**
 * Ticket-related arbitraries for fuzz testing.
 */
import * as fc from 'fast-check'
import type { IssueType, Priority, SprintStatus } from '@/types'
import { maliciousString } from './primitives'

/**
 * Ticket type enum values
 */
export const ticketType = fc.constantFrom<IssueType>('task', 'bug', 'story', 'epic')

/**
 * Ticket priority enum values
 */
export const ticketPriority = fc.constantFrom<Priority>('low', 'medium', 'high', 'critical')

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
/**
 * Valid username characters for generating usernames
 */
const validUsernameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'

const validUsername = fc
  .array(fc.constantFrom(...validUsernameChars.split('')), { minLength: 3, maxLength: 30 })
  .map((chars) => chars.join(''))

/**
 * User summary arbitrary (for assignee, reporter, creator, watchers)
 */
const userSummary = fc.record({
  id: fc.uuid(),
  username: validUsername,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: fc.emailAddress(),
  avatar: fc.option(fc.webUrl(), { nil: null }),
})

/**
 * Sprint summary arbitrary (for sprint, carriedFromSprint)
 */
const sprintSummary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  status: fc.constantFrom<SprintStatus>('planning', 'active', 'completed'),
  startDate: fc.option(fc.date(), { nil: null }),
  endDate: fc.option(fc.date(), { nil: null }),
  goal: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  budget: fc.option(fc.nat({ max: 100 }), { nil: null }),
})

/**
 * Resolution values
 */
const resolution = fc.option(
  fc.constantFrom('Done', "Won't Fix", 'Duplicate', 'Cannot Reproduce', 'Incomplete', "Won't Do"),
  { nil: null },
)

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
  resolution,
  resolvedAt: fc.option(fc.date(), { nil: null }),
  storyPoints,
  estimate: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
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
  creatorId: fc.uuid(),
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
  watchers: fc.array(userSummary, { maxLength: 10 }),
  assignee: fc.option(userSummary, { nil: null }),
  creator: userSummary,
  reporter: userSummary,
  sprint: fc.option(sprintSummary, { nil: null }),
  carriedFromSprint: fc.option(sprintSummary, { nil: null }),
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
  resolution: fc.constant(null),
  resolvedAt: fc.constant(null),
  storyPoints,
  estimate: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
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
  creatorId: fc.uuid(),
  reporterId: fc.uuid(),
  isCarriedOver: fc.boolean(),
  carriedOverCount: fc.nat({ max: 10 }),
  carriedFromSprintId: fc.option(fc.uuid(), { nil: null }),
  labels: fc.constant([]),
  watchers: fc.constant([]),
  assignee: fc.constant(null),
  creator: fc.record({
    id: fc.uuid(),
    username: validUsername,
    name: fc.string({ minLength: 1, maxLength: 100 }),
    email: fc.emailAddress(),
    avatar: fc.constant(null),
  }),
  reporter: fc.record({
    id: fc.uuid(),
    username: validUsername,
    name: fc.string({ minLength: 1, maxLength: 100 }),
    email: fc.emailAddress(),
    avatar: fc.constant(null),
  }),
  sprint: fc.constant(null),
  carriedFromSprint: fc.constant(null),
})

/**
 * Array of tickets for batch operations
 */
export const ticketArray = fc.array(ticketBase, { minLength: 0, maxLength: 50 })

/**
 * Ticket IDs array (for multi-select operations)
 */
export const ticketIds = fc.array(fc.uuid(), { minLength: 0, maxLength: 20 })
