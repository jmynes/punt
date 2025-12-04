import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@/__tests__/utils/test-utils'
import { BacklogTable } from '../backlog-table'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { createMockTicket, createMockColumns } from '@/__tests__/utils/mocks'

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
      filterByAssignee: [],
      setFilterByAssignee: vi.fn(),
      filterBySprint: null,
      setFilterBySprint: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
      clearFilters: vi.fn(),
      showSubtasks: true,
      setShowSubtasks: vi.fn(),
      groupByEpic: false,
      setGroupByEpic: vi.fn(),
      columnConfigOpen: false,
      setColumnConfigOpen: vi.fn(),
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
      addTicket: vi.fn(),
      removeTicket: vi.fn(),
    })
  })

  it('should render table with tickets', () => {
    const { container } = render(
      <BacklogTable tickets={mockTickets} projectKey="TEST" onRowClick={vi.fn()} />,
    )
    expect(container).toBeInTheDocument()
  })

  it('should handle empty tickets array', () => {
    const { container } = render(
      <BacklogTable tickets={[]} projectKey="TEST" onRowClick={vi.fn()} />,
    )
    expect(container).toBeInTheDocument()
  })
})

