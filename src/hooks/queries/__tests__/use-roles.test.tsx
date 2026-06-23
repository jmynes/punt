import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { demoStorage, isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useCreateRole,
  useDeleteRole,
  useProjectRoles,
  useReorderRoles,
  useResetRolesToDefaults,
  useRole,
  useRoleDefaults,
  useUpdateRole,
} from '../use-roles'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
  demoStorage: { getRoles: vi.fn(() => []) },
}))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)
const P = 'p1'

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
  mockApiFetch.mockResolvedValue(ok([]))
})

describe('useProjectRoles', () => {
  it('fetches roles via the API', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'r1', name: 'Owner' }]))
    const { result } = renderHook(() => useProjectRoles(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('returns demo roles with full permissions in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    vi.mocked(demoStorage.getRoles).mockReturnValue([{ id: 'r1', name: 'Owner' }] as never)
    const { result } = renderHook(() => useProjectRoles(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].permissions.length).toBeGreaterThan(0)
  })

  it('is disabled without a projectId', () => {
    const { result } = renderHook(() => useProjectRoles(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a server error', async () => {
    mockApiFetch.mockResolvedValue(fail('forbidden', 403))
    const { result } = renderHook(() => useProjectRoles(P), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('forbidden')
  })
})

describe('useRole / useRoleDefaults', () => {
  it('useRole fetches a single role', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'r1' }))
    const { result } = renderHook(() => useRole(P, 'r1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: 'r1' })
  })

  it('useRoleDefaults fetches in production and is disabled in demo mode', async () => {
    mockApiFetch.mockResolvedValue(ok({ defaults: true }))
    const { result } = renderHook(() => useRoleDefaults(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    mockIsDemoMode.mockReturnValue(true)
    const { result: demo } = renderHook(() => useRoleDefaults(P), { wrapper })
    expect(demo.current.fetchStatus).toBe('idle')
  })
})

describe('role mutations (production)', () => {
  it('useCreateRole POSTs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'r2' }))
    const { result } = renderHook(() => useCreateRole(P), { wrapper })
    result.current.mutate({ name: 'New', color: '#fff', permissions: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/roles`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(showToast.success).toHaveBeenCalledWith('Role created')
  })

  it('useUpdateRole PATCHes and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 'r1' }))
    const { result } = renderHook(() => useUpdateRole(P), { wrapper })
    result.current.mutate({ roleId: 'r1', name: 'Renamed' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Role updated')
  })

  it('useDeleteRole DELETEs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useDeleteRole(P), { wrapper })
    result.current.mutate('r1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Role deleted')
  })

  it('useResetRolesToDefaults POSTs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'r1' }]))
    const { result } = renderHook(() => useResetRolesToDefaults(P), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Roles reset to system defaults')
  })

  it('useCreateRole toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('dup name'))
    const { result } = renderHook(() => useCreateRole(P), { wrapper })
    result.current.mutate({ name: 'New', color: '#fff', permissions: [] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('dup name')
  })

  it('useReorderRoles POSTs the new order', async () => {
    mockApiFetch.mockResolvedValue(ok([{ id: 'r2' }, { id: 'r1' }]))
    const { result } = renderHook(() => useReorderRoles(P), { wrapper })
    result.current.mutate(['r2', 'r1'])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/projects/${P}/roles/reorder`,
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('role mutations (demo mode operate on the query cache)', () => {
  beforeEach(() => mockIsDemoMode.mockReturnValue(true))

  it('useCreateRole adds the role without hitting the API', async () => {
    const { result } = renderHook(() => useCreateRole(P), { wrapper })
    result.current.mutate({ name: 'Demo Role', color: '#fff', permissions: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(showToast.success).toHaveBeenCalledWith('Role created')
  })

  it('useDeleteRole removes from the cache without hitting the API', async () => {
    const { result } = renderHook(() => useDeleteRole(P), { wrapper })
    result.current.mutate('r1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(showToast.success).toHaveBeenCalledWith('Role deleted')
  })
})
