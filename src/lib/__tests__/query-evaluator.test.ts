import { describe, expect, it } from 'vitest'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { evaluateQuery } from '../query-evaluator'
import { parse } from '../query-parser'

// ============================================================================
// Test Fixtures
// ============================================================================

const mockColumns: ColumnWithTickets[] = [
  {
    id: 'col-1',
    name: 'To Do',
    order: 0,
    projectId: 'proj-1',
    icon: null,
    color: null,
    tickets: [],
  },
  {
    id: 'col-2',
    name: 'In Progress',
    order: 1,
    projectId: 'proj-1',
    icon: null,
    color: null,
    tickets: [],
  },
  {
    id: 'col-3',
    name: 'Done',
    order: 2,
    projectId: 'proj-1',
    icon: null,
    color: null,
    tickets: [],
  },
]

function createTicket(overrides: Partial<TicketWithRelations> = {}): TicketWithRelations {
  return {
    id: 'ticket-1',
    number: 1,
    title: 'Test ticket',
    description: null,
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: null,
    estimate: null,
    startDate: null,
    dueDate: null,
    resolution: null,
    resolvedAt: null,
    environment: null,
    affectedVersion: null,
    fixVersion: null,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-01'),
    projectId: 'proj-1',
    columnId: 'col-1',
    assigneeId: null,
    creatorId: 'user-1',
    sprintId: null,
    parentId: null,
    isCarriedOver: false,
    carriedFromSprintId: null,
    carriedOverCount: 0,
    assignee: null,
    creator: {
      id: 'user-1',
      username: 'admin',
      name: 'Admin',
      email: 'admin@test.com',
      avatar: null,
    },
    sprint: null,
    carriedFromSprint: null,
    labels: [],
    watchers: [],
    ...overrides,
  } as TicketWithRelations
}

const tickets: TicketWithRelations[] = [
  createTicket({
    id: 't1',
    number: 1,
    title: 'Fix login bug',
    type: 'bug',
    priority: 'high',
    columnId: 'col-1',
    storyPoints: 3,
    assignee: {
      id: 'u1',
      username: 'jordan',
      name: 'Jordan',
      email: 'j@test.com',
      avatar: null,
    },
    assigneeId: 'u1',
    sprint: { id: 's1', name: 'Sprint 1', status: 'active', startDate: null, endDate: null },
    sprintId: 's1',
    labels: [{ id: 'l1', name: 'frontend', color: '#3b82f6' }],
    dueDate: new Date('2024-12-31'),
    createdAt: new Date('2024-11-01'),
  }),
  createTicket({
    id: 't2',
    number: 2,
    title: 'Add dashboard feature',
    type: 'story',
    priority: 'medium',
    columnId: 'col-2',
    storyPoints: 8,
    assignee: {
      id: 'u2',
      username: 'alex',
      name: 'Alex',
      email: 'a@test.com',
      avatar: null,
    },
    assigneeId: 'u2',
    sprint: { id: 's1', name: 'Sprint 1', status: 'active', startDate: null, endDate: null },
    sprintId: 's1',
    labels: [
      { id: 'l1', name: 'frontend', color: '#3b82f6' },
      { id: 'l2', name: 'backend', color: '#10b981' },
    ],
    createdAt: new Date('2024-11-10'),
  }),
  createTicket({
    id: 't3',
    number: 3,
    title: 'Update docs',
    type: 'task',
    priority: 'low',
    columnId: 'col-3',
    storyPoints: 1,
    resolution: 'Done',
    resolvedAt: new Date('2024-11-15'),
    createdAt: new Date('2024-10-01'),
  }),
  createTicket({
    id: 't4',
    number: 4,
    title: 'Critical production issue',
    type: 'bug',
    priority: 'critical',
    columnId: 'col-1',
    storyPoints: 5,
    assignee: {
      id: 'u1',
      username: 'jordan',
      name: 'Jordan',
      email: 'j@test.com',
      avatar: null,
    },
    assigneeId: 'u1',
    sprint: { id: 's2', name: 'Sprint 2', status: 'planning', startDate: null, endDate: null },
    sprintId: 's2',
    labels: [{ id: 'l3', name: 'urgent', color: '#ef4444' }],
    dueDate: new Date('2024-11-20'),
    createdAt: new Date('2024-11-15'),
  }),
  createTicket({
    id: 't5',
    number: 5,
    title: 'Refactor auth module',
    type: 'subtask',
    priority: 'medium',
    columnId: 'col-2',
    parentId: 'parent-1',
    createdAt: new Date('2024-11-20'),
  }),
]

function query(input: string): TicketWithRelations[] {
  const ast = parse(input)
  return evaluateQuery(ast, tickets, mockColumns, 'TEST')
}

// ============================================================================
// Tests
// ============================================================================

describe('evaluateQuery', () => {
  describe('field comparisons', () => {
    it('filters by type', () => {
      const result = query('type = bug')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })

    it('filters by priority', () => {
      const result = query('priority = high')
      expect(result.map((t) => t.id)).toEqual(['t1'])
    })

    it('filters by priority with greater than', () => {
      // low < medium < high < critical
      const result = query('priority > medium')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4']) // high, critical
    })

    it('filters by priority with less than', () => {
      const result = query('priority < high')
      expect(result.map((t) => t.id)).toEqual(['t2', 't3', 't5']) // medium, low, medium
    })

    it('filters by priority with greater or equal', () => {
      const result = query('priority >= high')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4']) // high, critical
    })

    it('filters by priority with less or equal', () => {
      const result = query('priority <= medium')
      expect(result.map((t) => t.id)).toEqual(['t2', 't3', 't5']) // medium, low, medium
    })

    it('filters by status (column name)', () => {
      const result = query('status = "To Do"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })

    it('filters by assignee name', () => {
      const result = query('assignee = "Jordan"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })

    it('filters by sprint name', () => {
      const result = query('sprint = "Sprint 1"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
    })

    it('filters by sprint with greater than', () => {
      // Sprint 1 < Sprint 2 (natural sort)
      const result = query('sprint > "Sprint 1"')
      expect(result.map((t) => t.id)).toEqual(['t4']) // Sprint 2
    })

    it('filters by sprint with less than', () => {
      const result = query('sprint < "Sprint 2"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2']) // Sprint 1
    })

    it('filters by sprint with greater or equal', () => {
      const result = query('sprint >= "Sprint 1"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't4']) // Sprint 1, Sprint 2
    })

    it('filters by sprint with less or equal', () => {
      const result = query('sprint <= "Sprint 1"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2']) // Sprint 1
    })

    it('filters by story points', () => {
      const result = query('storyPoints >= 5')
      expect(result.map((t) => t.id)).toEqual(['t2', 't4'])
    })

    it('filters by resolution', () => {
      const result = query('resolution = "Done"')
      expect(result.map((t) => t.id)).toEqual(['t3'])
    })

    it('filters by title', () => {
      const result = query('title = "Fix login bug"')
      expect(result.map((t) => t.id)).toEqual(['t1'])
    })

    it('filters by key', () => {
      const result = query('key = "TEST-1"')
      expect(result.map((t) => t.id)).toEqual(['t1'])
    })
  })

  describe('not-equal comparisons', () => {
    it('filters with !=', () => {
      const result = query('type != bug')
      expect(result.map((t) => t.id)).toEqual(['t2', 't3', 't5'])
    })

    it('handles null fields with !=', () => {
      // assignee IS null for t3, t5 - != "Jordan" should include those
      const result = query('assignee != "Jordan"')
      expect(result).toContainEqual(expect.objectContaining({ id: 't2' }))
      expect(result).toContainEqual(expect.objectContaining({ id: 't3' }))
      expect(result).toContainEqual(expect.objectContaining({ id: 't5' }))
    })
  })

  describe('numeric comparisons', () => {
    it('filters with >', () => {
      const result = query('storyPoints > 3')
      expect(result.map((t) => t.id)).toEqual(['t2', 't4'])
    })

    it('filters with <', () => {
      const result = query('storyPoints < 3')
      expect(result.map((t) => t.id)).toEqual(['t3'])
    })

    it('filters with <=', () => {
      const result = query('storyPoints <= 3')
      expect(result.map((t) => t.id)).toEqual(['t1', 't3'])
    })
  })

  describe('logical operators', () => {
    it('filters with AND', () => {
      const result = query('type = bug AND priority = critical')
      expect(result.map((t) => t.id)).toEqual(['t4'])
    })

    it('filters with OR', () => {
      const result = query('priority = high OR priority = critical')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })

    it('filters with NOT', () => {
      const result = query('NOT type = subtask')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4'])
    })

    it('handles complex AND/OR combinations', () => {
      const result = query('(type = bug OR type = story) AND sprint = "Sprint 1"')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
    })

    it('handles implicit AND', () => {
      const result = query('type = bug priority = high')
      expect(result.map((t) => t.id)).toEqual(['t1'])
    })
  })

  describe('IN operator', () => {
    it('filters with IN', () => {
      const result = query('type IN (bug, story)')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't4'])
    })

    it('filters with NOT IN', () => {
      const result = query('type NOT IN (subtask, task)')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't4'])
    })

    it('handles IN with quoted strings', () => {
      const result = query('assignee IN ("Jordan", "Alex")')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't4'])
    })

    it('handles IN with numbers', () => {
      const result = query('storyPoints IN (1, 3, 5)')
      expect(result.map((t) => t.id)).toEqual(['t1', 't3', 't4'])
    })
  })

  describe('IS EMPTY / IS NOT EMPTY', () => {
    it('finds tickets with null assignee', () => {
      const result = query('assignee IS EMPTY')
      expect(result.map((t) => t.id)).toEqual(['t3', 't5'])
    })

    it('finds tickets with non-null assignee', () => {
      const result = query('assignee IS NOT EMPTY')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't4'])
    })

    it('finds tickets without sprint', () => {
      const result = query('sprint IS EMPTY')
      expect(result.map((t) => t.id)).toEqual(['t3', 't5'])
    })

    it('finds tickets without labels', () => {
      const result = query('labels IS EMPTY')
      expect(result.map((t) => t.id)).toEqual(
        ['t2', 't3', 't5'].filter((id) => {
          const t = tickets.find((x) => x.id === id)
          return t && t.labels.length === 0
        }),
      )
    })
  })

  describe('labels (array field)', () => {
    it('filters by label name', () => {
      const result = query('labels = frontend')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
    })

    it('handles != for labels', () => {
      const result = query('labels != frontend')
      // Tickets with labels that don't include "frontend" (empty labels excluded)
      expect(result.map((t) => t.id)).toEqual(['t4'])
    })

    it('handles IN for labels', () => {
      const result = query('labels IN (urgent, backend)')
      expect(result.map((t) => t.id)).toEqual(['t2', 't4'])
    })
  })

  describe('date comparisons', () => {
    it('filters by due date', () => {
      const result = query('dueDate < 2024-12-01')
      expect(result.map((t) => t.id)).toEqual(['t4'])
    })

    it('filters with null due dates (returns false for comparisons)', () => {
      const result = query('dueDate > 2024-01-01')
      // Only t1 and t4 have due dates
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })
  })

  describe('case insensitivity', () => {
    it('matches field values case-insensitively', () => {
      const result = query('type = BUG')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })

    it('matches IN values case-insensitively', () => {
      const result = query('priority IN (HIGH, CRITICAL)')
      expect(result.map((t) => t.id)).toEqual(['t1', 't4'])
    })
  })

  describe('edge cases', () => {
    it('handles empty ticket list', () => {
      const ast = parse('type = bug')
      const result = evaluateQuery(ast, [], mockColumns, 'TEST')
      expect(result).toEqual([])
    })

    it('handles unknown field gracefully', () => {
      const result = query('unknown = value')
      // Unknown fields return null, so only != matches
      expect(result).toEqual([])
    })
  })
})
