import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useAddAttachments,
  useRemoveAttachment,
  useTicketAttachments,
  useUploadConfig,
} from '../use-attachments'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))

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

const attachment = {
  filename: 'f.png',
  originalName: 'f.png',
  mimeType: 'image/png',
  size: 10,
  url: '/u/f',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDemoMode.mockReturnValue(false)
  mockApiFetch.mockResolvedValue(ok([]))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({})))
})

describe('useUploadConfig', () => {
  it('fetches the upload config', async () => {
    mockApiFetch.mockResolvedValue(ok({ allowedTypes: ['image/png'] }))
    const { result } = renderHook(() => useUploadConfig(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.allowedTypes).toContain('image/png')
  })

  it('errors when the request fails', async () => {
    mockApiFetch.mockResolvedValue(new Response('x', { status: 500 }))
    const { result } = renderHook(() => useUploadConfig(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useTicketAttachments', () => {
  it('fetches attachments and is disabled without ids', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'a1' }]))
    const { result } = renderHook(() => useTicketAttachments(P, T), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)

    const { result: idle } = renderHook(() => useTicketAttachments(P, ''), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')
  })
})

describe('useAddAttachments', () => {
  it('POSTs in production', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'a1' }]))
    const { result } = renderHook(() => useAddAttachments(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, attachments: [attachment] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/tickets/${T}/attachments`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns mock attachments in demo mode without hitting the API', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useAddAttachments(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, attachments: [attachment] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('too big'))
    const { result } = renderHook(() => useAddAttachments(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, attachments: [attachment] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('too big')
  })
})

describe('useRemoveAttachment', () => {
  it('DELETEs via global fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRemoveAttachment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, attachmentId: 'a1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${P}/tickets/${T}/attachments/a1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('is a no-op in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRemoveAttachment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, attachmentId: 'a1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('toasts on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail('forbidden')))
    const { result } = renderHook(() => useRemoveAttachment(), { wrapper })
    result.current.mutate({ projectId: P, ticketId: T, attachmentId: 'a1' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('forbidden')
  })
})
