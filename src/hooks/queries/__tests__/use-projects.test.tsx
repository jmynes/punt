import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { getDataProvider } from '@/lib/data-provider'
import { showToast } from '@/lib/toast'
import { useProjectsStore } from '@/stores/projects-store'
import {
  useCreateProject,
  useDeleteProject,
  useProjectDetail,
  useProjects,
  useUpdateProject,
} from '../use-projects'

vi.mock('@/lib/data-provider', () => ({ getDataProvider: vi.fn() }))
vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/hooks/use-realtime', () => ({ getTabId: vi.fn(() => 'tab-1') }))
vi.mock('@/lib/toast', () => ({
  showToast: { success: vi.fn(), error: vi.fn() },
}))

const mockGetDataProvider = vi.mocked(getDataProvider)
const mockApiFetch = vi.mocked(apiFetch)

type ProviderFake = {
  getProjects: ReturnType<typeof vi.fn>
  createProject: ReturnType<typeof vi.fn>
  updateProject: ReturnType<typeof vi.fn>
  deleteProject: ReturnType<typeof vi.fn>
}
let provider: ProviderFake

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  provider = {
    getProjects: vi.fn().mockResolvedValue([]),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  }
  mockGetDataProvider.mockReturnValue(provider as never)
  useProjectsStore.setState({ projects: [], isLoading: false, error: null })
})

describe('useProjectDetail', () => {
  it('returns the project payload on success', async () => {
    mockApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'p1', name: 'P' }), { status: 200 }),
    )
    const { result } = renderHook(() => useProjectDetail('p1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: 'p1' })
  })

  it('surfaces the server error message on failure', async () => {
    mockApiFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'Nope' }), { status: 403 }))
    const { result } = renderHook(() => useProjectDetail('p1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Nope')
  })
})

describe('useProjects', () => {
  it('fetches via the data provider and syncs the store', async () => {
    provider.getProjects.mockResolvedValue([{ id: 'p1', name: 'P', key: 'P', role: 'owner' }])
    const { result } = renderHook(() => useProjects(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.getProjects).toHaveBeenCalled()
    await waitFor(() =>
      expect(useProjectsStore.getState().projects.map((p) => p.id)).toEqual(['p1']),
    )
  })

  it('records the error message in the store on failure', async () => {
    provider.getProjects.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useProjects(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() => expect(useProjectsStore.getState().error).toBe('boom'))
  })
})

describe('useCreateProject', () => {
  it('optimistically adds a temp project then replaces it on success', async () => {
    provider.createProject.mockResolvedValue({
      id: 'real-1',
      name: 'New',
      key: 'NEW',
      color: '#fff',
      role: 'owner',
    })
    const { result } = renderHook(() => useCreateProject(), { wrapper })

    result.current.mutate({ name: 'New', key: 'NEW', color: '#fff' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const ids = useProjectsStore.getState().projects.map((p) => p.id)
    expect(ids).toContain('real-1')
    expect(ids.some((id) => id.startsWith('temp-'))).toBe(false)
    expect(showToast.success).toHaveBeenCalledWith('Project created')
  })

  it('rolls back the optimistic project and toasts on error', async () => {
    provider.createProject.mockRejectedValue(new Error('failed'))
    const { result } = renderHook(() => useCreateProject(), { wrapper })

    result.current.mutate({ name: 'New', key: 'NEW', color: '#fff' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(useProjectsStore.getState().projects.some((p) => p.id.startsWith('temp-'))).toBe(false)
    expect(showToast.error).toHaveBeenCalledWith('failed')
  })
})

describe('useUpdateProject', () => {
  it('optimistically updates the store and toasts on success', async () => {
    useProjectsStore.setState({
      projects: [{ id: 'p1', name: 'Old', key: 'P', color: '#000', role: 'owner' }],
    })
    provider.updateProject.mockResolvedValue({ id: 'p1', name: 'New' })
    const { result } = renderHook(() => useUpdateProject(), { wrapper })

    result.current.mutate({ id: 'p1', name: 'New' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(useProjectsStore.getState().projects[0].name).toBe('New')
    expect(showToast.success).toHaveBeenCalledWith('Project updated')
  })

  it('toasts on error', async () => {
    useProjectsStore.setState({
      projects: [{ id: 'p1', name: 'Old', key: 'P', color: '#000', role: 'owner' }],
    })
    provider.updateProject.mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useUpdateProject(), { wrapper })

    result.current.mutate({ id: 'p1', name: 'New' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('nope')
  })
})

describe('useDeleteProject', () => {
  it('optimistically removes the project and toasts on success', async () => {
    useProjectsStore.setState({
      projects: [{ id: 'p1', name: 'P', key: 'P', color: '#000', role: 'owner' }],
    })
    const { result } = renderHook(() => useDeleteProject(), { wrapper })

    result.current.mutate({ id: 'p1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(useProjectsStore.getState().projects).toHaveLength(0)
    expect(provider.deleteProject).toHaveBeenCalledWith('p1', undefined)
    expect(showToast.success).toHaveBeenCalledWith('Project deleted')
  })

  it('passes a reauth payload when a confirm password is supplied', async () => {
    useProjectsStore.setState({
      projects: [{ id: 'p1', name: 'P', key: 'P', color: '#000', role: 'owner' }],
    })
    const { result } = renderHook(() => useDeleteProject(), { wrapper })

    result.current.mutate({ id: 'p1', confirmPassword: 'pw', totpCode: '123456' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(provider.deleteProject).toHaveBeenCalledWith('p1', {
      confirmPassword: 'pw',
      totpCode: '123456',
      isRecoveryCode: undefined,
    })
  })

  it('toasts the error when deletion fails', async () => {
    // Note: onError restores the React Query cache (setQueryData), not the
    // zustand store directly — the store re-syncs on the next refetch via
    // useProjects. So here we assert the observable error path.
    useProjectsStore.setState({
      projects: [{ id: 'p1', name: 'P', key: 'P', color: '#000', role: 'owner' }],
    })
    provider.deleteProject.mockRejectedValue(new Error('cannot delete'))
    const { result } = renderHook(() => useDeleteProject(), { wrapper })

    result.current.mutate({ id: 'p1' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('cannot delete')
  })
})
