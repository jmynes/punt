import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { showToast } from '@/lib/toast'
import {
  useChatSession,
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useRenameChatSession,
} from '../use-chat-sessions'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))

const mockApiFetch = vi.mocked(apiFetch)

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
function fail(status = 500) {
  return new Response('x', { status })
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockResolvedValue(ok([]))
})

describe('useChatSessions', () => {
  it('fetches sessions, scoping by project when provided', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'cs1' }]))
    const { result } = renderHook(() => useChatSessions('p1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith('/api/chat/sessions?projectId=p1')
  })

  it('errors when the request fails', async () => {
    mockApiFetch.mockResolvedValue(fail())
    const { result } = renderHook(() => useChatSessions(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useChatSession', () => {
  it('is disabled without a sessionId', () => {
    const { result } = renderHook(() => useChatSession(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches a session by id', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'cs1', messages: [] }))
    const { result } = renderHook(() => useChatSession('cs1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: 'cs1' })
  })
})

describe('chat session mutations', () => {
  it('useCreateChatSession POSTs', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'cs2' }))
    const { result } = renderHook(() => useCreateChatSession(), { wrapper })
    result.current.mutate({ name: 'Chat', projectId: 'p1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/chat/sessions',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('useRenameChatSession toasts success and error', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'cs1' }))
    const { result } = renderHook(() => useRenameChatSession(), { wrapper })
    result.current.mutate({ sessionId: 'cs1', name: 'Renamed' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Conversation renamed')

    mockApiFetch.mockResolvedValue(fail())
    const { result: r2 } = renderHook(() => useRenameChatSession(), { wrapper })
    r2.current.mutate({ sessionId: 'cs1', name: 'Renamed' })
    await waitFor(() => expect(r2.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('Failed to rename conversation')
  })

  it('useDeleteChatSession toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useDeleteChatSession(), { wrapper })
    result.current.mutate('cs1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Conversation deleted')
  })
})
