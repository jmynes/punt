import { DndContext } from '@dnd-kit/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockColumns, createMockTicket } from '@/__tests__/utils/mocks'
import { render, screen } from '@/__tests__/utils/test-utils'
import type { BacklogColumn } from '@/stores/backlog-store'
import { TicketTable } from '../ticket-table'
import type { TableContext } from '../types'

// Mock all stores with getState support
vi.mock('@/stores/selection-store', () => {
  const createMock = () => ({
    isSelected: vi.fn(() => false),
    selectTicket: vi.fn(),
    toggleTicket: vi.fn(),
    selectRange: vi.fn(),
    selectedTicketIds: new Set<string>(),
    lastSelectedId: null,
    clearSelection: vi.fn(),
    copiedTicketIds: [],
    setCopiedTicketIds: vi.fn(),
    ticketOrigins: {},
    setTicketOrigins: vi.fn(),
  })
  return {
    useSelectionStore: Object.assign(vi.fn(createMock), {
      getState: vi.fn(createMock),
    }),
  }
})

vi.mock('@/stores/ui-store', () => {
  const createMock = () => ({
    setActiveTicketId: vi.fn(),
    activeTicketId: null,
    createTicketOpen: false,
    setCreateTicketOpen: vi.fn(),
    activeProjectId: null,
    setActiveProjectId: vi.fn(),
    prefillTicketData: null,
    setPrefillTicketData: vi.fn(),
    clearPrefillTicketData: vi.fn(),
  })
  return {
    useUIStore: Object.assign(vi.fn(createMock), {
      getState: vi.fn(createMock),
    }),
  }
})

vi.mock('@/stores/board-store', () => {
  const createMock = () => ({
    getColumns: vi.fn(() => createMockColumns()),
    updateTicket: vi.fn(),
    updateTickets: vi.fn(),
  })
  return {
    useBoardStore: Object.assign(vi.fn(createMock), {
      getState: vi.fn(createMock),
    }),
  }
})

vi.mock('@/stores/undo-store', () => {
  const createMock = () => ({
    push: vi.fn(),
    pushDeleted: vi.fn(),
  })
  return {
    useUndoStore: Object.assign(vi.fn(createMock), {
      getState: vi.fn(createMock),
    }),
  }
})

const mockColumns: BacklogColumn[] = [
  { id: 'key', label: 'Key', visible: true, width: 100, minWidth: 80, sortable: true },
  { id: 'title', label: 'Title', visible: true, width: 300, minWidth: 150, sortable: true },
  { id: 'status', label: 'Status', visible: true, width: 120, minWidth: 100, sortable: true },
  { id: 'priority', label: 'Priority', visible: true, width: 100, minWidth: 80, sortable: true },
]

const mockContext: TableContext = {
  sectionId: 'backlog',
  sprintId: null,
  projectKey: 'TEST',
  projectId: 'project-1',
  statusColumns: createMockColumns(),
}

// Wrapper to provide DnD context
function DndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>
}

describe('TicketTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render table with multiple tickets', () => {
    const tickets = [
      createMockTicket({ id: 'ticket-1', number: 1, title: 'First ticket' }),
      createMockTicket({ id: 'ticket-2', number: 2, title: 'Second ticket' }),
      createMockTicket({ id: 'ticket-3', number: 3, title: 'Third ticket' }),
    ]

    render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={tickets.map((t) => t.id)}
        />
      </DndWrapper>,
    )

    expect(screen.getByText('TEST-1')).toBeInTheDocument()
    expect(screen.getByText('TEST-2')).toBeInTheDocument()
    expect(screen.getByText('TEST-3')).toBeInTheDocument()
    expect(screen.getByText('First ticket')).toBeInTheDocument()
    expect(screen.getByText('Second ticket')).toBeInTheDocument()
    expect(screen.getByText('Third ticket')).toBeInTheDocument()
  })

  it('should render empty table with no tickets', () => {
    const { container } = render(
      <DndWrapper>
        <TicketTable context={mockContext} tickets={[]} columns={mockColumns} allTicketIds={[]} />
      </DndWrapper>,
    )

    // Table should exist but have no data rows
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.queryByText('TEST-')).not.toBeInTheDocument()
  })

  it('should render header when showHeader is true', () => {
    const tickets = [createMockTicket({ id: 'ticket-1' })]

    render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
          showHeader={true}
        />
      </DndWrapper>,
    )

    // Header should show column labels
    expect(screen.getByText('Key')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('should not render header when showHeader is false', () => {
    const tickets = [createMockTicket({ id: 'ticket-1' })]

    render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
          showHeader={false}
        />
      </DndWrapper>,
    )

    // Header labels should not be present (they're only in thead)
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
  })

  it('should only render visible columns', () => {
    const columnsWithHidden: BacklogColumn[] = [
      { id: 'key', label: 'Key', visible: true, width: 100, minWidth: 80, sortable: true },
      { id: 'title', label: 'Title', visible: true, width: 300, minWidth: 150, sortable: true },
      { id: 'status', label: 'Status', visible: false, width: 120, minWidth: 100, sortable: true },
      {
        id: 'priority',
        label: 'Priority',
        visible: true,
        width: 100,
        minWidth: 80,
        sortable: true,
      },
    ]

    const tickets = [createMockTicket({ id: 'ticket-1', columnId: 'col-2' })]

    render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={columnsWithHidden}
          allTicketIds={['ticket-1']}
          showHeader={true}
        />
      </DndWrapper>,
    )

    expect(screen.getByText('Key')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.queryByText('Status')).not.toBeInTheDocument() // Hidden
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('should show drop indicator at correct position', () => {
    const tickets = [
      createMockTicket({ id: 'ticket-1', number: 1 }),
      createMockTicket({ id: 'ticket-2', number: 2 }),
      createMockTicket({ id: 'ticket-3', number: 3 }),
    ]

    const { container } = render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={tickets.map((t) => t.id)}
          dropPosition={1}
          draggingTicketIds={['ticket-4']}
          showHeader={false}
        />
      </DndWrapper>,
    )

    // Drop indicator uses emerald-500 color
    const dropIndicators = container.querySelectorAll('.bg-emerald-500')
    expect(dropIndicators.length).toBeGreaterThan(0)
  })

  it('should show end-of-list drop indicator', () => {
    const tickets = [
      createMockTicket({ id: 'ticket-1', number: 1 }),
      createMockTicket({ id: 'ticket-2', number: 2 }),
    ]

    const { container } = render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={tickets.map((t) => t.id)}
          dropPosition={2} // After last ticket
          draggingTicketIds={['ticket-3']}
          showHeader={false}
        />
      </DndWrapper>,
    )

    // End-of-list drop indicator uses emerald-500 color
    const dropIndicators = container.querySelectorAll('.bg-emerald-500')
    expect(dropIndicators.length).toBeGreaterThan(0)
  })

  it('should mark tickets as being dragged', () => {
    const tickets = [
      createMockTicket({ id: 'ticket-1', number: 1 }),
      createMockTicket({ id: 'ticket-2', number: 2 }),
    ]

    const { container } = render(
      <DndWrapper>
        <TicketTable
          context={mockContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={tickets.map((t) => t.id)}
          draggingTicketIds={['ticket-1']}
          showHeader={false}
        />
      </DndWrapper>,
    )

    // Use data attribute to find actual ticket rows (not drop indicator rows)
    const rows = container.querySelectorAll('tr[data-ticket-row]')
    expect(rows).toHaveLength(2)
    // First row (ticket-1) should have dragging styles
    expect(rows[0].className).toContain('ring-2')
    // Second row (ticket-2) should not
    expect(rows[1].className).not.toContain('ring-2')
  })

  it('should use sprint context for sprint sections', () => {
    const sprintContext: TableContext = {
      sectionId: 'sprint-1',
      sprintId: 'sprint-1',
      projectKey: 'TEST',
      projectId: 'project-1',
      statusColumns: createMockColumns(),
    }

    const tickets = [createMockTicket({ id: 'ticket-1', sprintId: 'sprint-1' })]

    render(
      <DndWrapper>
        <TicketTable
          context={sprintContext}
          tickets={tickets}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    expect(screen.getByText('TEST-1')).toBeInTheDocument()
  })
})
