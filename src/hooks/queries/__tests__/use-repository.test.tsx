import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useCommitPatterns,
  useRepositoryConfig,
  useUpdateRepository,
  useWebhookSecret,
} from '../use-repository'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
  demoStorage: { getProjects: vi.fn(() => []) },
}))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const KEY = 'PUNT'

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
  mockApiFetch.mockResolvedValue(ok({ projectKey: KEY }))
})

describe('useRepositoryConfig', () => {
  it('fetches config via the API', async () => {
    mockApiFetch.mockResolvedValue(ok({ projectKey: KEY, repositoryUrl: 'https://x' }))
    const { result } = renderHook(() => useRepositoryConfig(KEY), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.repositoryUrl).toBe('https://x')
  })

  it('returns demo defaults in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getProjects).mockReturnValue([
      { id: 'p1', key: KEY, name: 'Punt' },
    ] as never)
    const { result } = renderHook(() => useRepositoryConfig(KEY), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      projectKey: KEY,
      effectiveBranchTemplate: '{type}/{key}-{slug}',
    })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('surfaces a server error', async () => {
    mockApiFetch.mockResolvedValue(fail('forbidden', 403))
    const { result } = renderHook(() => useRepositoryConfig(KEY), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('forbidden')
  })
})

describe('useUpdateRepository', () => {
  it('PATCHes and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ projectKey: KEY }))
    const { result } = renderHook(() => useUpdateRepository(KEY), { wrapper })
    result.current.mutate({ repositoryUrl: 'https://y' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${KEY}/repository`,
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Repository settings updated')
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('bad url'))
    const { result } = renderHook(() => useUpdateRepository(KEY), { wrapper })
    result.current.mutate({ repositoryUrl: 'nope' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('bad url')
  })

  it('merges into the cache in demo mode without hitting the API', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useUpdateRepository(KEY), { wrapper })
    result.current.mutate({ branchTemplate: '{key}' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(result.current.data?.effectiveBranchTemplate).toBe('{key}')
  })
})

describe('useCommitPatterns', () => {
  it('PATCHes patterns and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ projectKey: KEY }))
    const { result } = renderHook(() => useCommitPatterns(KEY), { wrapper })
    result.current.mutate([{ id: '1', pattern: 'closes', action: 'close' }])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Commit patterns updated')
  })
})

describe('useWebhookSecret', () => {
  it('generates a secret and toasts', async () => {
    mockApiFetch.mockResolvedValue(ok({ projectKey: KEY, hasWebhookSecret: true }))
    const { result } = renderHook(() => useWebhookSecret(KEY), { wrapper })
    result.current.mutate('generate')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Webhook secret generated')
  })

  it('clears a secret and toasts', async () => {
    mockApiFetch.mockResolvedValue(ok({ projectKey: KEY, hasWebhookSecret: false }))
    const { result } = renderHook(() => useWebhookSecret(KEY), { wrapper })
    result.current.mutate('clear')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Webhook secret removed')
  })

  it('generates a demo secret without hitting the API', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useWebhookSecret(KEY), { wrapper })
    result.current.mutate('generate')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.webhookSecret).toContain('demo-whsec-')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})
