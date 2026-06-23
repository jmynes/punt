import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { apiFetch } from '@/lib/base-path'
import { getDataProvider } from '@/lib/data-provider'
import { showToast } from '@/lib/toast'
import { useBoardStore } from '@/stores/board-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import {
  batchCreateTicketsAPI,
  batchDeleteTicketsAPI,
  createTicketAPI,
  deleteTicketAPI,
  updateTicketAPI,
  useColumnsByProject,
  useCreateTicket,
  useDeleteTicket,
  useProjectSprints,
  useTicketSearch,
  useTicketSprintHistory,
  useTicketsByProject,
  useUpdateTicket,
} from '../use-tickets'

vi.mock('@/lib/data-provider', () => ({ getDataProvider: vi.fn() }))
vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))

const mockGetDataProvider = vi.mocked(getDataProvider)
const mockApiFetch = vi.mocked(apiFetch)
const P = 'p1'

let provider: Record<string, ReturnType<typeof vi.fn>>

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function seedBoard(tickets: TicketWithRelations[] = []) {
  const columns: ColumnWithTickets[] = [
    { id: 'col-1', name: 'To Do', order: 0, projectId: P, tickets },
    { id: 'col-2', name: 'Done', order: 1, projectId: P, tickets: [] },
  ]
  useBoardStore.setState({ projects: { [P]: columns }, _hasHydrated: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  provider = {
    getColumnsWithTickets: vi.fn().mockResolvedValue([]),
    getTickets: vi.fn().mockResolvedValue([]),
    createTicket: vi.fn(),
    updateTicket: vi.fn(),
    deleteTicket: vi.fn().mockResolvedValue(undefined),
    getSprints: vi.fn().mockResolvedValue([]),
    getLabels: vi.fn().mockResolvedValue([]),
    searchTickets: vi.fn().mockResolvedValue([]),
  }
  mockGetDataProvider.mockReturnValue(provider as never)
  seedBoard()
})

describe('imperative API helpers', () => {
  it('createTicketAPI delegates to the provider', async () => {
    provider.createTicket.mockResolvedValue(createMockTicket({ id: 'srv-1' }))
    const result = await createTicketAPI(P, 'col-1', { title: 'T' })
    expect(result.id).toBe('srv-1')
    expect(provider.createTicket).toHaveBeenCalled()
  })

  it('deleteTicketAPI skips the API for temp ticket ids', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await deleteTicketAPI(P, 'ticket-temp-1')
    expect(provider.deleteTicket).not.toHaveBeenCalled()
  })

  it('deleteTicketAPI deletes real ticket ids', async () => {
    await deleteTicketAPI(P, 'srv-1')
    expect(provider.deleteTicket).toHaveBeenCalledWith(P, 'srv-1')
  })

  it('updateTicketAPI returns the updates as-is for temp ids without calling the API', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await updateTicketAPI(P, 'ticket-temp-1', { title: 'X' })
    expect(result).toMatchObject({ id: 'ticket-temp-1', title: 'X' })
    expect(provider.updateTicket).not.toHaveBeenCalled()
  })

  it('updateTicketAPI calls the provider for real ids', async () => {
    provider.updateTicket.mockResolvedValue(createMockTicket({ id: 'srv-1', title: 'X' }))
    await updateTicketAPI(P, 'srv-1', { title: 'X' })
    expect(provider.updateTicket).toHaveBeenCalled()
  })

  it('batchCreateTicketsAPI maps temp ids to created server tickets and skips failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    provider.createTicket
      .mockResolvedValueOnce(createMockTicket({ id: 'srv-a' }))
      .mockRejectedValueOnce(new Error('boom'))

    const map = await batchCreateTicketsAPI(P, [
      { tempId: 'tmp-a', columnId: 'col-1', ticketData: { title: 'A' } },
      { tempId: 'tmp-b', columnId: 'col-1', ticketData: { title: 'B' } },
    ])

    expect(map.get('tmp-a')?.id).toBe('srv-a')
    expect(map.has('tmp-b')).toBe(false)
  })

  it('batchDeleteTicketsAPI splits succeeded and failed ids', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    provider.deleteTicket.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('nope'))
    const result = await batchDeleteTicketsAPI(P, ['srv-1', 'srv-2'])
    expect(result.succeeded).toEqual(['srv-1'])
    expect(result.failed).toEqual(['srv-2'])
  })
})

describe('query hooks', () => {
  it('useColumnsByProject maps columns and syncs the board', async () => {
    provider.getColumnsWithTickets.mockResolvedValue([
      { id: 'col-1', name: 'To Do', order: 0, projectId: P, tickets: [] },
    ])
    const { result } = renderHook(() => useColumnsByProject(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]).toMatchObject({ id: 'col-1', icon: null })
  })

  it('useColumnsByProject respects enabled: false', () => {
    const { result } = renderHook(() => useColumnsByProject(P, { enabled: false }), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('useTicketsByProject fetches and syncs tickets to the board', async () => {
    provider.getTickets.mockResolvedValue([createMockTicket({ id: 't1', columnId: 'col-1' })])
    const { result } = renderHook(() => useTicketsByProject(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() => {
      const ids = useBoardStore
        .getState()
        .getColumns(P)
        .flatMap((c) => c.tickets.map((t) => t.id))
      expect(ids).toContain('t1')
    })
  })

  it('useProjectSprints fetches via the provider', async () => {
    provider.getSprints.mockResolvedValue([{ id: 's1' }])
    const { result } = renderHook(() => useProjectSprints(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('useTicketSearch is disabled for an empty query and runs for a non-empty one', async () => {
    const { result: idle } = renderHook(() => useTicketSearch(P, '  '), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')

    provider.searchTickets.mockResolvedValue([createMockTicket({ id: 't1' })])
    const { result } = renderHook(() => useTicketSearch(P, 'bug'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.searchTickets).toHaveBeenCalledWith(P, { query: 'bug', limit: 20 })
  })

  it('useTicketSprintHistory fetches history and is disabled without a ticketId', async () => {
    const { result: idle } = renderHook(() => useTicketSprintHistory(P, undefined), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')

    mockApiFetch.mockResolvedValue(new Response(JSON.stringify([{ id: 'h1' }]), { status: 200 }))
    const { result } = renderHook(() => useTicketSprintHistory(P, 't1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('useTicketSprintHistory surfaces a fetch error', async () => {
    mockApiFetch.mockResolvedValue(new Response('x', { status: 500 }))
    const { result } = renderHook(() => useTicketSprintHistory(P, 't1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('ticket mutations', () => {
  it('useCreateTicket optimistically adds the temp ticket then swaps in the server ticket', async () => {
    const temp = createMockTicket({ id: 'ticket-temp', columnId: 'col-1' })
    provider.createTicket.mockResolvedValue(createMockTicket({ id: 'srv-1', columnId: 'col-1' }))

    const { result } = renderHook(() => useCreateTicket(), { wrapper })
    result.current.mutate({
      projectId: P,
      columnId: 'col-1',
      data: { title: 'T' },
      tempTicket: temp,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const ids = useBoardStore
      .getState()
      .getColumns(P)
      .flatMap((c) => c.tickets.map((t) => t.id))
    expect(ids).toContain('srv-1')
    expect(ids).not.toContain('ticket-temp')
  })

  it('useCreateTicket rolls back and toasts on error', async () => {
    const temp = createMockTicket({ id: 'ticket-temp', columnId: 'col-1' })
    provider.createTicket.mockRejectedValue(new Error('failed'))

    const { result } = renderHook(() => useCreateTicket(), { wrapper })
    result.current.mutate({
      projectId: P,
      columnId: 'col-1',
      data: { title: 'T' },
      tempTicket: temp,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const ids = useBoardStore
      .getState()
      .getColumns(P)
      .flatMap((c) => c.tickets.map((t) => t.id))
    expect(ids).not.toContain('ticket-temp')
    expect(showToast.error).toHaveBeenCalledWith('failed')
  })

  it('useUpdateTicket applies the change optimistically and rolls back on error', async () => {
    seedBoard([createMockTicket({ id: 't1', columnId: 'col-1', priority: 'low' })])
    provider.updateTicket.mockRejectedValue(new Error('nope'))

    const { result } = renderHook(() => useUpdateTicket(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: 't1',
      updates: { priority: 'high' },
      previousTicket: createMockTicket({ id: 't1' }),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const t = useBoardStore
      .getState()
      .getColumns(P)
      .flatMap((c) => c.tickets)
      .find((t) => t.id === 't1')
    expect(t?.priority).toBe('low') // restored
    expect(showToast.error).toHaveBeenCalledWith('nope')
  })

  it('useDeleteTicket optimistically removes then restores on error', async () => {
    const ticket = createMockTicket({ id: 't1', columnId: 'col-1' })
    seedBoard([ticket])
    provider.deleteTicket.mockRejectedValue(new Error('cannot'))

    const { result } = renderHook(() => useDeleteTicket(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: 't1',
      columnId: 'col-1',
      deletedTicket: ticket,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const ids = useBoardStore
      .getState()
      .getColumns(P)
      .flatMap((c) => c.tickets.map((t) => t.id))
    expect(ids).toContain('t1') // restored
    expect(showToast.error).toHaveBeenCalledWith('cannot')
  })
})
