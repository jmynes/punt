import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEffectiveDuration, rawToast } from '@/lib/toast'
import { showUndoRedoToast } from '../undo-toast'

vi.mock('@/lib/toast', () => ({
  rawToast: { success: vi.fn(() => 'id-s'), error: vi.fn(() => 'id-e') },
  getEffectiveDuration: vi.fn(() => 5000),
}))

const mockSuccess = vi.mocked(rawToast.success)
const mockError = vi.mocked(rawToast.error)
const mockDuration = vi.mocked(getEffectiveDuration)

beforeEach(() => {
  vi.clearAllMocks()
  mockDuration.mockReturnValue(5000)
})

describe('showUndoRedoToast', () => {
  it('shows a success toast with the resolved duration', () => {
    showUndoRedoToast('success', { title: 'Pasted', description: 'PUNT-1' })
    expect(mockSuccess).toHaveBeenCalledWith(
      'Pasted',
      expect.objectContaining({ description: 'PUNT-1', duration: 5000, closeButton: false }),
    )
  })

  it('shows an error toast', () => {
    showUndoRedoToast('error', { title: 'Deleted', description: 'PUNT-2' })
    expect(mockError).toHaveBeenCalledWith('Deleted', expect.objectContaining({ duration: 5000 }))
  })

  it('makes an error toast persistent (close button + copy) when the duration is infinite', () => {
    mockDuration.mockReturnValue(Number.POSITIVE_INFINITY)
    showUndoRedoToast('error', { title: 'Deleted', description: 'PUNT-3' })
    const opts = mockError.mock.calls[0][1] as { closeButton: boolean; cancel?: { label: string } }
    expect(opts.closeButton).toBe(true)
    expect(opts.cancel?.label).toBe('Copy')
  })
})
