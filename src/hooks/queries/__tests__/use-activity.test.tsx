import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTicketActivity } from '../use-activity'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useTicketActivity', () => {
  it('fetches the first page and exposes the next cursor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          entries: [{ type: 'comment', id: 'e1' }],
          nextCursor: 'c2',
          hasMore: true,
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useTicketActivity('p1', 't1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0].entries).toHaveLength(1)
    expect(result.current.hasNextPage).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/projects/p1/tickets/t1/activity?')
  })

  it('is disabled without ids', () => {
    const { result } = renderHook(() => useTicketActivity('p1', ''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 })),
    )
    const { result } = renderHook(() => useTicketActivity('p1', 't1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('boom')
  })
})
