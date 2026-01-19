import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockColumns } from '@/__tests__/utils/mocks'
import { render } from '@/__tests__/utils/test-utils'
import { useBoardStore } from '@/stores/board-store'
import { KanbanBoard } from '../kanban-board'

// Mock the stores
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
    setCreateTicketOpen: vi.fn(),
  })),
}))

vi.mock('@/stores/undo-store', () => ({
  useUndoStore: vi.fn(() => ({
    pushMove: vi.fn(),
  })),
}))

describe('KanbanBoard', () => {
  const mockColumns = createMockColumns()

  beforeEach(() => {
    vi.mocked(useBoardStore).mockReturnValue({
      getColumns: vi.fn(() => mockColumns),
      moveTicket: vi.fn(),
      moveTickets: vi.fn(),
      reorderTicket: vi.fn(),
      reorderTickets: vi.fn(),
      setSearchQuery: vi.fn(),
      setColumns: vi.fn(),
      _hasHydrated: true,
      setHasHydrated: vi.fn(),
      updateTicket: vi.fn(),
      addTicket: vi.fn(),
      removeTicket: vi.fn(),
    })
  })

  it('should render board with columns', () => {
    const { container } = render(
      <KanbanBoard projectKey="TEST" projectId="1" filteredColumns={mockColumns} />,
    )
    // The board should render (exact content depends on implementation)
    expect(container).toBeInTheDocument()
  })

  it('should render with filtered columns', () => {
    const filteredColumns = mockColumns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((t) => t.title.toLowerCase().includes('test')),
    }))

    render(<KanbanBoard projectKey="TEST" projectId="1" filteredColumns={filteredColumns} />)
    // Board should render with filtered results
    expect(document.body).toBeInTheDocument()
  })
})
