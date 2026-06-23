import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  useDeleteLogo,
  useSendTestEmail,
  useSystemSettings,
  useUpdateSystemSettings,
  useUploadLogo,
} from '../use-system-settings'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)

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
  mockApiFetch.mockResolvedValue(ok({}))
})

describe('useSystemSettings', () => {
  it('fetches settings via the API', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 's', appName: 'PUNT' }))
    const { result } = renderHook(() => useSystemSettings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.appName).toBe('PUNT')
  })

  it('returns demo settings in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useSystemSettings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('demo-settings')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('surfaces a server error', async () => {
    mockApiFetch.mockResolvedValue(fail('forbidden', 403))
    const { result } = renderHook(() => useSystemSettings(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateSystemSettings', () => {
  it('PATCHes and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ id: 's' }))
    const { result } = renderHook(() => useUpdateSystemSettings(), { wrapper })
    result.current.mutate({ appName: 'New' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Settings updated')
  })

  it('shows a read-only info toast in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useUpdateSystemSettings(), { wrapper })
    result.current.mutate({ appName: 'New' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.info).toHaveBeenCalledWith('Settings are read-only in demo mode')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('invalid'))
    const { result } = renderHook(() => useUpdateSystemSettings(), { wrapper })
    result.current.mutate({ appName: 'New' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('invalid')
  })
})

describe('logo mutations', () => {
  it('useUploadLogo POSTs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ success: true, logoUrl: '/logo.png' }))
    const { result } = renderHook(() => useUploadLogo(), { wrapper })
    result.current.mutate(new File(['x'], 'logo.png', { type: 'image/png' }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Logo uploaded')
  })

  it('useUploadLogo shows an info toast in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useUploadLogo(), { wrapper })
    result.current.mutate(new File(['x'], 'logo.png', { type: 'image/png' }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.info).toHaveBeenCalledWith('Logo upload is disabled in demo mode')
  })

  it('useDeleteLogo DELETEs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ success: true }))
    const { result } = renderHook(() => useDeleteLogo(), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Logo removed')
  })
})

describe('useSendTestEmail', () => {
  it('POSTs and toasts success', async () => {
    mockApiFetch.mockResolvedValue(ok({ success: true }))
    const { result } = renderHook(() => useSendTestEmail(), { wrapper })
    result.current.mutate('test@example.com')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith('Test email sent successfully')
  })

  it('shows an info toast in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useSendTestEmail(), { wrapper })
    result.current.mutate('test@example.com')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.info).toHaveBeenCalledWith('Test email is disabled in demo mode')
  })

  it('toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('smtp down'))
    const { result } = renderHook(() => useSendTestEmail(), { wrapper })
    result.current.mutate('test@example.com')
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('smtp down')
  })
})
