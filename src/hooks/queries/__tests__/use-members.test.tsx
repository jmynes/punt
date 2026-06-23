import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useAddMember,
  useAvailableUsers,
  useProjectMembers,
  useRemoveMember,
  useUpdateMember,
} from '../use-members'

vi.mock('@/lib/base-path', () => ({
  apiFetch: vi.fn(),
  withBasePath: (p: string) => p,
}))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
  demoStorage: {
    getMembers: vi.fn(() => []),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
    addMember: vi.fn(),
  },
}))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const P = 'p1'

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}
function err(message: string, status = 400) {
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
})

describe('useProjectMembers', () => {
  it('fetches members via the API', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'm1' }]))
    const { result } = renderHook(() => useProjectMembers(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('maps demo members in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getMembers).mockReturnValue([
      {
        id: 'm1',
        roleId: 'r1',
        userId: 'u1',
        user: { id: 'u1', name: 'U', email: null, avatar: null, avatarColor: null },
        role: { id: 'r1', name: 'Owner', position: 0 },
      },
    ] as never)
    const { result } = renderHook(() => useProjectMembers(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]).toMatchObject({ id: 'm1', userId: 'u1', projectId: P })
  })

  it('throws the server error message', async () => {
    mockApiFetch.mockResolvedValue(err('forbidden', 403))
    const { result } = renderHook(() => useProjectMembers(P), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('forbidden')
  })

  it('is disabled without a projectId', () => {
    const { result } = renderHook(() => useProjectMembers(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useUpdateMember', () => {
  it('PATCHes in production and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'm1' }))
    const { result } = renderHook(() => useUpdateMember(P), { wrapper })
    result.current.mutate({ memberId: 'm1', roleId: 'r2' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/members/m1`,
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Member updated')
  })

  it('uses demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useUpdateMember(P), { wrapper })
    result.current.mutate({ memberId: 'm1', roleId: 'r2' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.updateMember).toHaveBeenCalledWith(P, 'm1', { roleId: 'r2' })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(err('bad role'))
    const { result } = renderHook(() => useUpdateMember(P), { wrapper })
    result.current.mutate({ memberId: 'm1', roleId: 'r2' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('bad role')
  })
})

describe('useRemoveMember', () => {
  it('DELETEs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useRemoveMember(P), { wrapper })
    result.current.mutate('m1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/members/m1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Member removed')
  })

  it('uses demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useRemoveMember(P), { wrapper })
    result.current.mutate('m1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.removeMember).toHaveBeenCalledWith(P, 'm1')
  })
})

describe('useAddMember', () => {
  it('POSTs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'm2' }))
    const { result } = renderHook(() => useAddMember(P), { wrapper })
    result.current.mutate({ userId: 'u2', roleId: 'r1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/members`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Member added')
  })

  it('uses demoStorage in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useAddMember(P), { wrapper })
    result.current.mutate({ userId: 'u2', roleId: 'r1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(demoStorage.addMember).toHaveBeenCalledWith(P, { userId: 'u2', roleId: 'r1' })
  })
})

describe('useAvailableUsers', () => {
  it('returns an empty list in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useAvailableUsers(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('fetches with a search param in production', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 'u3', name: 'U3' }]))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAvailableUsers(P, 'alice'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain(`/api/projects/${P}/available-users`)
    expect(calledUrl).toContain('search=alice')
  })
})
