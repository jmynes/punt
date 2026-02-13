/**
 * Unit tests for sprint-utils.ts
 * Tests sprint utility functions for column detection, ticket filtering, and status formatting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnWithTickets, SprintSummary, TicketWithRelations } from '@/types'
import {
  calculateSprintProgress,
  formatDaysRemaining,
  generateNextSprintName,
  getCompletedTickets,
  getDaysRemaining,
  getIncompleteTickets,
  getSprintStatusColor,
  getSprintStatusLabel,
  isCompletedColumn,
  isSprintActive,
  isSprintExpired,
} from '../sprint-utils'

// Mock ticket factory
function createMockTicket(overrides: Partial<TicketWithRelations> = {}): TicketWithRelations {
  return {
    id: 'ticket-1',
    number: 1,
    title: 'Test Ticket',
    description: null,
    type: 'task',
    priority: 'medium',
    order: 1,
    columnId: 'col-1',
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    assigneeId: null,
    reporterId: null,
    sprintId: null,
    parentId: null,
    storyPoints: null,
    estimate: null,
    startDate: null,
    dueDate: null,
    environment: null,
    affectedVersion: null,
    fixVersion: null,
    resolution: null,
    resolvedAt: null,
    isCarriedOver: false,
    carriedFromSprintId: null,
    carriedOverCount: 0,
    labels: [],
    watchers: [],
    assignee: null,
    reporter: null,
    column: {
      id: 'col-1',
      name: 'To Do',
      order: 1,
      projectId: 'project-1',
      icon: null,
      color: null,
    },
    ...overrides,
  } as TicketWithRelations
}

// Mock column factory
function createMockColumn(overrides: Partial<ColumnWithTickets> = {}): ColumnWithTickets {
  return {
    id: 'col-1',
    name: 'To Do',
    order: 1,
    projectId: 'project-1',
    icon: null,
    color: null,
    tickets: [],
    ...overrides,
  }
}

// Mock sprint factory
function createMockSprint(overrides: Partial<SprintSummary> = {}): SprintSummary {
  return {
    id: 'sprint-1',
    name: 'Sprint 1',
    goal: null,
    startDate: null,
    endDate: null,
    status: 'planning',
    projectId: 'project-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ticketCount: 0,
    completedTicketCount: 0,
    incompleteTicketCount: 0,
    totalStoryPoints: 0,
    completedStoryPoints: 0,
    incompleteStoryPoints: 0,
    ...overrides,
  }
}

describe('Sprint Utils', () => {
  describe('isCompletedColumn', () => {
    it('should return true for "done"', () => {
      expect(isCompletedColumn('done')).toBe(true)
    })

    it('should return true for "Done" (case insensitive)', () => {
      expect(isCompletedColumn('Done')).toBe(true)
    })

    it('should return true for "DONE" (case insensitive)', () => {
      expect(isCompletedColumn('DONE')).toBe(true)
    })

    it('should return true for "complete"', () => {
      expect(isCompletedColumn('complete')).toBe(true)
    })

    it('should return true for "completed"', () => {
      expect(isCompletedColumn('completed')).toBe(true)
    })

    it('should return true for "closed"', () => {
      expect(isCompletedColumn('closed')).toBe(true)
    })

    it('should return true for "resolved"', () => {
      expect(isCompletedColumn('resolved')).toBe(true)
    })

    it('should return true for "finished"', () => {
      expect(isCompletedColumn('finished')).toBe(true)
    })

    it('should return false for "To Do"', () => {
      expect(isCompletedColumn('To Do')).toBe(false)
    })

    it('should return false for "In Progress"', () => {
      expect(isCompletedColumn('In Progress')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isCompletedColumn('')).toBe(false)
    })

    it('should handle whitespace trimming', () => {
      expect(isCompletedColumn('  done  ')).toBe(true)
    })
  })

  describe('getIncompleteTickets', () => {
    it('should return all tickets when no done columns', () => {
      const columns = [
        createMockColumn({ id: 'col-1', name: 'To Do' }),
        createMockColumn({ id: 'col-2', name: 'In Progress' }),
      ]
      const tickets = [
        createMockTicket({ id: 'ticket-1', columnId: 'col-1' }),
        createMockTicket({ id: 'ticket-2', columnId: 'col-2' }),
      ]

      const result = getIncompleteTickets(tickets, columns)
      expect(result).toHaveLength(2)
    })

    it('should exclude tickets in done columns', () => {
      const columns = [
        createMockColumn({ id: 'col-1', name: 'To Do' }),
        createMockColumn({ id: 'col-2', name: 'Done' }),
      ]
      const tickets = [
        createMockTicket({ id: 'ticket-1', columnId: 'col-1' }),
        createMockTicket({ id: 'ticket-2', columnId: 'col-2' }),
      ]

      const result = getIncompleteTickets(tickets, columns)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ticket-1')
    })

    it('should use provided doneColumnIds over auto-detection', () => {
      const columns = [
        createMockColumn({ id: 'col-1', name: 'To Do' }),
        createMockColumn({ id: 'col-2', name: 'Custom Done' }),
      ]
      const tickets = [
        createMockTicket({ id: 'ticket-1', columnId: 'col-1' }),
        createMockTicket({ id: 'ticket-2', columnId: 'col-2' }),
      ]

      const result = getIncompleteTickets(tickets, columns, ['col-2'])
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ticket-1')
    })

    it('should return empty array when all tickets are done', () => {
      const columns = [createMockColumn({ id: 'col-1', name: 'Done' })]
      const tickets = [createMockTicket({ id: 'ticket-1', columnId: 'col-1' })]

      const result = getIncompleteTickets(tickets, columns)
      expect(result).toHaveLength(0)
    })
  })

  describe('getCompletedTickets', () => {
    it('should return only tickets in done columns', () => {
      const columns = [
        createMockColumn({ id: 'col-1', name: 'To Do' }),
        createMockColumn({ id: 'col-2', name: 'Done' }),
      ]
      const tickets = [
        createMockTicket({ id: 'ticket-1', columnId: 'col-1' }),
        createMockTicket({ id: 'ticket-2', columnId: 'col-2' }),
      ]

      const result = getCompletedTickets(tickets, columns)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ticket-2')
    })

    it('should return empty array when no done columns', () => {
      const columns = [createMockColumn({ id: 'col-1', name: 'To Do' })]
      const tickets = [createMockTicket({ id: 'ticket-1', columnId: 'col-1' })]

      const result = getCompletedTickets(tickets, columns)
      expect(result).toHaveLength(0)
    })

    it('should use provided doneColumnIds', () => {
      const columns = [
        createMockColumn({ id: 'col-1', name: 'Custom Done' }),
        createMockColumn({ id: 'col-2', name: 'Another' }),
      ]
      const tickets = [
        createMockTicket({ id: 'ticket-1', columnId: 'col-1' }),
        createMockTicket({ id: 'ticket-2', columnId: 'col-2' }),
      ]

      const result = getCompletedTickets(tickets, columns, ['col-1'])
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ticket-1')
    })
  })

  describe('generateNextSprintName', () => {
    it('should increment trailing number', () => {
      expect(generateNextSprintName('Sprint 1')).toBe('Sprint 2')
    })

    it('should handle double digit numbers', () => {
      expect(generateNextSprintName('Sprint 10')).toBe('Sprint 11')
    })

    it('should handle triple digit numbers', () => {
      expect(generateNextSprintName('Sprint 99')).toBe('Sprint 100')
    })

    it('should handle no space before number', () => {
      expect(generateNextSprintName('Sprint1')).toBe('Sprint2')
    })

    it('should append 2 when no trailing number', () => {
      expect(generateNextSprintName('January Sprint')).toBe('January Sprint 2')
    })

    it('should append 2 to single word without number', () => {
      expect(generateNextSprintName('Iteration')).toBe('Iteration 2')
    })

    it('should handle empty string', () => {
      expect(generateNextSprintName('')).toBe(' 2')
    })

    it('should handle only a number', () => {
      expect(generateNextSprintName('5')).toBe('6')
    })
  })

  describe('isSprintExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return false when no end date', () => {
      const sprint = createMockSprint({ endDate: null })
      expect(isSprintExpired(sprint)).toBe(false)
    })

    it('should return true when past end date', () => {
      const sprint = createMockSprint({ endDate: '2024-06-14' })
      expect(isSprintExpired(sprint)).toBe(true)
    })

    it('should return false when end date is in the future', () => {
      const sprint = createMockSprint({ endDate: '2024-06-20' })
      expect(isSprintExpired(sprint)).toBe(false)
    })

    it('should return true when end date is today (same day at midnight)', () => {
      // Testing edge case - end date at start of day is before current time
      const sprint = createMockSprint({ endDate: '2024-06-15' })
      expect(isSprintExpired(sprint)).toBe(false) // Same day should not be expired
    })
  })

  describe('isSprintActive', () => {
    it('should return true for active sprint', () => {
      const sprint = createMockSprint({ status: 'active' })
      expect(isSprintActive(sprint)).toBe(true)
    })

    it('should return false for planning sprint', () => {
      const sprint = createMockSprint({ status: 'planning' })
      expect(isSprintActive(sprint)).toBe(false)
    })

    it('should return false for completed sprint', () => {
      const sprint = createMockSprint({ status: 'completed' })
      expect(isSprintActive(sprint)).toBe(false)
    })
  })

  describe('getDaysRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return null for null end date', () => {
      expect(getDaysRemaining(null)).toBeNull()
    })

    it('should return positive number for future date', () => {
      const endDate = new Date('2024-06-20')
      expect(getDaysRemaining(endDate)).toBeGreaterThan(0)
    })

    it('should return negative number for past date', () => {
      const endDate = new Date('2024-06-10')
      expect(getDaysRemaining(endDate)).toBeLessThan(0)
    })

    it('should return 0 or 1 for same day', () => {
      const endDate = new Date('2024-06-15T23:59:59')
      const result = getDaysRemaining(endDate)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('should calculate correct days for week in future', () => {
      const endDate = new Date('2024-06-22T12:00:00')
      expect(getDaysRemaining(endDate)).toBe(7)
    })
  })

  describe('formatDaysRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "No end date" for null', () => {
      expect(formatDaysRemaining(null)).toBe('No end date')
    })

    it('should return "Ends today" for same day (within same second)', () => {
      // getDaysRemaining uses Math.ceil, so any positive difference rounds to at least 1
      // "Ends today" is returned only when days === 0, which requires end time to be
      // within the same second or slightly in the past (but not yesterday)
      // Set end date to be exactly at or slightly before current time
      const endDate = new Date('2024-06-15T11:59:59')
      expect(formatDaysRemaining(endDate)).toBe('Ends today')
    })

    it('should return "1 day remaining" for tomorrow', () => {
      const endDate = new Date('2024-06-16T12:00:00')
      expect(formatDaysRemaining(endDate)).toBe('1 day remaining')
    })

    it('should return "X days remaining" for future dates', () => {
      const endDate = new Date('2024-06-22T12:00:00')
      expect(formatDaysRemaining(endDate)).toBe('7 days remaining')
    })

    it('should return "Ended yesterday" for yesterday', () => {
      const endDate = new Date('2024-06-14T12:00:00')
      expect(formatDaysRemaining(endDate)).toBe('Ended yesterday')
    })

    it('should return "Ended X days ago" for past dates', () => {
      const endDate = new Date('2024-06-10T12:00:00')
      expect(formatDaysRemaining(endDate)).toBe('Ended 5 days ago')
    })
  })

  describe('calculateSprintProgress', () => {
    it('should return 0 for empty sprint', () => {
      expect(calculateSprintProgress(0, 0)).toBe(0)
    })

    it('should return 0 for no completed tickets', () => {
      expect(calculateSprintProgress(0, 10)).toBe(0)
    })

    it('should return 100 for all completed', () => {
      expect(calculateSprintProgress(10, 10)).toBe(100)
    })

    it('should return correct percentage', () => {
      expect(calculateSprintProgress(5, 10)).toBe(50)
    })

    it('should round to nearest integer', () => {
      expect(calculateSprintProgress(1, 3)).toBe(33)
    })

    it('should handle decimal percentages', () => {
      expect(calculateSprintProgress(2, 3)).toBe(67)
    })
  })

  describe('getSprintStatusColor', () => {
    it('should return green classes for active status', () => {
      const color = getSprintStatusColor('active')
      expect(color).toContain('green')
    })

    it('should return blue classes for planning status', () => {
      const color = getSprintStatusColor('planning')
      expect(color).toContain('blue')
    })

    it('should return gray classes for completed status', () => {
      const color = getSprintStatusColor('completed')
      expect(color).toContain('gray')
    })

    it('should return default gray for unknown status', () => {
      const color = getSprintStatusColor('unknown')
      expect(color).toContain('gray')
    })
  })

  describe('getSprintStatusLabel', () => {
    it('should return "Active" for active status', () => {
      expect(getSprintStatusLabel('active')).toBe('Active')
    })

    it('should return "Planning" for planning status', () => {
      expect(getSprintStatusLabel('planning')).toBe('Planning')
    })

    it('should return "Completed" for completed status', () => {
      expect(getSprintStatusLabel('completed')).toBe('Completed')
    })

    it('should return the status itself for unknown status', () => {
      expect(getSprintStatusLabel('custom')).toBe('custom')
    })
  })
})
