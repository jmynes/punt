import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockColumns, createMockTicket } from '@/__tests__/utils/mocks'
import { render } from '@/__tests__/utils/test-utils'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { BacklogTable } from '../backlog-table'

// Mock stores
vi.mock('@/stores/backlog-store', () => ({
  useBacklogStore: vi.fn(),
}))

vi.mock('@/stores/board-store', () => ({
  useBoardStore: vi.fn(),
}))

vi.mock('@/stores/selection-store', () => ({
  useSelectionStore: vi.fn(() => ({
    selectedTicketIds: new Set(),
    clearSelection: vi.fn(),
    isSelected: vi.fn(() => false),
    selectTicket: vi.fn(),
    toggleTicket: vi.fn(),
    selectRange: vi.fn(),
  })),
}))

vi.mock('@/stores/ui-store', () => ({
  useUIStore: vi.fn(() => ({
    setActiveTicketId: vi.fn(),
  })),
}))

describe('BacklogTable', () => {
  const mockTickets = [
    createMockTicket({ id: 'ticket-1', number: 1, title: 'Test Ticket 1' }),
    createMockTicket({ id: 'ticket-2', number: 2, title: 'Test Ticket 2' }),
  ]

  beforeEach(() => {
    vi.mocked(useBacklogStore).mockReturnValue({
      columns: [],
      setColumns: vi.fn(),
      toggleColumnVisibility: vi.fn(),
      reorderColumns: vi.fn(),
      setColumnWidth: vi.fn(),
      resetColumns: vi.fn(),
      sort: null,
      setSort: vi.fn(),
      toggleSort: vi.fn(),
      filterByType: [],
      setFilterByType: vi.fn(),
      filterByPriority: [],
      setFilterByPriority: vi.fn(),
      filterByStatus: [],
      setFilterByStatus: vi.fn(),
      filterByResolution: [],
      setFilterByResolution: vi.fn(),
      filterByAssignee: [],
      setFilterByAssignee: vi.fn(),
      filterByLabels: [],
      setFilterByLabels: vi.fn(),
      filterBySprint: null,
      setFilterBySprint: vi.fn(),
      filterByPoints: [],
      setFilterByPoints: vi.fn(),
      filterByDueDate: [],
      setFilterByDueDate: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
      clearFilters: vi.fn(),
      showSubtasks: true,
      setShowSubtasks: vi.fn(),
      groupByEpic: false,
      setGroupByEpic: vi.fn(),
      columnConfigOpen: false,
      setColumnConfigOpen: vi.fn(),
      backlogOrder: {},
      setBacklogOrder: vi.fn(),
      clearBacklogOrder: vi.fn(),
    })

    vi.mocked(useBoardStore).mockReturnValue({
      columns: createMockColumns(),
      moveTicket: vi.fn(),
      moveTickets: vi.fn(),
      reorderTicket: vi.fn(),
      reorderTickets: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
      setColumns: vi.fn(),
      _hasHydrated: true,
      setHasHydrated: vi.fn(),
      updateTicket: vi.fn(),
      updateTickets: vi.fn(),
      addTicket: vi.fn(),
      removeTicket: vi.fn(),
    })
  })

  it('should render table with tickets', () => {
    const statusColumns = createMockColumns()
    const { container } = render(
      <BacklogTable
        tickets={mockTickets}
        columns={statusColumns}
        projectKey="TEST"
        projectId="1"
      />,
    )
    expect(container).toBeInTheDocument()
  })

  it('should handle empty tickets array', () => {
    const statusColumns = createMockColumns()
    const { container } = render(
      <BacklogTable tickets={[]} columns={statusColumns} projectKey="TEST" projectId="1" />,
    )
    expect(container).toBeInTheDocument()
  })
})
