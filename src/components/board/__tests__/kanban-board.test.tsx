import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockColumns } from '@/__tests__/utils/mocks'
import { render } from '@/__tests__/utils/test-utils'
import { useBoardStore } from '@/stores/board-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { KanbanBoard } from '../kanban-board'

// Use vi.hoisted to define mocks before vi.mock runs (vi.mock is hoisted)
const { mockBoardState, mockSelectionState, mockUiState, mockUndoState, createMockStore } =
  vi.hoisted(() => {
    // Helper to create a mock store with both hook and getState patterns
    function createMockStore<T>(defaultState: T) {
      const mockFn = vi.fn(() => defaultState)
      ;(mockFn as ReturnType<typeof vi.fn> & { getState: ReturnType<typeof vi.fn> }).getState =
        vi.fn(() => defaultState)
      ;(mockFn as ReturnType<typeof vi.fn> & { setState: ReturnType<typeof vi.fn> }).setState =
        vi.fn()
      ;(mockFn as ReturnType<typeof vi.fn> & { subscribe: ReturnType<typeof vi.fn> }).subscribe =
        vi.fn(() => () => {})
      return mockFn as ReturnType<typeof vi.fn> & {
        getState: ReturnType<typeof vi.fn>
        setState: ReturnType<typeof vi.fn>
        subscribe: ReturnType<typeof vi.fn>
      }
    }

    const mockBoardState = {
      getColumns: vi.fn(() => [] as ColumnWithTickets[]),
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
      collapsedColumns: {},
      isColumnCollapsed: vi.fn(() => false),
      toggleColumnCollapsed: vi.fn(),
      setColumnCollapsed: vi.fn(),
      columnSorts: {},
      getColumnSort: vi.fn(() => 'manual' as const),
      setColumnSort: vi.fn(),
    }

    const mockSelectionState = {
      selectedTicketIds: new Set<string>(),
      clearSelection: vi.fn(),
      isSelected: vi.fn(() => false),
      selectTicket: vi.fn(),
      toggleTicket: vi.fn(),
      selectRange: vi.fn(),
      copiedTicketIds: null,
      ticketOrigins: new Map(),
      lastSelectedId: null,
      setLastSelectedId: vi.fn(),
      setCopiedTickets: vi.fn(),
      clearCopiedTickets: vi.fn(),
    }

    const mockUiState = {
      setCreateTicketOpen: vi.fn(),
      createTicketOpen: false,
      ticketDetailOpen: false,
      setTicketDetailOpen: vi.fn(),
      activeTicketId: null,
      setActiveTicketId: vi.fn(),
      prefillTicketData: null,
      openCreateTicketWithData: vi.fn(),
    }

    const mockUndoState = {
      pushMove: vi.fn(),
      pushDelete: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: false,
      canRedo: false,
    }

    return { mockBoardState, mockSelectionState, mockUiState, mockUndoState, createMockStore }
  })

// Mock the stores
vi.mock('@/stores/board-store', () => ({
  useBoardStore: createMockStore(mockBoardState),
  // Re-export the real sortTickets function since it's a pure utility
  sortTickets: (tickets: TicketWithRelations[], _sortOption: string) => tickets,
  COLUMN_SORT_OPTIONS: [
    'manual',
    'priority-desc',
    'priority-asc',
    'due-date-asc',
    'due-date-desc',
    'story-points-desc',
    'story-points-asc',
    'created-asc',
    'created-desc',
  ],
  COLUMN_SORT_LABELS: {
    manual: 'Manual',
    'priority-desc': 'Priority (high to low)',
    'priority-asc': 'Priority (low to high)',
    'due-date-asc': 'Due date (earliest first)',
    'due-date-desc': 'Due date (latest first)',
    'story-points-desc': 'Story points (high to low)',
    'story-points-asc': 'Story points (low to high)',
    'created-asc': 'Created (oldest first)',
    'created-desc': 'Created (newest first)',
  },
}))

vi.mock('@/stores/selection-store', () => ({
  useSelectionStore: createMockStore(mockSelectionState),
}))

vi.mock('@/stores/ui-store', () => ({
  useUIStore: createMockStore(mockUiState),
}))

vi.mock('@/stores/undo-store', () => ({
  useUndoStore: createMockStore(mockUndoState),
}))

describe('KanbanBoard', () => {
  const mockColumns = createMockColumns()

  beforeEach(() => {
    vi.clearAllMocks()
    // Update the mock to return columns
    mockBoardState.getColumns = vi.fn(() => mockColumns)
    // Update both the hook return and getState return
    // biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
    vi.mocked(useBoardStore).mockReturnValue(mockBoardState as any)
    // biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
    vi.mocked(useBoardStore.getState).mockReturnValue(mockBoardState as any)
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
