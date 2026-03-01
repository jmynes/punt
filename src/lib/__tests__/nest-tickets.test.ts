import { describe, expect, it } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { nestTickets } from '../nest-tickets'

describe('nestTickets', () => {
  it('should return tickets as-is when there are no parent-child relationships', () => {
    const tickets = [
      createMockTicket({ id: 't1', number: 1 }),
      createMockTicket({ id: 't2', number: 2 }),
      createMockTicket({ id: 't3', number: 3 }),
    ]

    const result = nestTickets(tickets, new Set())

    expect(result).toHaveLength(3)
    expect(result[0].ticket.id).toBe('t1')
    expect(result[1].ticket.id).toBe('t2')
    expect(result[2].ticket.id).toBe('t3')
    expect(result.every((e) => !e.isNested && e.depth === 0)).toBe(true)
  })

  it('should place subtasks after their parent', () => {
    const parent = createMockTicket({ id: 'parent', number: 1 })
    const subtask = createMockTicket({
      id: 'subtask',
      number: 2,
      type: 'subtask',
      parentId: 'parent',
    })
    const other = createMockTicket({ id: 'other', number: 3 })

    // Order: parent, other, subtask (subtask originally between other tickets)
    const tickets = [parent, other, subtask]

    const result = nestTickets(tickets, new Set())

    expect(result).toHaveLength(3)
    // Parent first, then its subtask, then the standalone ticket
    expect(result[0].ticket.id).toBe('parent')
    expect(result[0].isNested).toBe(false)
    expect(result[0].hasChildren).toBe(true)
    expect(result[0].childCount).toBe(1)

    expect(result[1].ticket.id).toBe('subtask')
    expect(result[1].isNested).toBe(true)
    expect(result[1].depth).toBe(1)

    expect(result[2].ticket.id).toBe('other')
    expect(result[2].isNested).toBe(false)
  })

  it('should handle multiple subtasks under one parent', () => {
    const parent = createMockTicket({ id: 'parent', number: 1 })
    const sub1 = createMockTicket({
      id: 'sub1',
      number: 2,
      type: 'subtask',
      parentId: 'parent',
    })
    const sub2 = createMockTicket({
      id: 'sub2',
      number: 3,
      type: 'subtask',
      parentId: 'parent',
    })

    const tickets = [parent, sub1, sub2]

    const result = nestTickets(tickets, new Set())

    expect(result).toHaveLength(3)
    expect(result[0].ticket.id).toBe('parent')
    expect(result[0].childCount).toBe(2)
    expect(result[1].ticket.id).toBe('sub1')
    expect(result[1].isNested).toBe(true)
    expect(result[2].ticket.id).toBe('sub2')
    expect(result[2].isNested).toBe(true)
  })

  it('should hide subtasks when parent is collapsed', () => {
    const parent = createMockTicket({ id: 'parent', number: 1 })
    const sub1 = createMockTicket({
      id: 'sub1',
      number: 2,
      type: 'subtask',
      parentId: 'parent',
    })
    const sub2 = createMockTicket({
      id: 'sub2',
      number: 3,
      type: 'subtask',
      parentId: 'parent',
    })

    const tickets = [parent, sub1, sub2]

    const result = nestTickets(tickets, new Set(['parent']))

    expect(result).toHaveLength(1)
    expect(result[0].ticket.id).toBe('parent')
    expect(result[0].hasChildren).toBe(true)
    expect(result[0].childCount).toBe(2)
  })

  it('should keep subtasks at top level when parent is NOT in the list', () => {
    const subtask = createMockTicket({
      id: 'subtask',
      number: 2,
      type: 'subtask',
      parentId: 'missing-parent',
    })
    const other = createMockTicket({ id: 'other', number: 3 })

    const tickets = [subtask, other]

    const result = nestTickets(tickets, new Set())

    expect(result).toHaveLength(2)
    // Subtask stays at top level since parent isn't in the list
    expect(result[0].ticket.id).toBe('subtask')
    expect(result[0].isNested).toBe(false)
    expect(result[0].depth).toBe(0)
    expect(result[1].ticket.id).toBe('other')
  })

  it('should handle empty list', () => {
    const result = nestTickets([], new Set())
    expect(result).toHaveLength(0)
  })

  it('should handle multiple parents with their subtasks', () => {
    const parent1 = createMockTicket({ id: 'p1', number: 1 })
    const parent2 = createMockTicket({ id: 'p2', number: 2 })
    const sub1 = createMockTicket({
      id: 's1',
      number: 3,
      type: 'subtask',
      parentId: 'p1',
    })
    const sub2 = createMockTicket({
      id: 's2',
      number: 4,
      type: 'subtask',
      parentId: 'p2',
    })

    // Interleaved: parent1, parent2, sub2, sub1
    const tickets = [parent1, parent2, sub2, sub1]

    const result = nestTickets(tickets, new Set())

    expect(result).toHaveLength(4)
    expect(result[0].ticket.id).toBe('p1')
    expect(result[0].hasChildren).toBe(true)
    expect(result[1].ticket.id).toBe('s1')
    expect(result[1].isNested).toBe(true)
    expect(result[2].ticket.id).toBe('p2')
    expect(result[2].hasChildren).toBe(true)
    expect(result[3].ticket.id).toBe('s2')
    expect(result[3].isNested).toBe(true)
  })

  it('should selectively collapse only specified parents', () => {
    const parent1 = createMockTicket({ id: 'p1', number: 1 })
    const parent2 = createMockTicket({ id: 'p2', number: 2 })
    const sub1 = createMockTicket({
      id: 's1',
      number: 3,
      type: 'subtask',
      parentId: 'p1',
    })
    const sub2 = createMockTicket({
      id: 's2',
      number: 4,
      type: 'subtask',
      parentId: 'p2',
    })

    const tickets = [parent1, parent2, sub1, sub2]

    // Collapse only parent1
    const result = nestTickets(tickets, new Set(['p1']))

    expect(result).toHaveLength(3)
    expect(result[0].ticket.id).toBe('p1')
    expect(result[0].hasChildren).toBe(true)
    // s1 is hidden (p1 collapsed)
    expect(result[1].ticket.id).toBe('p2')
    expect(result[1].hasChildren).toBe(true)
    expect(result[2].ticket.id).toBe('s2')
    expect(result[2].isNested).toBe(true)
  })
})
