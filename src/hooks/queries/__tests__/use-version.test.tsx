import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { useCheckForUpdates, useLastUpdateCheck, useLocalVersion } from '../use-version'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
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
})

describe('useLocalVersion', () => {
  it('fetches the version in production', async () => {
    mockApiFetch.mockResolvedValue(ok({ version: '1.2.3' }))
    const { result } = renderHook(() => useLocalVersion(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.version).toBe('1.2.3')
  })

  it('returns the demo version in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useLocalVersion(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.version).toBe('0.0.0-demo')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('errors when the request fails', async () => {
    mockApiFetch.mockResolvedValue(new Response('x', { status: 500 }))
    const { result } = renderHook(() => useLocalVersion(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCheckForUpdates', () => {
  it('checks the API and caches the result', async () => {
    mockApiFetch.mockResolvedValue(ok({ updateAvailable: true }))
    const { result } = renderHook(() => useCheckForUpdates(), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ updateAvailable: true })
  })

  it('returns a disabled result in demo mode without hitting the API', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useCheckForUpdates(), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.error).toContain('disabled in demo mode')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

describe('useLastUpdateCheck', () => {
  it('does not auto-fetch (cache-only)', () => {
    const { result } = renderHook(() => useLastUpdateCheck(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
