import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@/stores/settings-store'
import { getEffectiveDuration, showToast, TOAST_DURATION } from '../toast'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(() => 'id-s'),
    error: vi.fn(() => 'id-e'),
    info: vi.fn(() => 'id-i'),
    warning: vi.fn(() => 'id-w'),
    promise: vi.fn(),
    dismiss: vi.fn(),
  }),
}))
vi.mock('@/stores/settings-store', () => ({ useSettingsStore: { getState: vi.fn() } }))

const mockGetState = vi.mocked(useSettingsStore.getState)

function prefs(overrides: Record<string, unknown> = {}) {
  return {
    toastAutoDismiss: true,
    toastDismissDelay: 4000,
    errorToastAutoDismiss: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetState.mockReturnValue(prefs() as never)
})

describe('getEffectiveDuration', () => {
  it('returns Infinity when auto-dismiss is off', () => {
    mockGetState.mockReturnValue(prefs({ toastAutoDismiss: false }) as never)
    expect(getEffectiveDuration(2000)).toBe(TOAST_DURATION.INFINITE)
  })

  it('uses the error auto-dismiss setting for error toasts', () => {
    mockGetState.mockReturnValue(prefs({ errorToastAutoDismiss: false }) as never)
    expect(getEffectiveDuration(2000, true)).toBe(TOAST_DURATION.INFINITE)
  })

  it('returns the dismiss delay when no duration is requested', () => {
    expect(getEffectiveDuration(undefined)).toBe(4000)
  })

  it('treats a requested duration as a minimum (never shortens)', () => {
    expect(getEffectiveDuration(2000)).toBe(4000) // delay wins
    expect(getEffectiveDuration(8000)).toBe(8000) // requested wins
  })
})

describe('showToast core methods', () => {
  it('success/error/info/warning delegate to sonner', () => {
    showToast.success('ok')
    showToast.error('bad')
    showToast.info('fyi')
    showToast.warning('careful')
    expect(toast.success).toHaveBeenCalledWith('ok', expect.anything())
    expect(toast.error).toHaveBeenCalledWith('bad', expect.anything())
    expect(toast.info).toHaveBeenCalledWith('fyi', expect.anything())
    expect(toast.warning).toHaveBeenCalledWith('careful', expect.anything())
  })

  it('copied and demoModeNotice produce standardized messages', () => {
    showToast.copied('API key')
    expect(toast.success).toHaveBeenCalledWith('API key copied to clipboard', expect.anything())
    showToast.demoModeNotice('File uploads')
    expect(toast.info).toHaveBeenCalledWith(
      'File uploads is disabled in demo mode',
      expect.anything(),
    )
  })

  it('dismiss and dismissAll call sonner dismiss', () => {
    showToast.dismiss('id-1')
    expect(toast.dismiss).toHaveBeenCalledWith('id-1')
    showToast.dismissAll()
    expect(toast.dismiss).toHaveBeenCalledWith()
  })

  it('loading wires up a sonner promise toast and returns the promise', async () => {
    const p = Promise.resolve('done')
    const returned = showToast.loading(p, { loadingMessage: 'Saving...' })
    expect(toast.promise).toHaveBeenCalled()
    await expect(returned).resolves.toBe('done')
  })
})
