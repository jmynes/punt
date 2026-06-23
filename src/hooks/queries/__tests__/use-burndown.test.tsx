import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDataProvider } from '@/lib/data-provider'
import { useBurndownData } from '../use-burndown'

vi.mock('@/lib/data-provider', () => ({ getDataProvider: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))

const mockGetDataProvider = vi.mocked(getDataProvider)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useBurndownData', () => {
  it('fetches burndown data for a sprint', async () => {
    const getBurndownData = vi.fn().mockResolvedValue({ unit: 'points', dataPoints: [] })
    mockGetDataProvider.mockReturnValue({ getBurndownData } as never)
    const { result } = renderHook(() => useBurndownData('p1', 's1', 'points'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getBurndownData).toHaveBeenCalledWith('p1', 's1', 'points')
  })

  it('is disabled without a sprintId', () => {
    mockGetDataProvider.mockReturnValue({ getBurndownData: vi.fn() } as never)
    const { result } = renderHook(() => useBurndownData('p1', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
