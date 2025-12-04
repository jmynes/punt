import { beforeEach, describe, expect, it } from 'vitest'
import { useBacklogStore, DEFAULT_COLUMNS } from '../backlog-store'

describe('Backlog Store', () => {
  beforeEach(() => {
    useBacklogStore.setState({
      columns: DEFAULT_COLUMNS,
      sort: null,
      filterByType: [],
      filterByPriority: [],
      filterByAssignee: [],
      filterBySprint: null,
      searchQuery: '',
      showSubtasks: true,
      groupByEpic: false,
      columnConfigOpen: false,
    })
  })

  describe('Column Configuration', () => {
    it('should initialize with default columns', () => {
      expect(useBacklogStore.getState().columns).toEqual(DEFAULT_COLUMNS)
    })

    it('should toggle column visibility', () => {
      const columnId = 'title'
      const initialVisible = useBacklogStore
        .getState()
        .columns.find((c) => c.id === columnId)?.visible

      useBacklogStore.getState().toggleColumnVisibility(columnId)

      const newVisible = useBacklogStore
        .getState()
        .columns.find((c) => c.id === columnId)?.visible
      expect(newVisible).toBe(!initialVisible)
    })

    it('should reorder columns', () => {
      const initialOrder = useBacklogStore.getState().columns.map((c) => c.id)
      useBacklogStore.getState().reorderColumns(0, 2)

      const newOrder = useBacklogStore.getState().columns.map((c) => c.id)
      expect(newOrder[0]).toBe(initialOrder[1])
      expect(newOrder[2]).toBe(initialOrder[0])
    })

    it('should set column width', () => {
      const columnId = 'title'
      useBacklogStore.getState().setColumnWidth(columnId, 400)

      const column = useBacklogStore.getState().columns.find((c) => c.id === columnId)
      expect(column?.width).toBe(400)
    })

    it('should reset columns to default', () => {
      useBacklogStore.getState().setColumnWidth('title', 500)
      useBacklogStore.getState().resetColumns()

      expect(useBacklogStore.getState().columns).toEqual(DEFAULT_COLUMNS)
    })
  })

  describe('Sorting', () => {
    it('should set sort configuration', () => {
      useBacklogStore.getState().setSort({ column: 'priority', direction: 'desc' })
      expect(useBacklogStore.getState().sort).toEqual({ column: 'priority', direction: 'desc' })
    })

    it('should toggle sort from null to asc', () => {
      useBacklogStore.getState().toggleSort('priority')
      expect(useBacklogStore.getState().sort).toEqual({ column: 'priority', direction: 'asc' })
    })

    it('should toggle sort from asc to desc', () => {
      useBacklogStore.getState().setSort({ column: 'priority', direction: 'asc' })
      useBacklogStore.getState().toggleSort('priority')
      expect(useBacklogStore.getState().sort).toEqual({ column: 'priority', direction: 'desc' })
    })

    it('should toggle sort from desc to null', () => {
      useBacklogStore.getState().setSort({ column: 'priority', direction: 'desc' })
      useBacklogStore.getState().toggleSort('priority')
      expect(useBacklogStore.getState().sort).toBeNull()
    })

    it('should not toggle sort for non-sortable columns', () => {
      const initialSort = useBacklogStore.getState().sort
      useBacklogStore.getState().toggleSort('labels') // labels is not sortable
      expect(useBacklogStore.getState().sort).toEqual(initialSort)
    })
  })

  describe('Filtering', () => {
    it('should set type filter', () => {
      useBacklogStore.getState().setFilterByType(['bug', 'task'])
      expect(useBacklogStore.getState().filterByType).toEqual(['bug', 'task'])
    })

    it('should set priority filter', () => {
      useBacklogStore.getState().setFilterByPriority(['high', 'critical'])
      expect(useBacklogStore.getState().filterByPriority).toEqual(['high', 'critical'])
    })

    it('should set assignee filter', () => {
      useBacklogStore.getState().setFilterByAssignee(['user-1', 'user-2'])
      expect(useBacklogStore.getState().filterByAssignee).toEqual(['user-1', 'user-2'])
    })

    it('should set sprint filter', () => {
      useBacklogStore.getState().setFilterBySprint('sprint-1')
      expect(useBacklogStore.getState().filterBySprint).toBe('sprint-1')
    })

    it('should set search query', () => {
      useBacklogStore.getState().setSearchQuery('test query')
      expect(useBacklogStore.getState().searchQuery).toBe('test query')
    })

    it('should clear all filters', () => {
      useBacklogStore.getState().setFilterByType(['bug'])
      useBacklogStore.getState().setFilterByPriority(['high'])
      useBacklogStore.getState().setFilterByAssignee(['user-1'])
      useBacklogStore.getState().setFilterBySprint('sprint-1')
      useBacklogStore.getState().setSearchQuery('test')

      useBacklogStore.getState().clearFilters()

      expect(useBacklogStore.getState().filterByType).toEqual([])
      expect(useBacklogStore.getState().filterByPriority).toEqual([])
      expect(useBacklogStore.getState().filterByAssignee).toEqual([])
      expect(useBacklogStore.getState().filterBySprint).toBeNull()
      expect(useBacklogStore.getState().searchQuery).toBe('')
    })
  })

  describe('View Options', () => {
    it('should toggle show subtasks', () => {
      const initial = useBacklogStore.getState().showSubtasks
      useBacklogStore.getState().setShowSubtasks(!initial)
      expect(useBacklogStore.getState().showSubtasks).toBe(!initial)
    })

    it('should toggle group by epic', () => {
      const initial = useBacklogStore.getState().groupByEpic
      useBacklogStore.getState().setGroupByEpic(!initial)
      expect(useBacklogStore.getState().groupByEpic).toBe(!initial)
    })

    it('should toggle column config open', () => {
      const initial = useBacklogStore.getState().columnConfigOpen
      useBacklogStore.getState().setColumnConfigOpen(!initial)
      expect(useBacklogStore.getState().columnConfigOpen).toBe(!initial)
    })
  })
})

