import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useAddComment,
  useDeleteComment,
  useTicketComments,
  useUpdateComment,
} from '../use-comments'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
  demoStorage: {
    getComments: vi.fn(() => []),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({})))
})

describe('useTicketComments', () => {
  it('fetches comments via the API', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'c1', content: 'hi' }]))
    const { result } = renderHook(() => useTicketComments(P, T), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('maps demo comments to ISO strings', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getComments).mockReturnValue([
      {
        id: 'c1',
        content: 'hi',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ] as never)
    const { result } = renderHook(() => useTicketComments(P, T), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(typeof result.current.data?.[0].createdAt).toBe('string')
  })

  it('is disabled without ids', () => {
    const { result } = renderHook(() => useTicketComments(P, ''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useAddComment', () => {
  it('POSTs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'c1', content: 'hi' }))
    const { result } = renderHook(() => useAddComment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, ticketKey: 'PUNT-1', content: 'hi' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Comment added to PUNT-1')
  })

  it('creates via demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.createComment).mockReturnValue({
      id: 'c1',
      content: 'hi',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    const { result } = renderHook(() => useAddComment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, ticketKey: 'PUNT-1', content: 'hi' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.createComment).toHaveBeenCalled()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('too long'))
    const { result } = renderHook(() => useAddComment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, ticketKey: 'PUNT-1', content: 'hi' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('too long')
  })
})

describe('useUpdateComment', () => {
  it('PATCHes via global fetch and toasts success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'c1', content: 'edited' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useUpdateComment(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      ticketKey: 'PUNT-1',
      commentId: 'c1',
      content: 'edited',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${P}/tickets/${T}/comments/c1`,
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Comment updated on PUNT-1')
  })

  it('toasts on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail('forbidden')))
    const { result } = renderHook(() => useUpdateComment(), { wrapper })
    result.current.mutate({
      projectId: P,
      ticketId: T,
      ticketKey: 'PUNT-1',
      commentId: 'c1',
      content: 'edited',
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('forbidden')
  })
})

describe('useDeleteComment', () => {
  it('DELETEs via global fetch and toasts success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDeleteComment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, ticketKey: 'PUNT-1', commentId: 'c1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${P}/tickets/${T}/comments/c1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Comment deleted from PUNT-1')
  })

  it('deletes via demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useDeleteComment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, ticketKey: 'PUNT-1', commentId: 'c1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.deleteComment).toHaveBeenCalledWith(P, T, 'c1')
  })
})
