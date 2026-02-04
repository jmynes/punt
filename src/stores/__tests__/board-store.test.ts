import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockColumns, createMockTicket } from '@/__tests__/utils/mocks'
import { useBoardStore } from '../board-store'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as unknown as Storage

const PROJECT_ID = 'test-project-1'

describe('Board Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useBoardStore.setState({
      projects: {
        [PROJECT_ID]: createMockColumns(),
      },
      _hasHydrated: true,
      searchQueries: {},
    })
    vi.clearAllMocks()
  })

  describe('getColumns', () => {
    it('should return columns for a project', () => {
      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns).toHaveLength(4) // Default mock columns: To Do, In Progress, Review, Done
    })

    it('should return default columns for unknown project', () => {
      const columns = useBoardStore.getState().getColumns('unknown-project')
      expect(columns).toHaveLength(4) // Default columns
      expect(columns[0].name).toBe('To Do')
    })
  })

  describe('setColumns', () => {
    it('should update columns for a project', () => {
      const newColumns = createMockColumns()
      useBoardStore.getState().setColumns(PROJECT_ID, newColumns)
      expect(useBoardStore.getState().getColumns(PROJECT_ID)).toEqual(newColumns)
    })
  })

  describe('setSearchQuery', () => {
    it('should update search query for a project', () => {
      useBoardStore.getState().setSearchQuery(PROJECT_ID, 'test query')
      expect(useBoardStore.getState().getSearchQuery(PROJECT_ID)).toBe('test query')
    })

    it('should return empty string for unknown project', () => {
      expect(useBoardStore.getState().getSearchQuery('unknown')).toBe('')
    })
  })

  describe('moveTicket', () => {
    it('should move a ticket from one column to another', () => {
      const ticket = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [ticket] },
        { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().moveTicket(PROJECT_ID, 'ticket-1', 'col-1', 'col-2', 0)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(0)
      expect(columns[1].tickets).toHaveLength(1)
      expect(columns[1].tickets[0].id).toBe('ticket-1')
      expect(columns[1].tickets[0].columnId).toBe('col-2')
      expect(columns[1].tickets[0].order).toBe(0)
    })

    it('should update order when moving to a specific position', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-1', order: 1 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
        { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().moveTicket(PROJECT_ID, 'ticket-1', 'col-1', 'col-2', 0)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(1)
      expect(columns[0].tickets[0].id).toBe('ticket-2')
      expect(columns[1].tickets[0].order).toBe(0)
    })
  })

  describe('moveTickets', () => {
    it('should move multiple tickets from one column to another', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-1', order: 1 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
        { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().moveTickets(PROJECT_ID, ['ticket-1', 'ticket-2'], 'col-2', 0)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(0)
      expect(columns[1].tickets).toHaveLength(2)
      expect(columns[1].tickets[0].id).toBe('ticket-1')
      expect(columns[1].tickets[1].id).toBe('ticket-2')
    })

    it('should move tickets from multiple columns to one column', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-2', order: 0 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [ticket1] },
        { id: 'col-2', name: 'In Progress', order: 1, projectId: PROJECT_ID, tickets: [ticket2] },
        { id: 'col-3', name: 'Done', order: 2, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().moveTickets(PROJECT_ID, ['ticket-1', 'ticket-2'], 'col-3', 0)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(0)
      expect(columns[1].tickets).toHaveLength(0)
      expect(columns[2].tickets).toHaveLength(2)
    })
  })

  describe('reorderTicket', () => {
    it('should reorder a ticket within the same column', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-1', order: 1 })
      const ticket3 = createMockTicket({ id: 'ticket-3', columnId: 'col-1', order: 2 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2, ticket3],
        },
      ])

      useBoardStore.getState().reorderTicket(PROJECT_ID, 'col-1', 'ticket-1', 2)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].id).toBe('ticket-2')
      expect(columns[0].tickets[1].id).toBe('ticket-3')
      expect(columns[0].tickets[2].id).toBe('ticket-1')
      expect(columns[0].tickets.map((t) => t.order)).toEqual([0, 1, 2])
    })

    it('should not change order if ticket is already at target index', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      useBoardStore
        .getState()
        .setColumns(PROJECT_ID, [
          { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [ticket1] },
        ])

      const before = useBoardStore.getState().getColumns(PROJECT_ID)[0].tickets
      useBoardStore.getState().reorderTicket(PROJECT_ID, 'col-1', 'ticket-1', 0)
      const after = useBoardStore.getState().getColumns(PROJECT_ID)[0].tickets

      expect(after).toEqual(before)
    })
  })

  describe('reorderTickets', () => {
    it('should reorder multiple tickets within the same column', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-1', order: 1 })
      const ticket3 = createMockTicket({ id: 'ticket-3', columnId: 'col-1', order: 2 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2, ticket3],
        },
      ])

      useBoardStore.getState().reorderTickets(PROJECT_ID, 'col-1', ['ticket-1', 'ticket-2'], 2)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].id).toBe('ticket-1')
      expect(columns[0].tickets[1].id).toBe('ticket-2')
      expect(columns[0].tickets[2].id).toBe('ticket-3')
    })
  })

  describe('updateTicket', () => {
    it('should update a ticket', () => {
      const ticket = createMockTicket({ id: 'ticket-1', title: 'Old Title' })
      useBoardStore
        .getState()
        .setColumns(PROJECT_ID, [
          { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [ticket] },
        ])

      useBoardStore.getState().updateTicket(PROJECT_ID, 'ticket-1', { title: 'New Title' })

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].title).toBe('New Title')
    })

    it('should not affect other tickets', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', title: 'Ticket 1' })
      const ticket2 = createMockTicket({ id: 'ticket-2', title: 'Ticket 2' })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
      ])

      useBoardStore.getState().updateTicket(PROJECT_ID, 'ticket-1', { title: 'Updated' })

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].title).toBe('Updated')
      expect(columns[0].tickets[1].title).toBe('Ticket 2')
    })
  })

  describe('updateTickets', () => {
    it('should update multiple tickets in a single state change', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', title: 'Ticket 1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', title: 'Ticket 2', order: 1 })
      const ticket3 = createMockTicket({ id: 'ticket-3', title: 'Ticket 3', order: 2 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2, ticket3],
        },
      ])

      useBoardStore.getState().updateTickets(PROJECT_ID, [
        { ticketId: 'ticket-1', updates: { title: 'Updated 1' } },
        { ticketId: 'ticket-2', updates: { title: 'Updated 2' } },
        { ticketId: 'ticket-3', updates: { title: 'Updated 3' } },
      ])

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].title).toBe('Updated 1')
      expect(columns[0].tickets[1].title).toBe('Updated 2')
      expect(columns[0].tickets[2].title).toBe('Updated 3')
    })

    it('should update sprintId and order for multiple tickets', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', sprintId: 'sprint-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', sprintId: 'sprint-1', order: 1 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
      ])

      useBoardStore.getState().updateTickets(PROJECT_ID, [
        { ticketId: 'ticket-1', updates: { sprintId: null, order: 5 } },
        { ticketId: 'ticket-2', updates: { sprintId: null, order: 6 } },
      ])

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].sprintId).toBeNull()
      expect(columns[0].tickets[0].order).toBe(5)
      expect(columns[0].tickets[1].sprintId).toBeNull()
      expect(columns[0].tickets[1].order).toBe(6)
    })

    it('should handle empty updates array', () => {
      const ticket = createMockTicket({ id: 'ticket-1', title: 'Original' })
      useBoardStore
        .getState()
        .setColumns(PROJECT_ID, [
          { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [ticket] },
        ])

      useBoardStore.getState().updateTickets(PROJECT_ID, [])

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].title).toBe('Original')
    })

    it('should handle column changes for multiple tickets', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', order: 0 })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-1', order: 1 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
        { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().updateTickets(PROJECT_ID, [
        { ticketId: 'ticket-1', updates: { columnId: 'col-2', order: 0 } },
        { ticketId: 'ticket-2', updates: { columnId: 'col-2', order: 1 } },
      ])

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(0)
      expect(columns[1].tickets).toHaveLength(2)
      expect(columns[1].tickets[0].id).toBe('ticket-1')
      expect(columns[1].tickets[1].id).toBe('ticket-2')
    })

    it('should handle mixed updates (some with column change, some without)', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', columnId: 'col-1', title: 'T1' })
      const ticket2 = createMockTicket({ id: 'ticket-2', columnId: 'col-1', title: 'T2' })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
        { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().updateTickets(PROJECT_ID, [
        { ticketId: 'ticket-1', updates: { columnId: 'col-2', order: 0 } }, // Column change
        { ticketId: 'ticket-2', updates: { title: 'Updated T2' } }, // No column change
      ])

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(1)
      expect(columns[0].tickets[0].id).toBe('ticket-2')
      expect(columns[0].tickets[0].title).toBe('Updated T2')
      expect(columns[1].tickets).toHaveLength(1)
      expect(columns[1].tickets[0].id).toBe('ticket-1')
    })

    it('should skip updates for non-existent tickets', () => {
      const ticket = createMockTicket({ id: 'ticket-1', title: 'Original' })
      useBoardStore
        .getState()
        .setColumns(PROJECT_ID, [
          { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [ticket] },
        ])

      // Should not throw
      useBoardStore.getState().updateTickets(PROJECT_ID, [
        { ticketId: 'ticket-1', updates: { title: 'Updated' } },
        { ticketId: 'non-existent', updates: { title: 'Ignored' } },
      ])

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets[0].title).toBe('Updated')
    })
  })

  describe('addTicket', () => {
    it('should add a ticket to the specified column', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useBoardStore
        .getState()
        .setColumns(PROJECT_ID, [
          { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [] },
        ])

      useBoardStore.getState().addTicket(PROJECT_ID, 'col-1', ticket)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(1)
      expect(columns[0].tickets[0].id).toBe('ticket-1')
    })

    it('should not add to other columns', () => {
      const ticket = createMockTicket({ id: 'ticket-1' })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [] },
        { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
      ])

      useBoardStore.getState().addTicket(PROJECT_ID, 'col-1', ticket)

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(1)
      expect(columns[1].tickets).toHaveLength(0)
    })
  })

  describe('removeTicket', () => {
    it('should remove a ticket from any column', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1' })
      const ticket2 = createMockTicket({ id: 'ticket-2' })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
      ])

      useBoardStore.getState().removeTicket(PROJECT_ID, 'ticket-1')

      const columns = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(columns[0].tickets).toHaveLength(1)
      expect(columns[0].tickets[0].id).toBe('ticket-2')
    })
  })

  describe('getNextTicketNumber', () => {
    it('should return 1 for empty project', () => {
      useBoardStore
        .getState()
        .setColumns(PROJECT_ID, [
          { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [] },
        ])

      const nextNumber = useBoardStore.getState().getNextTicketNumber(PROJECT_ID)
      expect(nextNumber).toBe(1)
    })

    it('should return max + 1 for project with tickets', () => {
      const ticket1 = createMockTicket({ id: 'ticket-1', number: 5 })
      const ticket2 = createMockTicket({ id: 'ticket-2', number: 3 })
      useBoardStore.getState().setColumns(PROJECT_ID, [
        {
          id: 'col-1',
          name: 'To Do',
          order: 0,
          projectId: PROJECT_ID,
          tickets: [ticket1, ticket2],
        },
      ])

      const nextNumber = useBoardStore.getState().getNextTicketNumber(PROJECT_ID)
      expect(nextNumber).toBe(6)
    })
  })

  describe('persistence', () => {
    it('should persist columns to localStorage', async () => {
      const columns = createMockColumns()
      useBoardStore.getState().setColumns(PROJECT_ID, columns)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(useBoardStore.getState().getColumns(PROJECT_ID)).toEqual(columns)
    })
  })
})
