import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// All available columns that can be displayed in the backlog
export const BACKLOG_COLUMNS = [
  'key',
  'type',
  'title',
  'status',
  'priority',
  'assignee',
  'reporter',
  'labels',
  'sprint',
  'storyPoints',
  'estimate',
  'dueDate',
  'created',
  'updated',
  'parent',
] as const

export type BacklogColumnId = (typeof BACKLOG_COLUMNS)[number]

export interface BacklogColumn {
  id: BacklogColumnId
  label: string
  width: number // in pixels, 0 = auto
  minWidth: number
  visible: boolean
  sortable: boolean
}

// Default column configuration
export const DEFAULT_COLUMNS: BacklogColumn[] = [
  { id: 'type', label: 'Type', width: 40, minWidth: 40, visible: true, sortable: true },
  { id: 'key', label: 'Key', width: 100, minWidth: 80, visible: true, sortable: true },
  { id: 'title', label: 'Summary', width: 300, minWidth: 200, visible: true, sortable: true },
  { id: 'status', label: 'Status', width: 120, minWidth: 100, visible: true, sortable: true },
  { id: 'priority', label: 'Priority', width: 100, minWidth: 80, visible: true, sortable: true },
  { id: 'assignee', label: 'Assignee', width: 140, minWidth: 100, visible: true, sortable: true },
  { id: 'reporter', label: 'Reporter', width: 140, minWidth: 100, visible: false, sortable: true },
  { id: 'labels', label: 'Labels', width: 150, minWidth: 100, visible: false, sortable: false },
  { id: 'sprint', label: 'Sprint', width: 120, minWidth: 100, visible: true, sortable: true },
  {
    id: 'storyPoints',
    label: 'Points',
    width: 70,
    minWidth: 60,
    visible: true,
    sortable: true,
  },
  { id: 'estimate', label: 'Estimate', width: 90, minWidth: 70, visible: false, sortable: true },
  { id: 'dueDate', label: 'Due Date', width: 110, minWidth: 100, visible: true, sortable: true },
  { id: 'created', label: 'Created', width: 110, minWidth: 100, visible: false, sortable: true },
  { id: 'updated', label: 'Updated', width: 110, minWidth: 100, visible: false, sortable: true },
  { id: 'parent', label: 'Parent', width: 120, minWidth: 100, visible: false, sortable: true },
]

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  column: BacklogColumnId
  direction: SortDirection
}

interface BacklogState {
  // Column configuration
  columns: BacklogColumn[]
  setColumns: (columns: BacklogColumn[]) => void
  toggleColumnVisibility: (columnId: BacklogColumnId) => void
  reorderColumns: (fromIndex: number, toIndex: number) => void
  setColumnWidth: (columnId: BacklogColumnId, width: number) => void
  resetColumns: () => void

  // Sorting
  sort: SortConfig | null
  setSort: (sort: SortConfig | null) => void
  toggleSort: (columnId: BacklogColumnId) => void

  // Filtering
  filterByType: string[]
  setFilterByType: (types: string[]) => void
  filterByPriority: string[]
  setFilterByPriority: (priorities: string[]) => void
  filterByStatus: string[]
  setFilterByStatus: (statusIds: string[]) => void
  filterByAssignee: string[]
  setFilterByAssignee: (assignees: string[]) => void
  filterByLabels: string[]
  setFilterByLabels: (labels: string[]) => void
  filterBySprint: string | null
  setFilterBySprint: (sprintId: string | null) => void
  filterByPoints: number[]
  setFilterByPoints: (points: number[]) => void
  filterByDueDate: { from?: Date; to?: Date; includeNone: boolean; includeOverdue: boolean }
  setFilterByDueDate: (filter: { from?: Date; to?: Date; includeNone: boolean; includeOverdue: boolean }) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  clearFilters: () => void

  // View options
  showSubtasks: boolean
  setShowSubtasks: (show: boolean) => void
  groupByEpic: boolean
  setGroupByEpic: (group: boolean) => void

  // Column config panel
  columnConfigOpen: boolean
  setColumnConfigOpen: (open: boolean) => void


  // Manual backlog ordering (per project)
  backlogOrder: Record<string, string[]>
  setBacklogOrder: (projectId: string, orderedIds: string[]) => void
  clearBacklogOrder: (projectId: string) => void
}

export const useBacklogStore = create<BacklogState>()(
  persist(
    (set) => ({
      // Column configuration
      columns: DEFAULT_COLUMNS,
      setColumns: (columns) => set({ columns }),
      toggleColumnVisibility: (columnId) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, visible: !col.visible } : col,
          ),
        })),
      reorderColumns: (fromIndex, toIndex) =>
        set((state) => {
          const newColumns = [...state.columns]
          const [removed] = newColumns.splice(fromIndex, 1)
          newColumns.splice(toIndex, 0, removed)
          return { columns: newColumns }
        }),
      setColumnWidth: (columnId, width) =>
        set((state) => ({
          columns: state.columns.map((col) => (col.id === columnId ? { ...col, width } : col)),
        })),
      resetColumns: () => set({ columns: DEFAULT_COLUMNS }),

      // Sorting
      sort: { column: 'key', direction: 'desc' },
      setSort: (sort) => set({ sort }),
      toggleSort: (columnId) =>
        set((state) => {
          const column = state.columns.find((c) => c.id === columnId)
          if (!column?.sortable) return state

          if (state.sort?.column === columnId) {
            // Toggle direction or clear
            if (state.sort.direction === 'asc') {
              return { sort: { column: columnId, direction: 'desc' } }
            }
            return { sort: null }
          }
          return { sort: { column: columnId, direction: 'asc' } }
        }),

      // Filtering
      filterByType: [],
      setFilterByType: (types) => set({ filterByType: types }),
      filterByPriority: [],
      setFilterByPriority: (priorities) => set({ filterByPriority: priorities }),
      filterByStatus: [],
      setFilterByStatus: (statusIds) => set({ filterByStatus: statusIds }),
      filterByAssignee: [],
      setFilterByAssignee: (assignees) => set({ filterByAssignee: assignees }),
      filterByLabels: [],
      setFilterByLabels: (labels) => set({ filterByLabels: labels }),
      filterBySprint: null,
      setFilterBySprint: (sprintId) => set({ filterBySprint: sprintId }),
      filterByPoints: [],
      setFilterByPoints: (points) => set({ filterByPoints: points }),
      filterByDueDate: { from: undefined, to: undefined, includeNone: false, includeOverdue: false },
      setFilterByDueDate: (filter) => set({ filterByDueDate: filter }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearFilters: () =>
        set({
          filterByType: [],
          filterByPriority: [],
          filterByStatus: [],
          filterByAssignee: [],
          filterByLabels: [],
          filterBySprint: null,
          filterByPoints: [],
          filterByDueDate: { from: undefined, to: undefined, includeNone: false, includeOverdue: false },
          searchQuery: '',
        }),

      // View options
      showSubtasks: true,
      setShowSubtasks: (show) => set({ showSubtasks: show }),
      groupByEpic: false,
      setGroupByEpic: (group) => set({ groupByEpic: group }),

      // Column config panel
      columnConfigOpen: false,
      setColumnConfigOpen: (open) => set({ columnConfigOpen: open }),

      backlogOrder: {},
      setBacklogOrder: (projectId, orderedIds) =>
        set((state) => ({
          backlogOrder: {
            ...state.backlogOrder,
            [projectId]: orderedIds,
          },
        })),
      clearBacklogOrder: (projectId) =>
        set((state) => {
          if (!state.backlogOrder[projectId]) return state
          const { [projectId]: _removed, ...rest } = state.backlogOrder
          return { backlogOrder: rest }
        }),
    }),
    {
      name: 'punt-backlog-config',
      partialize: (state) => ({
        columns: state.columns,
        sort: state.sort,
        showSubtasks: state.showSubtasks,
        groupByEpic: state.groupByEpic,
        backlogOrder: state.backlogOrder,
      }),
    },
  ),
)
