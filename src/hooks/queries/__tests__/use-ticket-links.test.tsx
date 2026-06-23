import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useCreateTicketLink,
  useCreateTicketLinks,
  useDeleteTicketLink,
  useTicketLinks,
  useUpdateTicketLink,
} from '../use-ticket-links'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({
  showToast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
  demoStorage: {
    getTicketLinks: vi.fn(() => []),
    getTicket: vi.fn(),
    createTicketLink: vi.fn(),
    deleteTicketLink: vi.fn(),
  },
}))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const P = 'p1'
const T = 't1'

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
function fail(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status })
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDemoMode.mockReturnValue(false)
  mockApiFetch.mockResolvedValue(ok([]))
})

describe('useTicketLinks', () => {
  it('fetches links via the API', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'lk1' }]))
    const { result } = renderHook(() => useTicketLinks(P, T), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('maps demo links with direction, dropping links to missing tickets', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getTicketLinks).mockReturnValue([
      { id: 'lk1', sourceTicketId: T, targetTicketId: 'tgt', linkType: 'blocks' },
      { id: 'lk2', sourceTicketId: T, targetTicketId: 'gone', linkType: 'blocks' },
    ] as never)
    vi.mocked(demoStorage.getTicket).mockImplementation((_p, id) =>
      id === 'tgt'
        ? ({
            id: 'tgt',
            number: 2,
            title: 'Target',
            type: 'task',
            priority: 'medium',
            columnId: 'c',
            resolution: null,
            storyPoints: null,
            assignee: null,
          } as never)
        : (undefined as never),
    )

    const { result } = renderHook(() => useTicketLinks(P, T), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]).toMatchObject({ id: 'lk1', direction: 'outward' })
  })

  it('is disabled when enabled is false', () => {
    const { result } = renderHook(() => useTicketLinks(P, T, { enabled: false }), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a server error', async () => {
    mockApiFetch.mockResolvedValue(fail('forbidden', 403))
    const { result } = renderHook(() => useTicketLinks(P, T), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('forbidden')
  })
})

describe('useCreateTicketLink', () => {
  it('POSTs in production', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'lk1' }))
    const { result } = renderHook(() => useCreateTicketLink(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, linkType: 'blocks', targetTicketId: 'tgt' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/tickets/${T}/links`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('creates via demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.createTicketLink).mockReturnValue({ id: 'lk1' } as never)
    vi.mocked(demoStorage.getTicket).mockReturnValue(undefined as never)
    const { result } = renderHook(() => useCreateTicketLink(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, linkType: 'blocks', targetTicketId: 'tgt' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.createTicketLink).toHaveBeenCalled()
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('dup link'))
    const { result } = renderHook(() => useCreateTicketLink(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, linkType: 'blocks', targetTicketId: 'tgt' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('dup link')
  })
})

describe('useUpdateTicketLink', () => {
  it('PATCHes and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useUpdateTicketLink(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      linkId: 'lk1',
      linkType: 'relates_to',
      targetTicketId: 'tgt',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Link type updated')
  })

  it('delete-and-recreates in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getTicketLinks).mockReturnValue([
      { id: 'lk1', sourceTicketId: T, targetTicketId: 'tgt', linkType: 'blocks' },
    ] as never)
    const { result } = renderHook(() => useUpdateTicketLink(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      linkId: 'lk1',
      linkType: 'relates_to',
      targetTicketId: 'tgt',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.deleteTicketLink).toHaveBeenCalledWith(P, 'lk1')
    expect(demoStorage.createTicketLink).toHaveBeenCalled()
  })
})

describe('useCreateTicketLinks (bulk)', () => {
  it('toasts a single success when all links succeed', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'lk1' }))
    const { result } = renderHook(() => useCreateTicketLinks(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      links: [{ linkType: 'blocks', targetTicketId: 'tgt' }],
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Link created')
  })

  it('warns when some links fail', async () => {
    mockApiFetch.mockResolvedValueOnce(ok({ id: 'lk1' })).mockResolvedValueOnce(fail('exists'))
    const { result } = renderHook(() => useCreateTicketLinks(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      links: [
        { linkType: 'blocks', targetTicketId: 'a' },
        { linkType: 'blocks', targetTicketId: 'b' },
      ],
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.warning).toHaveBeenCalledWith('1 link(s) created, 1 failed')
  })

  it('errors when all links fail', async () => {
    mockApiFetch.mockResolvedValue(fail('exists'))
    const { result } = renderHook(() => useCreateTicketLinks(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      links: [{ linkType: 'blocks', targetTicketId: 'a' }],
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('Failed to create 1 link(s)')
  })
})

describe('useDeleteTicketLink', () => {
  it('DELETEs in production', async () => {
    mockApiFetch.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useDeleteTicketLink(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, linkId: 'lk1', targetTicketId: 'tgt' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/tickets/${T}/links/lk1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('uses demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteTicketLink(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, linkId: 'lk1', targetTicketId: 'tgt' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.deleteTicketLink).toHaveBeenCalledWith(P, 'lk1')
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('nope'))
    const { result } = renderHook(() => useDeleteTicketLink(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, linkId: 'lk1', targetTicketId: 'tgt' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('nope')
  })
})
