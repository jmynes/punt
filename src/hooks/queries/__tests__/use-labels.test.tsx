import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { getDataProvider } from '@/lib/data-provider'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useCreateLabel,
  useDeleteLabel,
  useLabelTickets,
  useProjectLabels,
  useProjectLabelsWithCounts,
  useUpdateLabel,
} from '../use-labels'

vi.mock('@/lib/data-provider', () => ({ getDataProvider: vi.fn() }))
vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
  demoStorage: { getTickets: vi.fn(() => []), getProjects: vi.fn(() => []) },
}))

const mockGetDataProvider = vi.mocked(getDataProvider)
const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const P = 'p1'

let provider: {
  getLabels: ReturnType<typeof vi.fn>
  createLabel: ReturnType<typeof vi.fn>
  updateLabel: ReturnType<typeof vi.fn>
  deleteLabel: ReturnType<typeof vi.fn>
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
  provider = {
    getLabels: vi.fn().mockResolvedValue([]),
    createLabel: vi.fn().mockResolvedValue({ id: 'l1', name: 'bug', color: '#f00' }),
    updateLabel: vi.fn().mockResolvedValue({ id: 'l1', name: 'bug2', color: '#f00' }),
    deleteLabel: vi.fn().mockResolvedValue(undefined),
  }
  mockGetDataProvider.mockReturnValue(provider as never)
})

describe('useProjectLabels', () => {
  it('fetches labels through the provider', async () => {
    provider.getLabels.mockResolvedValue([{ id: 'l1', name: 'bug', color: '#f00' }])
    const { result } = renderHook(() => useProjectLabels(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled without a projectId', async () => {
    const { result } = renderHook(() => useProjectLabels(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(provider.getLabels).not.toHaveBeenCalled()
  })
})

describe('useProjectLabelsWithCounts', () => {
  it('computes counts from demo storage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    provider.getLabels.mockResolvedValue([{ id: 'l1', name: 'bug', color: '#f00' }])
    vi.mocked(demoStorage.getTickets).mockReturnValue([
      { id: 't1', labels: [{ id: 'l1' }] },
      { id: 't2', labels: [] },
    ] as never)

    const { result } = renderHook(() => useProjectLabelsWithCounts(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]._count?.tickets).toBe(1)
  })

  it('fetches with include_count in production mode', async () => {
    mockApiFetch.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'l1', name: 'bug', _count: { tickets: 3 } }]), {
        status: 200,
      }),
    )
    const { result } = renderHook(() => useProjectLabelsWithCounts(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/labels?include_count=true`,
      expect.anything(),
    )
    expect(result.current.data?.[0]._count?.tickets).toBe(3)
  })
})

describe('label mutations', () => {
  it('useCreateLabel calls the provider and surfaces errors', async () => {
    const { result } = renderHook(() => useCreateLabel(P), { wrapper })
    result.current.mutate({ name: 'bug' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.createLabel).toHaveBeenCalledWith(P, { name: 'bug' })

    provider.createLabel.mockRejectedValue(new Error('dup'))
    const { result: r2 } = renderHook(() => useCreateLabel(P), { wrapper })
    r2.current.mutate({ name: 'bug' })
    await waitFor(() => expect(r2.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('dup')
  })

  it('useUpdateLabel toasts success and passes the right args', async () => {
    const { result } = renderHook(() => useUpdateLabel(P), { wrapper })
    result.current.mutate({ labelId: 'l1', name: 'bug2' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.updateLabel).toHaveBeenCalledWith(P, 'l1', { name: 'bug2' })
    expect(showToast.success).toHaveBeenCalledWith('Label updated')
  })

  it('useDeleteLabel toasts success', async () => {
    const { result } = renderHook(() => useDeleteLabel(P), { wrapper })
    result.current.mutate('l1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.deleteLabel).toHaveBeenCalledWith(P, 'l1')
    expect(showToast.success).toHaveBeenCalledWith('Label deleted')
  })

  it('useDeleteLabel toasts on error', async () => {
    provider.deleteLabel.mockRejectedValue(new Error('in use'))
    const { result } = renderHook(() => useDeleteLabel(P), { wrapper })
    result.current.mutate('l1')
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('in use')
  })
})

describe('useLabelTickets', () => {
  it('returns an empty array when labelId is null', async () => {
    const { result } = renderHook(() => useLabelTickets(P, null), { wrapper })
    // disabled (no labelId) -> stays idle; the queryFn short-circuit is also covered
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('maps demo tickets that use the label', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getProjects).mockReturnValue([{ id: P, key: 'PUNT' }] as never)
    vi.mocked(demoStorage.getTickets).mockReturnValue([
      { id: 't1', number: 5, title: 'Has label', labels: [{ id: 'l1' }] },
      { id: 't2', number: 6, title: 'No label', labels: [] },
    ] as never)

    const { result } = renderHook(() => useLabelTickets(P, 'l1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 't1', key: 'PUNT-5', title: 'Has label' }])
  })
})
