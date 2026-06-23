import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { demoStorage } from '@/lib/demo/demo-storage'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { moveTickets, reorderTickets, updateTickets } from '../ticket-actions'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))
vi.mock('@/lib/demo/demo-storage', () => ({ demoStorage: { updateTicket: vi.fn() } }))
vi.mock('@/lib/toast', () => ({ showToast: { error: vi.fn() } }))
vi.mock('@/lib/undo-toast', () => ({ showUndoRedoToast: vi.fn() }))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const PROJECT_ID = 'project-1'
const TAB = 'tab-1'

const ok = () => new Response(null, { status: 200 })
const fail = () => new Response(null, { status: 500 })

function getCol(id: string): ColumnWithTickets | undefined {
  return useBoardStore
    .getState()
    .getColumns(PROJECT_ID)
    .find((c) => c.id === id)
}
function colTicketIds(id: string): string[] {
  return getCol(id)?.tickets.map((t) => t.id) ?? []
}

function seed(todo: TicketWithRelations[], done: TicketWithRelations[] = []) {
  const columns: ColumnWithTickets[] = [
    { id: 'col-todo', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets: todo },
    { id: 'col-done', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: done },
  ]
  useBoardStore.setState({ projects: { [PROJECT_ID]: columns }, _hasHydrated: true })
}

describe('moveTickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockApiFetch.mockResolvedValue(ok())
    useUndoStore.setState({ undoStack: [], redoStack: [] })
  })

  it('is a no-op when the target column does not exist', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo' })])
    await moveTickets({ projectId: PROJECT_ID, ticketIds: ['t1'], toColumnId: 'nope', tabId: TAB })
    expect(colTicketIds('col-todo')).toEqual(['t1'])
    expect(useUndoStore.getState().undoStack).toHaveLength(0)
  })

  it('is a no-op when the ticket is already in the target column', async () => {
    seed([], [createMockTicket({ id: 't1', columnId: 'col-done' })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })
    expect(useUndoStore.getState().undoStack).toHaveLength(0)
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('moves a ticket optimistically, registers undo, and shows a toast', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo', resolution: null })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })

    expect(colTicketIds('col-todo')).not.toContain('t1')
    expect(colTicketIds('col-done')).toContain('t1')
    expect(useUndoStore.getState().undoStack).toHaveLength(1)
    expect(showUndoRedoToast).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Moved ticket to Done' }),
    )
  })

  it('auto-sets resolution to Done when moving into a completed column', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo', resolution: null })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })
    const moved = getCol('col-done')?.tickets.find((t) => t.id === 't1')
    expect(moved?.resolution).toBe('Done')
    expect(moved?.resolvedAt).toBeInstanceOf(Date)
  })

  it('auto-clears resolution when moving out of a completed column', async () => {
    seed([], [createMockTicket({ id: 't1', columnId: 'col-done', resolution: 'Done' })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-todo',
      tabId: TAB,
    })
    const moved = getCol('col-todo')?.tickets.find((t) => t.id === 't1')
    expect(moved?.resolution).toBeNull()
    expect(moved?.resolvedAt).toBeNull()
  })

  it('PATCHes the API for a real ticket id', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo' })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/tickets/t1`,
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('skips the API for an unsaved temp ticket id', async () => {
    seed([createMockTicket({ id: 'ticket-temp-1', columnId: 'col-todo' })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['ticket-temp-1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('rolls back the board and shows an error when the API fails', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo' })])
    mockApiFetch.mockResolvedValue(fail())

    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })

    expect(colTicketIds('col-todo')).toContain('t1') // restored
    expect(colTicketIds('col-done')).not.toContain('t1')
    expect(showToast.error).toHaveBeenCalledWith('Failed to move ticket')
  })

  it('persists to demoStorage in demo mode instead of the API', async () => {
    mockIsDemoMode.mockReturnValue(true)
    seed([createMockTicket({ id: 't1', columnId: 'col-todo' })])
    await moveTickets({
      projectId: PROJECT_ID,
      ticketIds: ['t1'],
      toColumnId: 'col-done',
      tabId: TAB,
    })
    expect(demoStorage.updateTicket).toHaveBeenCalled()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

describe('updateTickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockApiFetch.mockResolvedValue(ok())
    useUndoStore.setState({ undoStack: [], redoStack: [] })
  })

  it('returns early without an undo entry when no ticket ids match', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo' })])
    await updateTickets({
      projectId: PROJECT_ID,
      updates: [{ ticketId: 'missing', changes: { priority: 'high' } }],
      tabId: TAB,
    })
    expect(useUndoStore.getState().undoStack).toHaveLength(0)
  })

  it('applies a field change optimistically and registers undo', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo', priority: 'low' })])
    await updateTickets({
      projectId: PROJECT_ID,
      updates: [{ ticketId: 't1', changes: { priority: 'high' } }],
      tabId: TAB,
    })
    const t = getCol('col-todo')?.tickets.find((t) => t.id === 't1')
    expect(t?.priority).toBe('high')
    expect(useUndoStore.getState().undoStack).toHaveLength(1)
  })

  it('auto-moves a ticket to the done column when a resolution is set', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo', resolution: null })])
    await updateTickets({
      projectId: PROJECT_ID,
      updates: [{ ticketId: 't1', changes: { resolution: "Won't Fix" } }],
      tabId: TAB,
    })
    expect(colTicketIds('col-done')).toContain('t1')
    expect(colTicketIds('col-todo')).not.toContain('t1')
  })

  it('rolls back and shows an error when the API fails', async () => {
    seed([createMockTicket({ id: 't1', columnId: 'col-todo', priority: 'low' })])
    mockApiFetch.mockResolvedValue(fail())

    await updateTickets({
      projectId: PROJECT_ID,
      updates: [{ ticketId: 't1', changes: { priority: 'high' } }],
      tabId: TAB,
    })

    const t = getCol('col-todo')?.tickets.find((t) => t.id === 't1')
    expect(t?.priority).toBe('low') // restored
    expect(showToast.error).toHaveBeenCalledWith('Failed to update ticket')
  })
})

describe('reorderTickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockApiFetch.mockResolvedValue(ok())
    useUndoStore.setState({ undoStack: [], redoStack: [] })
  })

  it('reorders within a column and registers an undo entry', async () => {
    seed([
      createMockTicket({ id: 'a', columnId: 'col-todo', order: 0 }),
      createMockTicket({ id: 'b', columnId: 'col-todo', order: 1 }),
      createMockTicket({ id: 'c', columnId: 'col-todo', order: 2 }),
    ])
    await reorderTickets({
      projectId: PROJECT_ID,
      columnId: 'col-todo',
      ticketIds: ['c'],
      targetIndex: 0,
      tabId: TAB,
    })
    expect(colTicketIds('col-todo')[0]).toBe('c')
    expect(useUndoStore.getState().undoStack).toHaveLength(1)
  })

  it('rolls back and shows an error when the API fails', async () => {
    seed([
      createMockTicket({ id: 'a', columnId: 'col-todo', order: 0 }),
      createMockTicket({ id: 'b', columnId: 'col-todo', order: 1 }),
    ])
    mockApiFetch.mockResolvedValue(fail())

    await reorderTickets({
      projectId: PROJECT_ID,
      columnId: 'col-todo',
      ticketIds: ['b'],
      targetIndex: 0,
      tabId: TAB,
    })

    expect(colTicketIds('col-todo')).toEqual(['a', 'b']) // restored to original order
    expect(showToast.error).toHaveBeenCalledWith('Failed to reorder ticket')
  })
})
