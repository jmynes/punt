import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// All available columns that can be displayed in the backlog
export const BACKLOG_COLUMNS = [
  'key',
  'type',
  'title',
  'status',
  'priority',
  'resolution',
  'assignee',
  'reporter',
  'labels',
  'sprint',
  'storyPoints',
  'estimate',
  'startDate',
  'dueDate',
  'created',
  'updated',
  'parent',
  'environment',
  'affectedVersion',
  'fixVersion',
  'watchers',
] as const

export type BacklogColumnId = (typeof BACKLOG_COLUMNS)[number]

// Filter button types - independent from column visibility
export const FILTER_BUTTON_TYPES = [
  'type',
  'status',
  'resolution',
  'priority',
  'assignee',
  'labels',
  'sprint',
  'storyPoints',
  'dueDate',
] as const

export type FilterButtonId = (typeof FILTER_BUTTON_TYPES)[number]

export interface FilterButton {
  id: FilterButtonId
  label: string
  visible: boolean
}

export const DEFAULT_FILTER_BUTTONS: FilterButton[] = [
  { id: 'type', label: 'Type', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'resolution', label: 'Resolution', visible: true },
  { id: 'priority', label: 'Priority', visible: true },
  { id: 'assignee', label: 'Assignee', visible: true },
  { id: 'labels', label: 'Labels', visible: true },
  { id: 'sprint', label: 'Sprint', visible: true },
  { id: 'storyPoints', label: 'Points', visible: true },
  { id: 'dueDate', label: 'Due Date', visible: true },
]

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
  {
    id: 'resolution',
    label: 'Resolution',
    width: 120,
    minWidth: 90,
    visible: false,
    sortable: true,
  },
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
  {
    id: 'startDate',
    label: 'Start Date',
    width: 110,
    minWidth: 100,
    visible: false,
    sortable: true,
  },
  { id: 'dueDate', label: 'Due Date', width: 110, minWidth: 100, visible: true, sortable: true },
  { id: 'created', label: 'Created', width: 110, minWidth: 100, visible: false, sortable: true },
  { id: 'updated', label: 'Updated', width: 110, minWidth: 100, visible: false, sortable: true },
  { id: 'parent', label: 'Parent', width: 120, minWidth: 100, visible: false, sortable: true },
  {
    id: 'environment',
    label: 'Environment',
    width: 120,
    minWidth: 90,
    visible: false,
    sortable: true,
  },
  {
    id: 'affectedVersion',
    label: 'Affected Version',
    width: 130,
    minWidth: 100,
    visible: false,
    sortable: true,
  },
  {
    id: 'fixVersion',
    label: 'Fix Version',
    width: 120,
    minWidth: 90,
    visible: false,
    sortable: true,
  },
  { id: 'watchers', label: 'Watchers', width: 100, minWidth: 80, visible: false, sortable: true },
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
  filterByResolution: string[]
  setFilterByResolution: (resolutions: string[]) => void
  filterByAssignee: string[]
  setFilterByAssignee: (assignees: string[]) => void
  filterByLabels: string[]
  setFilterByLabels: (labels: string[]) => void
  filterBySprint: string | null
  setFilterBySprint: (sprintId: string | null) => void
  filterByPoints: { operator: '<' | '>' | '=' | '<=' | '>='; value: number } | null
  setFilterByPoints: (
    filter: { operator: '<' | '>' | '=' | '<=' | '>='; value: number } | null,
  ) => void
  filterByDueDate: { from?: Date; to?: Date; includeNone: boolean; includeOverdue: boolean }
  setFilterByDueDate: (filter: {
    from?: Date
    to?: Date
    includeNone: boolean
    includeOverdue: boolean
  }) => void
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

  // Filter button configuration
  filterButtons: FilterButton[]
  setFilterButtons: (buttons: FilterButton[]) => void
  toggleFilterButtonVisibility: (buttonId: FilterButtonId) => void
  reorderFilterButtons: (fromIndex: number, toIndex: number) => void
  resetFilterButtons: () => void
  matchFilterButtonsToColumns: () => void
  filterConfigOpen: boolean
  setFilterConfigOpen: (open: boolean) => void

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
      filterByResolution: [],
      setFilterByResolution: (resolutions) => set({ filterByResolution: resolutions }),
      filterByAssignee: [],
      setFilterByAssignee: (assignees) => set({ filterByAssignee: assignees }),
      filterByLabels: [],
      setFilterByLabels: (labels) => set({ filterByLabels: labels }),
      filterBySprint: null,
      setFilterBySprint: (sprintId) => set({ filterBySprint: sprintId }),
      filterByPoints: null,
      setFilterByPoints: (filter) => set({ filterByPoints: filter }),
      filterByDueDate: {
        from: undefined,
        to: undefined,
        includeNone: false,
        includeOverdue: false,
      },
      setFilterByDueDate: (filter) => set({ filterByDueDate: filter }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearFilters: () =>
        set({
          filterByType: [],
          filterByPriority: [],
          filterByStatus: [],
          filterByResolution: [],
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
        }),

      // View options
      showSubtasks: true,
      setShowSubtasks: (show) => set({ showSubtasks: show }),
      groupByEpic: false,
      setGroupByEpic: (group) => set({ groupByEpic: group }),

      // Column config panel
      columnConfigOpen: false,
      setColumnConfigOpen: (open) => set({ columnConfigOpen: open }),

      // Filter button configuration
      filterButtons: DEFAULT_FILTER_BUTTONS,
      setFilterButtons: (buttons) => set({ filterButtons: buttons }),
      toggleFilterButtonVisibility: (buttonId) =>
        set((state) => ({
          filterButtons: state.filterButtons.map((btn) =>
            btn.id === buttonId ? { ...btn, visible: !btn.visible } : btn,
          ),
        })),
      reorderFilterButtons: (fromIndex, toIndex) =>
        set((state) => {
          const newButtons = [...state.filterButtons]
          const [removed] = newButtons.splice(fromIndex, 1)
          newButtons.splice(toIndex, 0, removed)
          return { filterButtons: newButtons }
        }),
      resetFilterButtons: () => set({ filterButtons: DEFAULT_FILTER_BUTTONS }),
      matchFilterButtonsToColumns: () =>
        set((state) => {
          // Map column IDs to filter button IDs where applicable
          const columnToFilterMap: Record<string, FilterButtonId> = {
            type: 'type',
            status: 'status',
            resolution: 'resolution',
            priority: 'priority',
            assignee: 'assignee',
            labels: 'labels',
            sprint: 'sprint',
            storyPoints: 'storyPoints',
            dueDate: 'dueDate',
          }

          // Get visible column IDs that map to filter buttons
          const visibleColumnIds = new Set(state.columns.filter((c) => c.visible).map((c) => c.id))

          // Update filter button visibility to match columns
          return {
            filterButtons: state.filterButtons.map((btn) => {
              // Find if there's a matching column
              const matchingColumnId = Object.entries(columnToFilterMap).find(
                ([_, filterId]) => filterId === btn.id,
              )?.[0]

              if (matchingColumnId) {
                return {
                  ...btn,
                  visible: visibleColumnIds.has(matchingColumnId as BacklogColumnId),
                }
              }
              return btn
            }),
          }
        }),
      filterConfigOpen: false,
      setFilterConfigOpen: (open) => set({ filterConfigOpen: open }),

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
        filterButtons: state.filterButtons,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Merge any new DEFAULT_COLUMNS that don't exist in persisted state
        const existingIds = new Set(state.columns.map((c) => c.id))
        const newColumns = DEFAULT_COLUMNS.filter((c) => !existingIds.has(c.id))
        if (newColumns.length > 0) {
          state.columns = [...state.columns, ...newColumns]
        }
        // Merge any new DEFAULT_FILTER_BUTTONS that don't exist in persisted state
        if (!state.filterButtons) {
          state.filterButtons = DEFAULT_FILTER_BUTTONS
        } else {
          const existingButtonIds = new Set(state.filterButtons.map((b) => b.id))
          const newButtons = DEFAULT_FILTER_BUTTONS.filter((b) => !existingButtonIds.has(b.id))
          if (newButtons.length > 0) {
            state.filterButtons = [...state.filterButtons, ...newButtons]
          }
        }
      },
    },
  ),
)
