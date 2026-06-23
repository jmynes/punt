import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { useEmailVerificationStatus } from '../use-email-verification'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
const mockApiFetch = vi.mocked(apiFetch)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useEmailVerificationStatus', () => {
  it('fetches the verification status', async () => {
    mockApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ email: 'a@b.com', emailVerified: true }), { status: 200 }),
    )
    const { result } = renderHook(() => useEmailVerificationStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.emailVerified).toBe(true)
  })

  it('throws when the request fails', async () => {
    mockApiFetch.mockResolvedValue(new Response('x', { status: 500 }))
    const { result } = renderHook(() => useEmailVerificationStatus(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
