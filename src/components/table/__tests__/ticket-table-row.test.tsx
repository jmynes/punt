import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockColumns, createMockTicket } from '@/__tests__/utils/mocks'
import { render, screen } from '@/__tests__/utils/test-utils'
import type { BacklogColumn } from '@/stores/backlog-store'
import { TicketTableRow } from '../ticket-table-row'
import type { TableContext } from '../types'

// Mock functions
const mockSelectTicket = vi.fn()
const mockToggleTicket = vi.fn()
const mockSelectRange = vi.fn()
const mockSetActiveTicketId = vi.fn()
const mockIsSelected = vi.fn(() => false)

// Mock all stores with getState support
vi.mock('@/stores/selection-store', () => {
  const createMock = () => ({
    isSelected: mockIsSelected,
    selectTicket: mockSelectTicket,
    toggleTicket: mockToggleTicket,
    selectRange: mockSelectRange,
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
    setActiveTicketId: mockSetActiveTicketId,
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
  return (
    <DndContext>
      <SortableContext items={['ticket-1']} strategy={verticalListSortingStrategy}>
        <table>
          <tbody>{children}</tbody>
        </table>
      </SortableContext>
    </DndContext>
  )
}

describe('TicketTableRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSelected.mockReturnValue(false)
  })

  it('should render ticket data in cells', () => {
    const ticket = createMockTicket({ number: 42, title: 'Test issue' })
    render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    expect(screen.getByText('TEST-42')).toBeInTheDocument()
    expect(screen.getByText('Test issue')).toBeInTheDocument()
  })

  it('should call selectTicket and setActiveTicketId on click', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    fireEvent.click(row)

    expect(mockSelectTicket).toHaveBeenCalledWith('ticket-1')
    expect(mockSetActiveTicketId).toHaveBeenCalledWith('ticket-1')
  })

  it('should toggle selection on Ctrl+click', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    fireEvent.click(row, { ctrlKey: true })

    expect(mockToggleTicket).toHaveBeenCalledWith('ticket-1')
    expect(mockSelectTicket).not.toHaveBeenCalled()
  })

  it('should toggle selection on Meta+click (Mac)', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    fireEvent.click(row, { metaKey: true })

    expect(mockToggleTicket).toHaveBeenCalledWith('ticket-1')
  })

  it('should call selectRange on Shift+click', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const allIds = ['ticket-1', 'ticket-2', 'ticket-3']
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={allIds}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    fireEvent.click(row, { shiftKey: true })

    expect(mockSelectRange).toHaveBeenCalledWith('ticket-1', allIds)
  })

  it('should show drop indicator when showDropIndicator is true', () => {
    const ticket = createMockTicket()
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
          showDropIndicator={true}
          draggingCount={2}
        />
      </DndWrapper>,
    )

    // Drop indicator uses emerald-500 color
    const dropIndicators = container.querySelectorAll('.bg-emerald-500')
    expect(dropIndicators.length).toBeGreaterThan(0)
  })

  it('should render overlay mode correctly', () => {
    const ticket = createMockTicket({ number: 99, title: 'Overlay ticket' })
    const { container } = render(
      <TicketTableRow
        ticket={ticket}
        context={mockContext}
        columns={mockColumns}
        allTicketIds={[]}
        isOverlay={true}
      />,
    )

    // Overlay renders as a standalone table
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.getByText('TEST-99')).toBeInTheDocument()
    expect(screen.getByText('Overlay ticket')).toBeInTheDocument()
  })

  it('should apply dragging styles when isBeingDragged is true', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
          isBeingDragged={true}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    expect(row.className).toContain('ring-2')
  })

  it('should open ticket on Enter key', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(mockSelectTicket).toHaveBeenCalledWith('ticket-1')
    expect(mockSetActiveTicketId).toHaveBeenCalledWith('ticket-1')
  })

  it('should open ticket on Space key', () => {
    const ticket = createMockTicket({ id: 'ticket-1' })
    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['ticket-1']}
        />
      </DndWrapper>,
    )

    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    fireEvent.keyDown(row, { key: ' ' })

    expect(mockSelectTicket).toHaveBeenCalledWith('ticket-1')
    expect(mockSetActiveTicketId).toHaveBeenCalledWith('ticket-1')
  })

  it('should show collapse toggle for parent rows with children', () => {
    const ticket = createMockTicket({ id: 'parent-1', title: 'Parent ticket' })
    const mockToggle = vi.fn()

    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['parent-1']}
          hasChildren={true}
          childCount={3}
          isCollapsed={false}
          onToggleCollapse={mockToggle}
        />
      </DndWrapper>,
    )

    // Should have a collapse button
    const collapseButton = container.querySelector('button[title="Collapse 3 subtasks"]')
    expect(collapseButton).toBeInTheDocument()

    // Click the collapse button
    if (collapseButton) {
      fireEvent.click(collapseButton)
      expect(mockToggle).toHaveBeenCalledWith('parent-1')
    }
  })

  it('should show expand toggle for collapsed parent rows', () => {
    const ticket = createMockTicket({ id: 'parent-1', title: 'Parent ticket' })

    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['parent-1']}
          hasChildren={true}
          childCount={2}
          isCollapsed={true}
          onToggleCollapse={vi.fn()}
        />
      </DndWrapper>,
    )

    // Should have an expand button
    const expandButton = container.querySelector('button[title="Expand 2 subtasks"]')
    expect(expandButton).toBeInTheDocument()
  })

  it('should show indentation for nested subtask rows', () => {
    const ticket = createMockTicket({
      id: 'subtask-1',
      title: 'Nested subtask',
      type: 'subtask',
      parentId: 'parent-1',
    })

    const { container } = render(
      <DndWrapper>
        <TicketTableRow
          ticket={ticket}
          context={mockContext}
          columns={mockColumns}
          allTicketIds={['subtask-1']}
          isNested={true}
          depth={1}
        />
      </DndWrapper>,
    )

    // Should have subtle nested styling
    // biome-ignore lint/style/noNonNullAssertion: test assertion
    const row = container.querySelector('tr[data-ticket-row]')!
    expect(row.className).toContain('bg-zinc-900/30')
  })
})
