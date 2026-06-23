import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { showToast } from '@/lib/toast'
import {
  checkIfExportEncrypted,
  fileToBase64,
  isZipContent,
  useDatabaseStats,
  useExportDatabase,
  useExportEstimate,
  useImportDatabase,
  usePreviewDatabase,
  useWipeDatabase,
  useWipeProjects,
} from '../use-database-backup'

vi.mock('@/lib/base-path', () => ({ apiFetch: vi.fn(), withBasePath: (p: string) => p }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))

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

describe('pure helpers', () => {
  it('checkIfExportEncrypted detects the encrypted flag', () => {
    expect(checkIfExportEncrypted(JSON.stringify({ encrypted: true }))).toBe(true)
    expect(checkIfExportEncrypted(JSON.stringify({ encrypted: false }))).toBe(false)
    expect(checkIfExportEncrypted('not json')).toBe(false)
  })

  it('isZipContent detects the ZIP magic prefix', () => {
    expect(isZipContent('UEsDsomethingbase64')).toBe(true)
    expect(isZipContent('eyJmb28iOiJiYXI')).toBe(false)
  })

  it('fileToBase64 extracts the base64 payload', async () => {
    const file = new File(['hello'], 'f.txt', { type: 'text/plain' })
    const base64 = await fileToBase64(file)
    expect(atob(base64)).toBe('hello')
  })
})

describe('stats / estimate queries', () => {
  it('useDatabaseStats returns demo stats in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useDatabaseStats(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.projects).toBe(2)
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('useDatabaseStats fetches in production', async () => {
    mockApiFetch.mockResolvedValue(ok({ projects: 9 }))
    const { result } = renderHook(() => useDatabaseStats(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.projects).toBe(9)
  })

  it('useExportEstimate returns demo estimate in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useExportEstimate(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.totals.totalBytes).toBeGreaterThan(0)
  })
})

describe('demo-mode info toasts', () => {
  const reauth = { confirmPassword: 'pw', confirmText: 'WIPE' }

  it('useExportDatabase returns null with an info toast', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(() => useExportDatabase(), { wrapper })
    result.current.mutate({ confirmPassword: 'pw' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    expect(showToast.info).toHaveBeenCalledWith('Database export is disabled in demo mode')
  })

  it.each([
    ['usePreviewDatabase', () => usePreviewDatabase(), { content: 'x' }],
    ['useImportDatabase', () => useImportDatabase(), { content: 'x', ...reauth }],
    ['useWipeProjects', () => useWipeProjects(), reauth],
  ])('%s throws a Demo mode error', async (_name, hook, params) => {
    mockIsDemoMode.mockReturnValue(true)
    const { result } = renderHook(hook as never, { wrapper })
    ;(result.current as { mutate: (p: unknown) => void }).mutate(params)
    await waitFor(() => expect((result.current as { isError: boolean }).isError).toBe(true))
    expect(showToast.info).toHaveBeenCalled()
  })
})

describe('production mutations', () => {
  it('useImportDatabase builds a record-count success message', async () => {
    mockApiFetch.mockResolvedValue(
      ok({
        counts: { projects: 2, tickets: 5 },
        files: { attachmentsRestored: 1, avatarsRestored: 1 },
      }),
    )
    const { result } = renderHook(() => useImportDatabase(), { wrapper })
    result.current.mutate({ content: 'x', confirmPassword: 'pw', confirmText: 'IMPORT' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith(
      'Database imported successfully (7 records, 2 files)',
    )
  })

  it('useImportDatabase toasts on a real error', async () => {
    mockApiFetch.mockResolvedValue(fail('corrupt backup'))
    const { result } = renderHook(() => useImportDatabase(), { wrapper })
    result.current.mutate({ content: 'x', confirmPassword: 'pw', confirmText: 'IMPORT' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('corrupt backup')
  })

  it('useWipeDatabase toasts success and triggers sign-out', async () => {
    mockApiFetch.mockResolvedValue(ok({ success: true }))
    const { result } = renderHook(() => useWipeDatabase(), { wrapper })
    result.current.mutate({
      currentPassword: 'pw',
      username: 'admin',
      password: 'NewPassw0rd!!',
      confirmText: 'WIPE',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(showToast.success).toHaveBeenCalledWith(
      'Database wiped successfully. Redirecting to login...',
    )
  })

  it('useWipeProjects toasts on error', async () => {
    mockApiFetch.mockResolvedValue(fail('cannot wipe'))
    const { result } = renderHook(() => useWipeProjects(), { wrapper })
    result.current.mutate({ confirmPassword: 'pw', confirmText: 'WIPE' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(showToast.error).toHaveBeenCalledWith('cannot wipe')
  })
})
