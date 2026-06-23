import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { demoStorage } from '@/lib/demo/demo-storage'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import {
  deleteTickets,
  prepareTicketsForDelete,
  restoreAttachments,
  restoreCommentsAndLinks,
} from '../delete-tickets'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))
vi.mock('@/lib/demo/demo-storage', () => ({ demoStorage: { deleteTicket: vi.fn() } }))
vi.mock('@/lib/toast', () => ({ showToast: { error: vi.fn() } }))
vi.mock('@/lib/undo-toast', () => ({ showUndoRedoToast: vi.fn() }))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const PROJECT_ID = 'project-1'

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function seedColumns(tickets: TicketWithRelations[]): ColumnWithTickets[] {
  return [{ id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets }]
}

describe('prepareTicketsForDelete', () => {
  it('finds selected tickets across columns, attaching their column id', () => {
    const t1 = createMockTicket({ id: 't1', columnId: 'col-1' })
    const t2 = createMockTicket({ id: 't2', columnId: 'col-2' })
    const columns: ColumnWithTickets[] = [
      { id: 'col-1', name: 'A', order: 0, projectId: PROJECT_ID, tickets: [t1] },
      { id: 'col-2', name: 'B', order: 1, projectId: PROJECT_ID, tickets: [t2] },
    ]
    const result = prepareTicketsForDelete(['t1', 't2'], columns)
    expect(result).toEqual([
      { ticket: t1, columnId: 'col-1' },
      { ticket: t2, columnId: 'col-2' },
    ])
  })

  it('returns an empty array when no ids match', () => {
    const columns = seedColumns([createMockTicket({ id: 't1' })])
    expect(prepareTicketsForDelete(['nope'], columns)).toEqual([])
  })
})

describe('deleteTickets', () => {
  let ticket: TicketWithRelations

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    // Restore-data fetches (comments/links via apiFetch) + DELETE all succeed.
    mockApiFetch.mockResolvedValue(okJson([]))
    // Activity fetches use the global fetch.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ entries: [] })))

    ticket = createMockTicket({ id: 't1', number: 1, columnId: 'col-1' })
    useBoardStore.setState({
      projects: { [PROJECT_ID]: seedColumns([ticket]) },
      _hasHydrated: true,
    })
    useSelectionStore.setState({ selectedTicketIds: new Set(['t1']), copiedTicketIds: [] })
    useUndoStore.setState({ undoStack: [], redoStack: [] })
    useProjectsStore.setState({
      projects: [{ id: PROJECT_ID, key: 'PUNT', name: 'Punt', ticketCount: 1 }],
    })
  })

  it('fails when given no tickets', async () => {
    const result = await deleteTickets({ projectId: PROJECT_ID, tickets: [] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('No tickets to delete')
  })

  it('optimistically removes the ticket, clears selection, and pushes an undo entry', async () => {
    const result = await deleteTickets({
      projectId: PROJECT_ID,
      tickets: [{ ticket, columnId: 'col-1' }],
    })

    expect(result.success).toBe(true)
    const ids = useBoardStore
      .getState()
      .getColumns(PROJECT_ID)
      .flatMap((c) => c.tickets.map((t) => t.id))
    expect(ids).not.toContain('t1')
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(0)
    expect(useUndoStore.getState().undoStack).toHaveLength(1)
  })

  it('issues a DELETE request per ticket', async () => {
    await deleteTickets({ projectId: PROJECT_ID, tickets: [{ ticket, columnId: 'col-1' }] })
    const deleteCalls = mockApiFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0][0]).toBe(`/api/projects/${PROJECT_ID}/tickets/t1`)
  })

  it('rolls back the optimistic removal and reports failure when the API errors', async () => {
    mockApiFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 500 })
      return okJson([])
    })

    const result = await deleteTickets({
      projectId: PROJECT_ID,
      tickets: [{ ticket, columnId: 'col-1' }],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('API error')
    expect(showToast.error).toHaveBeenCalledWith('Failed to delete ticket(s)')
    // Ticket restored to the board
    const ids = useBoardStore
      .getState()
      .getColumns(PROJECT_ID)
      .flatMap((c) => c.tickets.map((t) => t.id))
    expect(ids).toContain('t1')
  })

  it('in demo mode skips the API and deletes from demoStorage', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const result = await deleteTickets({
      projectId: PROJECT_ID,
      tickets: [{ ticket, columnId: 'col-1' }],
    })

    expect(result.success).toBe(true)
    expect(demoStorage.deleteTicket).toHaveBeenCalledWith(PROJECT_ID, 't1')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('shows a singular toast for one ticket and a plural toast for many', async () => {
    await deleteTickets({ projectId: PROJECT_ID, tickets: [{ ticket, columnId: 'col-1' }] })
    expect(showUndoRedoToast).toHaveBeenLastCalledWith(
      'error',
      expect.objectContaining({ title: 'Ticket deleted' }),
    )

    const t2 = createMockTicket({ id: 't2', number: 2, columnId: 'col-1' })
    useBoardStore.setState({
      projects: { [PROJECT_ID]: seedColumns([ticket, t2]) },
      _hasHydrated: true,
    })
    await deleteTickets({
      projectId: PROJECT_ID,
      tickets: [
        { ticket, columnId: 'col-1' },
        { ticket: t2, columnId: 'col-1' },
      ],
    })
    expect(showUndoRedoToast).toHaveBeenLastCalledWith(
      'error',
      expect.objectContaining({ title: '2 tickets deleted' }),
    )
  })

  it('invokes onComplete on both success and failure', async () => {
    const onComplete = vi.fn()
    await deleteTickets({
      projectId: PROJECT_ID,
      tickets: [{ ticket, columnId: 'col-1' }],
      onComplete,
    })
    expect(onComplete).toHaveBeenCalledTimes(1)

    mockApiFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? new Response(null, { status: 500 }) : okJson([]),
    )
    await deleteTickets({
      projectId: PROJECT_ID,
      tickets: [{ ticket, columnId: 'col-1' }],
      onComplete,
    })
    expect(onComplete).toHaveBeenCalledTimes(2)
  })
})

describe('restoreAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockApiFetch.mockResolvedValue(new Response(null, { status: 200 }))
  })

  it('does nothing for empty or undefined attachments', async () => {
    await restoreAttachments(PROJECT_ID, 'srv-1', undefined)
    await restoreAttachments(PROJECT_ID, 'srv-1', [])
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('does nothing in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await restoreAttachments(PROJECT_ID, 'srv-1', [
      { filename: 'a.png', mimeType: 'image/png', size: 1, url: '/u/a' },
    ])
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('POSTs the attachments to the restore endpoint', async () => {
    await restoreAttachments(PROJECT_ID, 'srv-1', [
      { filename: 'a.png', mimeType: 'image/png', size: 1, url: '/u/a' },
    ])
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/tickets/srv-1/attachments`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('swallows errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApiFetch.mockRejectedValue(new Error('boom'))
    await expect(
      restoreAttachments(PROJECT_ID, 'srv-1', [
        { filename: 'a.png', mimeType: 'image/png', size: 1, url: '/u/a' },
      ]),
    ).resolves.toBeUndefined()
  })
})

describe('restoreCommentsAndLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockApiFetch.mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
  })

  it('does nothing when restoreData is undefined', async () => {
    await restoreCommentsAndLinks(PROJECT_ID, 'srv-1', undefined)
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('does nothing in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await restoreCommentsAndLinks(PROJECT_ID, 'srv-1', {
      comments: [
        {
          content: 'hi',
          authorId: 'u1',
          isSystemGenerated: false,
          source: null,
          createdAt: '2024-01-01',
        },
      ],
      links: [],
      activities: [],
    })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('restores comments, links, and activities via their endpoints', async () => {
    await restoreCommentsAndLinks(
      PROJECT_ID,
      'srv-1',
      {
        comments: [
          {
            content: 'hi',
            authorId: 'u1',
            isSystemGenerated: false,
            source: null,
            createdAt: '2024-01-01',
          },
        ],
        links: [{ linkType: 'blocks', linkedTicketId: 't2', direction: 'outward' }],
        activities: [
          {
            action: 'created',
            field: null,
            oldValue: null,
            newValue: null,
            groupId: null,
            userId: 'u1',
            createdAt: '2024-01-01',
          },
        ],
      },
      ['auto-activity-1'],
    )

    const calledUrls = mockApiFetch.mock.calls.map(([url]) => url)
    expect(calledUrls).toContain(`/api/projects/${PROJECT_ID}/tickets/srv-1/comments/restore`)
    expect(calledUrls).toContain(`/api/projects/${PROJECT_ID}/tickets/srv-1/links/restore`)
    // Activities + auto-delete go through the global fetch
    const fetchUrls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => u)
    expect(fetchUrls).toContain(`/api/projects/${PROJECT_ID}/tickets/srv-1/activity/batch-delete`)
    expect(fetchUrls).toContain(`/api/projects/${PROJECT_ID}/tickets/srv-1/activity/restore`)
  })

  it('skips empty sections (no comments, links, or activities)', async () => {
    await restoreCommentsAndLinks(PROJECT_ID, 'srv-1', {
      comments: [],
      links: [],
      activities: [],
    })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})
