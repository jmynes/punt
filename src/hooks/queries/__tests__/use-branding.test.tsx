import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDataProvider } from '@/lib/data-provider'
import { useBranding } from '../use-branding'

vi.mock('@/lib/data-provider', () => ({ getDataProvider: vi.fn() }))

const mockGetDataProvider = vi.mocked(getDataProvider)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useBranding', () => {
  it('fetches branding through the data provider', async () => {
    const getBranding = vi.fn().mockResolvedValue({ appName: 'PUNT' })
    mockGetDataProvider.mockReturnValue({ getBranding } as never)
    const { result } = renderHook(() => useBranding(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ appName: 'PUNT' })
  })
})
