import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { useBoardStore } from '../board-store'

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as unknown as Storage

const PROJECT_ID = 'test-project'

describe('Board Store — sync / collapse / sort / hydration', () => {
  beforeEach(() => {
    useBoardStore.setState({
      projects: {},
      searchQueries: {},
      collapsedColumns: {},
      columnSorts: {},
      _hasHydrated: true,
    })
    vi.clearAllMocks()
  })

  describe('syncTicketsFromAPI', () => {
    it('groups tickets into their columns, sorted by order', () => {
      useBoardStore.setState({
        projects: {
          [PROJECT_ID]: [
            { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: [] },
            { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
          ],
        },
      })

      useBoardStore
        .getState()
        .syncTicketsFromAPI(PROJECT_ID, [
          createMockTicket({ id: 'a', columnId: 'col-1', order: 1 }),
          createMockTicket({ id: 'b', columnId: 'col-1', order: 0 }),
          createMockTicket({ id: 'c', columnId: 'col-2', order: 0 }),
        ])

      const cols = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(cols[0].tickets.map((t) => t.id)).toEqual(['b', 'a']) // sorted by order
      expect(cols[1].tickets.map((t) => t.id)).toEqual(['c'])
    })

    it('falls back to default columns when the project has none', () => {
      useBoardStore.getState().syncTicketsFromAPI(PROJECT_ID, [])
      const cols = useBoardStore.getState().getColumns(PROJECT_ID)
      expect(cols.length).toBeGreaterThan(0)
      expect(cols[0].name).toBe('To Do')
    })

    it('empties columns that have no incoming tickets', () => {
      useBoardStore.setState({
        projects: {
          [PROJECT_ID]: [
            {
              id: 'col-1',
              name: 'To Do',
              order: 0,
              projectId: PROJECT_ID,
              tickets: [createMockTicket({ id: 'stale', columnId: 'col-1' })],
            },
          ],
        },
      })
      useBoardStore.getState().syncTicketsFromAPI(PROJECT_ID, [])
      expect(useBoardStore.getState().getColumns(PROJECT_ID)[0].tickets).toEqual([])
    })
  })

  describe('column collapse', () => {
    it('defaults to not collapsed', () => {
      expect(useBoardStore.getState().isColumnCollapsed('col-1')).toBe(false)
    })

    it('toggles collapsed state', () => {
      useBoardStore.getState().toggleColumnCollapsed('col-1')
      expect(useBoardStore.getState().isColumnCollapsed('col-1')).toBe(true)
      useBoardStore.getState().toggleColumnCollapsed('col-1')
      expect(useBoardStore.getState().isColumnCollapsed('col-1')).toBe(false)
    })

    it('sets collapsed state explicitly', () => {
      useBoardStore.getState().setColumnCollapsed('col-1', true)
      expect(useBoardStore.getState().isColumnCollapsed('col-1')).toBe(true)
      useBoardStore.getState().setColumnCollapsed('col-1', false)
      expect(useBoardStore.getState().isColumnCollapsed('col-1')).toBe(false)
    })
  })

  describe('column sorts', () => {
    it('defaults to manual', () => {
      expect(useBoardStore.getState().getColumnSort('col-1')).toBe('manual')
    })

    it('sets and reads a column sort', () => {
      useBoardStore.getState().setColumnSort('col-1', 'priority')
      expect(useBoardStore.getState().getColumnSort('col-1')).toBe('priority')
    })

    it('keeps column sorts independent and clears them all', () => {
      useBoardStore.getState().setColumnSort('col-1', 'priority')
      useBoardStore.getState().setColumnSort('col-2', 'dueDate')
      expect(useBoardStore.getState().getColumnSort('col-2')).toBe('dueDate')
      useBoardStore.getState().clearAllColumnSorts()
      expect(useBoardStore.getState().getColumnSort('col-1')).toBe('manual')
      expect(useBoardStore.getState().getColumnSort('col-2')).toBe('manual')
    })
  })

  describe('hydration flag', () => {
    it('setHasHydrated updates the flag', () => {
      useBoardStore.getState().setHasHydrated(false)
      expect(useBoardStore.getState()._hasHydrated).toBe(false)
      useBoardStore.getState().setHasHydrated(true)
      expect(useBoardStore.getState()._hasHydrated).toBe(true)
    })
  })

  describe('getSearchQuery', () => {
    it('returns the stored query and empty string for unknown projects', () => {
      useBoardStore.getState().setSearchQuery(PROJECT_ID, 'hello')
      expect(useBoardStore.getState().getSearchQuery(PROJECT_ID)).toBe('hello')
      expect(useBoardStore.getState().getSearchQuery('unknown')).toBe('')
    })
  })
})
