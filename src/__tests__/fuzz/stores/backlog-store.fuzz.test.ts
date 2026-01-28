/**
 * Fuzz tests for backlog store invariants.
 * Tests that backlog configuration operations maintain consistency.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKLOG_COLUMNS,
  type BacklogColumn,
  type BacklogColumnId,
  DEFAULT_COLUMNS,
  type SortConfig,
  type SortDirection,
  useBacklogStore,
} from '@/stores/backlog-store'
import { FUZZ_CONFIG } from '../setup'

// Helper to reset store state
function resetStore() {
  useBacklogStore.setState({
    columns: DEFAULT_COLUMNS,
    sort: { column: 'key', direction: 'desc' },
    filterByType: [],
    filterByPriority: [],
    filterByStatus: [],
    filterByAssignee: [],
    filterByLabels: [],
    filterBySprint: null,
    filterByPoints: null,
    filterByDueDate: {
      from: undefined,
      to: undefined,
      includeNone: false,
      includeOverdue: false,
    },
    searchQuery: '',
    showSubtasks: true,
    groupByEpic: false,
    columnConfigOpen: false,
    backlogOrder: {},
  })
}

// Column ID generator
const columnIdArb = fc.constantFrom<BacklogColumnId>(...BACKLOG_COLUMNS)

// Sort direction generator
const sortDirectionArb = fc.constantFrom<SortDirection>('asc', 'desc')

// Ticket type generator
const ticketTypeArb = fc.constantFrom('story', 'bug', 'task', 'epic', 'subtask')

// Priority generator
const priorityArb = fc.constantFrom('critical', 'high', 'medium', 'low')

// Points filter operator
const pointsOperatorArb = fc.constantFrom('<', '>', '=', '<=', '>=')

beforeEach(() => {
  resetStore()
})

describe('Backlog Store Fuzz Tests', () => {
  describe('setColumns', () => {
    it('should store provided columns', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: columnIdArb,
              label: fc.string({ minLength: 1, maxLength: 20 }),
              width: fc.nat({ max: 500 }),
              minWidth: fc.nat({ max: 100 }),
              visible: fc.boolean(),
              sortable: fc.boolean(),
            }),
            { minLength: 1, maxLength: 15 },
          ),
          (columns) => {
            resetStore()
            useBacklogStore.getState().setColumns(columns as BacklogColumn[])

            expect(useBacklogStore.getState().columns.length).toBe(columns.length)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('toggleColumnVisibility', () => {
    it('should flip column visibility', () => {
      fc.assert(
        fc.property(columnIdArb, (columnId) => {
          resetStore()
          const initialColumn = useBacklogStore.getState().columns.find((c) => c.id === columnId)
          if (!initialColumn) return // Skip if column not in defaults

          const initialVisibility = initialColumn.visible

          useBacklogStore.getState().toggleColumnVisibility(columnId)

          const column = useBacklogStore.getState().columns.find((c) => c.id === columnId)
          expect(column?.visible).toBe(!initialVisibility)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent with two toggles', () => {
      fc.assert(
        fc.property(columnIdArb, (columnId) => {
          resetStore()
          const initialColumn = useBacklogStore.getState().columns.find((c) => c.id === columnId)
          if (!initialColumn) return

          const initialVisibility = initialColumn.visible

          useBacklogStore.getState().toggleColumnVisibility(columnId)
          useBacklogStore.getState().toggleColumnVisibility(columnId)

          const column = useBacklogStore.getState().columns.find((c) => c.id === columnId)
          expect(column?.visible).toBe(initialVisibility)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('reorderColumns', () => {
    it('should preserve column count', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: DEFAULT_COLUMNS.length - 1 }),
          fc.nat({ max: DEFAULT_COLUMNS.length - 1 }),
          (fromIndex, toIndex) => {
            resetStore()
            const initialCount = useBacklogStore.getState().columns.length

            useBacklogStore.getState().reorderColumns(fromIndex, toIndex)

            expect(useBacklogStore.getState().columns.length).toBe(initialCount)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should preserve all column ids', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: DEFAULT_COLUMNS.length - 1 }),
          fc.nat({ max: DEFAULT_COLUMNS.length - 1 }),
          (fromIndex, toIndex) => {
            resetStore()
            const initialIds = useBacklogStore
              .getState()
              .columns.map((c) => c.id)
              .sort()

            useBacklogStore.getState().reorderColumns(fromIndex, toIndex)

            const newIds = useBacklogStore
              .getState()
              .columns.map((c) => c.id)
              .sort()
            expect(newIds).toEqual(initialIds)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setColumnWidth', () => {
    it('should set width for specific column', () => {
      fc.assert(
        fc.property(columnIdArb, fc.nat({ max: 1000 }), (columnId, width) => {
          resetStore()

          useBacklogStore.getState().setColumnWidth(columnId, width)

          const column = useBacklogStore.getState().columns.find((c) => c.id === columnId)
          expect(column?.width).toBe(width)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other columns', () => {
      fc.assert(
        fc.property(fc.nat({ max: 500 }), (width) => {
          resetStore()
          const col1 = 'key' as BacklogColumnId
          const col2 = 'title' as BacklogColumnId
          const initialCol2Width = useBacklogStore
            .getState()
            .columns.find((c) => c.id === col2)?.width

          useBacklogStore.getState().setColumnWidth(col1, width)

          const col2Width = useBacklogStore.getState().columns.find((c) => c.id === col2)?.width
          expect(col2Width).toBe(initialCol2Width)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('resetColumns', () => {
    it('should restore default columns', () => {
      fc.assert(
        fc.property(columnIdArb, fc.nat({ max: 500 }), (columnId, width) => {
          resetStore()
          useBacklogStore.getState().setColumnWidth(columnId, width)

          useBacklogStore.getState().resetColumns()

          expect(useBacklogStore.getState().columns).toEqual(DEFAULT_COLUMNS)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('setSort and toggleSort', () => {
    it('setSort should set sort config', () => {
      fc.assert(
        fc.property(columnIdArb, sortDirectionArb, (column, direction) => {
          resetStore()
          const sortConfig: SortConfig = { column, direction }

          useBacklogStore.getState().setSort(sortConfig)

          expect(useBacklogStore.getState().sort).toEqual(sortConfig)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('setSort should accept null', () => {
      resetStore()
      useBacklogStore.getState().setSort(null)

      expect(useBacklogStore.getState().sort).toBeNull()
    })

    it('toggleSort should cycle through directions', () => {
      // Only test with sortable columns
      const sortableColumn = DEFAULT_COLUMNS.find((c) => c.sortable)
      if (!sortableColumn) return

      resetStore()
      useBacklogStore.setState({ sort: null })

      // First toggle: should set to asc
      useBacklogStore.getState().toggleSort(sortableColumn.id)
      expect(useBacklogStore.getState().sort).toEqual({
        column: sortableColumn.id,
        direction: 'asc',
      })

      // Second toggle: should set to desc
      useBacklogStore.getState().toggleSort(sortableColumn.id)
      expect(useBacklogStore.getState().sort).toEqual({
        column: sortableColumn.id,
        direction: 'desc',
      })

      // Third toggle: should clear
      useBacklogStore.getState().toggleSort(sortableColumn.id)
      expect(useBacklogStore.getState().sort).toBeNull()
    })
  })

  describe('filter operations', () => {
    describe('setFilterByType', () => {
      it('should set type filter', () => {
        fc.assert(
          fc.property(fc.uniqueArray(ticketTypeArb, { minLength: 0, maxLength: 5 }), (types) => {
            resetStore()
            useBacklogStore.getState().setFilterByType(types)

            expect(useBacklogStore.getState().filterByType).toEqual(types)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setFilterByPriority', () => {
      it('should set priority filter', () => {
        fc.assert(
          fc.property(fc.uniqueArray(priorityArb, { minLength: 0, maxLength: 4 }), (priorities) => {
            resetStore()
            useBacklogStore.getState().setFilterByPriority(priorities)

            expect(useBacklogStore.getState().filterByPriority).toEqual(priorities)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setFilterByStatus', () => {
      it('should set status filter', () => {
        fc.assert(
          fc.property(fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 10 }), (statuses) => {
            resetStore()
            useBacklogStore.getState().setFilterByStatus(statuses)

            expect(useBacklogStore.getState().filterByStatus).toEqual(statuses)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setFilterByAssignee', () => {
      it('should set assignee filter', () => {
        fc.assert(
          fc.property(fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 10 }), (assignees) => {
            resetStore()
            useBacklogStore.getState().setFilterByAssignee(assignees)

            expect(useBacklogStore.getState().filterByAssignee).toEqual(assignees)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setFilterByLabels', () => {
      it('should set label filter', () => {
        fc.assert(
          fc.property(fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 10 }), (labels) => {
            resetStore()
            useBacklogStore.getState().setFilterByLabels(labels)

            expect(useBacklogStore.getState().filterByLabels).toEqual(labels)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setFilterBySprint', () => {
      it('should set sprint filter', () => {
        fc.assert(
          fc.property(fc.option(fc.uuid(), { nil: null }), (sprintId) => {
            resetStore()
            useBacklogStore.getState().setFilterBySprint(sprintId)

            expect(useBacklogStore.getState().filterBySprint).toBe(sprintId)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setFilterByPoints', () => {
      it('should set points filter', () => {
        fc.assert(
          fc.property(
            fc.option(
              fc.record({
                operator: pointsOperatorArb,
                value: fc.nat({ max: 100 }),
              }),
              { nil: null },
            ),
            (filter) => {
              resetStore()
              useBacklogStore.getState().setFilterByPoints(filter)

              expect(useBacklogStore.getState().filterByPoints).toEqual(filter)
            },
          ),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setSearchQuery', () => {
      it('should set search query', () => {
        fc.assert(
          fc.property(fc.string({ maxLength: 100 }), (query) => {
            resetStore()
            useBacklogStore.getState().setSearchQuery(query)

            expect(useBacklogStore.getState().searchQuery).toBe(query)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('clearFilters', () => {
      it('should reset all filters to defaults', () => {
        fc.assert(
          fc.property(
            fc.uniqueArray(ticketTypeArb, { minLength: 1, maxLength: 3 }),
            fc.uniqueArray(priorityArb, { minLength: 1, maxLength: 2 }),
            fc.string({ minLength: 1, maxLength: 20 }),
            (types, priorities, query) => {
              resetStore()
              useBacklogStore.getState().setFilterByType(types)
              useBacklogStore.getState().setFilterByPriority(priorities)
              useBacklogStore.getState().setSearchQuery(query)

              useBacklogStore.getState().clearFilters()

              const state = useBacklogStore.getState()
              expect(state.filterByType).toEqual([])
              expect(state.filterByPriority).toEqual([])
              expect(state.filterByStatus).toEqual([])
              expect(state.filterByAssignee).toEqual([])
              expect(state.filterByLabels).toEqual([])
              expect(state.filterBySprint).toBeNull()
              expect(state.filterByPoints).toBeNull()
              expect(state.searchQuery).toBe('')
            },
          ),
          FUZZ_CONFIG.standard,
        )
      })

      it('should not affect columns or sorting', () => {
        fc.assert(
          fc.property(columnIdArb, fc.nat({ max: 500 }), (columnId, width) => {
            resetStore()
            useBacklogStore.getState().setColumnWidth(columnId, width)
            const sortConfig: SortConfig = { column: 'title', direction: 'asc' }
            useBacklogStore.getState().setSort(sortConfig)
            useBacklogStore.getState().setFilterByType(['bug'])

            useBacklogStore.getState().clearFilters()

            const column = useBacklogStore.getState().columns.find((c) => c.id === columnId)
            expect(column?.width).toBe(width)
            expect(useBacklogStore.getState().sort).toEqual(sortConfig)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })
  })

  describe('view options', () => {
    describe('setShowSubtasks', () => {
      it('should set showSubtasks', () => {
        fc.assert(
          fc.property(fc.boolean(), (show) => {
            resetStore()
            useBacklogStore.getState().setShowSubtasks(show)

            expect(useBacklogStore.getState().showSubtasks).toBe(show)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setGroupByEpic', () => {
      it('should set groupByEpic', () => {
        fc.assert(
          fc.property(fc.boolean(), (group) => {
            resetStore()
            useBacklogStore.getState().setGroupByEpic(group)

            expect(useBacklogStore.getState().groupByEpic).toBe(group)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })

    describe('setColumnConfigOpen', () => {
      it('should set columnConfigOpen', () => {
        fc.assert(
          fc.property(fc.boolean(), (open) => {
            resetStore()
            useBacklogStore.getState().setColumnConfigOpen(open)

            expect(useBacklogStore.getState().columnConfigOpen).toBe(open)
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })
  })

  describe('backlogOrder', () => {
    it('should set backlog order for project', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 20 }),
          (projectId, ticketIds) => {
            resetStore()
            useBacklogStore.getState().setBacklogOrder(projectId, ticketIds)

            expect(useBacklogStore.getState().backlogOrder[projectId]).toEqual(ticketIds)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should not affect other projects', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (proj1, proj2, order1, order2) => {
            fc.pre(proj1 !== proj2)
            resetStore()

            useBacklogStore.getState().setBacklogOrder(proj1, order1)
            useBacklogStore.getState().setBacklogOrder(proj2, order2)

            expect(useBacklogStore.getState().backlogOrder[proj1]).toEqual(order1)
            expect(useBacklogStore.getState().backlogOrder[proj2]).toEqual(order2)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    describe('clearBacklogOrder', () => {
      it('should clear backlog order for project', () => {
        fc.assert(
          fc.property(
            fc.uuid(),
            fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
            (projectId, ticketIds) => {
              resetStore()
              useBacklogStore.getState().setBacklogOrder(projectId, ticketIds)

              useBacklogStore.getState().clearBacklogOrder(projectId)

              expect(useBacklogStore.getState().backlogOrder[projectId]).toBeUndefined()
            },
          ),
          FUZZ_CONFIG.standard,
        )
      })

      it('should not affect other projects', () => {
        fc.assert(
          fc.property(
            fc.uuid(),
            fc.uuid(),
            fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
            fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 }),
            (proj1, proj2, order1, order2) => {
              fc.pre(proj1 !== proj2)
              resetStore()

              useBacklogStore.getState().setBacklogOrder(proj1, order1)
              useBacklogStore.getState().setBacklogOrder(proj2, order2)

              useBacklogStore.getState().clearBacklogOrder(proj1)

              expect(useBacklogStore.getState().backlogOrder[proj1]).toBeUndefined()
              expect(useBacklogStore.getState().backlogOrder[proj2]).toEqual(order2)
            },
          ),
          FUZZ_CONFIG.standard,
        )
      })

      it('should handle non-existent project gracefully', () => {
        fc.assert(
          fc.property(fc.uuid(), (projectId) => {
            resetStore()

            // Should not throw
            useBacklogStore.getState().clearBacklogOrder(projectId)

            expect(useBacklogStore.getState().backlogOrder[projectId]).toBeUndefined()
          }),
          FUZZ_CONFIG.standard,
        )
      })
    })
  })
})
