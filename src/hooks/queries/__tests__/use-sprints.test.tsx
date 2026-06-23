import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDataProvider } from '@/lib/data-provider'
import { showToast } from '@/lib/toast'
import {
  useActiveSprint,
  useCompleteSprint,
  useCreateSprint,
  useDeleteSprint,
  useExtendSprint,
  useProjectSprints,
  useReopenSprint,
  useSprintDetail,
  useSprintSettings,
  useStartSprint,
  useUpdateSprint,
  useUpdateSprintSettings,
  useUpdateTicketSprint,
} from '../use-sprints'

vi.mock('@/lib/data-provider', () => ({ getDataProvider: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }))

const mockGetDataProvider = vi.mocked(getDataProvider)
const P = 'p1'
let provider: Record<string, ReturnType<typeof vi.fn>>

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  provider = {
    getSprints: vi.fn().mockResolvedValue([]),
    getActiveSprint: vi.fn().mockResolvedValue(null),
    getSprintSettings: vi.fn().mockResolvedValue({ defaultSprintDuration: 14 }),
    createSprint: vi.fn().mockResolvedValue({ id: 's1' }),
    updateSprint: vi.fn().mockResolvedValue({ id: 's1' }),
    deleteSprint: vi.fn().mockResolvedValue(undefined),
    startSprint: vi.fn().mockResolvedValue({ id: 's1' }),
    completeSprint: vi.fn(),
    reopenSprint: vi.fn().mockResolvedValue({ id: 's1' }),
    extendSprint: vi.fn(),
    updateTicket: vi.fn().mockResolvedValue({ id: 't1' }),
    updateSprintSettings: vi.fn().mockResolvedValue({ defaultSprintDuration: 7 }),
  }
  mockGetDataProvider.mockReturnValue(provider as never)
})

describe('sprint queries', () => {
  it('useProjectSprints fetches and is disabled without a projectId', async () => {
    provider.getSprints.mockResolvedValue([{ id: 's1' }])
    const { result } = renderHook(() => useProjectSprints(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)

    const { result: idle } = renderHook(() => useProjectSprints(''), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')
  })

  it('useActiveSprint fetches the active sprint', async () => {
    provider.getActiveSprint.mockResolvedValue({ id: 's1' })
    const { result } = renderHook(() => useActiveSprint(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: 's1' })
  })

  it('useSprintDetail finds the sprint or throws not-found', async () => {
    provider.getSprints.mockResolvedValue([{ id: 's1', name: 'S' }])
    const { result } = renderHook(() => useSprintDetail(P, 's1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: 's1' })

    const { result: missing } = renderHook(() => useSprintDetail(P, 'nope'), { wrapper })
    await waitFor(() => expect(missing.current.isError).toBe(true))
    expect(missing.current.error?.message).toBe('Sprint not found')
  })

  it('useSprintSettings fetches settings', async () => {
    const { result } = renderHook(() => useSprintSettings(P), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ defaultSprintDuration: 14 })
  })
})

describe('sprint mutations', () => {
  it('useCreateSprint toasts success and error', async () => {
    const { result } = renderHook(() => useCreateSprint(P), { wrapper })
    result.current.mutate({ name: 'S1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Sprint created')

    provider.createSprint.mockRejectedValue(new Error('dup'))
    const { result: r2 } = renderHook(() => useCreateSprint(P), { wrapper })
    r2.current.mutate({ name: 'S1' })
    await waitFor(() => expect(r2.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('dup')
  })

  it('useUpdateSprint toasts success', async () => {
    const { result } = renderHook(() => useUpdateSprint(P), { wrapper })
    result.current.mutate({ sprintId: 's1', name: 'New' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Sprint updated')
  })

  it('useDeleteSprint toasts success', async () => {
    const { result } = renderHook(() => useDeleteSprint(P), { wrapper })
    result.current.mutate('s1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Sprint deleted')
  })

  it('useStartSprint toasts success', async () => {
    const { result } = renderHook(() => useStartSprint(P), { wrapper })
    result.current.mutate({ sprintId: 's1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Sprint started')
  })

  it('useReopenSprint toasts success', async () => {
    const { result } = renderHook(() => useReopenSprint(P), { wrapper })
    result.current.mutate('s1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Sprint reopened')
  })

  it('useUpdateTicketSprint calls updateTicket without a toast', async () => {
    const { result } = renderHook(() => useUpdateTicketSprint(P), { wrapper })
    result.current.mutate({ ticketId: 't1', sprintId: 's2', order: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.updateTicket).toHaveBeenCalledWith(P, 't1', { sprintId: 's2', order: 3 })
    expect(showToast.success).not.toHaveBeenCalled()
  })

  it('useUpdateSprintSettings toasts success', async () => {
    const { result } = renderHook(() => useUpdateSprintSettings(P), { wrapper })
    result.current.mutate({ defaultSprintDuration: 7 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Sprint settings updated')
  })
})

describe('useCompleteSprint message building', () => {
  it('builds a summary from the ticket disposition', async () => {
    provider.completeSprint.mockResolvedValue({
      id: 's1',
      ticketDisposition: {
        carriedOver: ['a', 'b'],
        movedToBacklog: ['c'],
        completed: ['d', 'e', 'f'],
      },
    })
    const { result } = renderHook(() => useCompleteSprint(P), { wrapper })
    result.current.mutate({ sprintId: 's1', options: { action: 'close_to_next' } as never })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith(
      'Sprint completed! 2 tickets carried over. 1 ticket moved to backlog. 3 completed.',
    )
  })

  it('toasts on error', async () => {
    provider.completeSprint.mockRejectedValue(new Error('still active'))
    const { result } = renderHook(() => useCompleteSprint(P), { wrapper })
    result.current.mutate({ sprintId: 's1', options: { action: 'close_keep' } as never })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('still active')
  })
})

describe('useExtendSprint end-date calculation', () => {
  it('uses the provided newEndDate directly', async () => {
    provider.extendSprint.mockResolvedValue({ id: 's1', endDate: new Date('2024-06-01') })
    const newEndDate = new Date('2024-06-01')
    const { result } = renderHook(() => useExtendSprint(P), { wrapper })
    result.current.mutate({ sprintId: 's1', days: 7, newEndDate })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.extendSprint).toHaveBeenCalledWith(P, 's1', { newEndDate })
  })

  it('calculates the new end date from the current sprint when not provided', async () => {
    provider.getSprints.mockResolvedValue([{ id: 's1', endDate: new Date('2024-01-01') }])
    provider.extendSprint.mockResolvedValue({ id: 's1', endDate: new Date('2024-01-08') })
    const { result } = renderHook(() => useExtendSprint(P), { wrapper })
    result.current.mutate({ sprintId: 's1', days: 7 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const passed = provider.extendSprint.mock.calls[0][2] as { newEndDate: Date }
    // 2024-01-01 + 7 days = 2024-01-08
    expect(passed.newEndDate.toISOString().slice(0, 10)).toBe('2024-01-08')
  })

  it('throws when the sprint to extend is not found', async () => {
    provider.getSprints.mockResolvedValue([])
    const { result } = renderHook(() => useExtendSprint(P), { wrapper })
    result.current.mutate({ sprintId: 'nope', days: 7 })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('Sprint not found')
  })
})
