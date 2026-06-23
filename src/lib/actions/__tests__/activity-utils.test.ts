import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/base-path'
import { isDemoMode } from '@/lib/demo'
import { deleteActivityEntries, extractActivityMeta } from '../activity-utils'

vi.mock('@/lib/base-path', () => ({
  apiFetch: vi.fn(),
}))
vi.mock('@/lib/demo', () => ({
  isDemoMode: vi.fn(() => false),
}))
vi.mock('@/hooks/use-realtime', () => ({
  getTabId: vi.fn(() => 'test-tab-id'),
}))

const mockApiFetch = vi.mocked(apiFetch)
const mockIsDemoMode = vi.mocked(isDemoMode)

describe('extractActivityMeta', () => {
  it('returns undefined when the response has no _activity field', () => {
    expect(extractActivityMeta({}, 'ticket-1')).toBeUndefined()
  })

  it('returns undefined when _activity has neither activityIds nor groupId', () => {
    expect(extractActivityMeta({ _activity: {} }, 'ticket-1')).toBeUndefined()
    expect(
      extractActivityMeta({ _activity: { activityIds: [], groupId: null } }, 'ticket-1'),
    ).toBeUndefined()
  })

  it('returns meta with both activityIds and groupId when present', () => {
    const meta = extractActivityMeta(
      { _activity: { activityIds: ['a1', 'a2'], groupId: 'group-1' } },
      'ticket-1',
    )
    expect(meta).toEqual({
      ticketId: 'ticket-1',
      activityIds: ['a1', 'a2'],
      groupId: 'group-1',
    })
  })

  it('defaults activityIds to an empty array when only groupId is present', () => {
    const meta = extractActivityMeta({ _activity: { groupId: 'group-1' } }, 'ticket-1')
    expect(meta).toEqual({ ticketId: 'ticket-1', activityIds: [], groupId: 'group-1' })
  })

  it('normalizes a null groupId to undefined when activityIds carry the signal', () => {
    const meta = extractActivityMeta(
      { _activity: { activityIds: ['a1'], groupId: null } },
      'ticket-1',
    )
    expect(meta).toEqual({ ticketId: 'ticket-1', activityIds: ['a1'], groupId: undefined })
  })
})

describe('deleteActivityEntries', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockApiFetch.mockResolvedValue(new Response(null, { status: 200 }))
    mockIsDemoMode.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when ticketId is missing', async () => {
    await deleteActivityEntries('PUNT', { ticketId: '', groupId: 'g1', activityIds: ['a1'] })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('does nothing when there is no groupId and no activityIds', async () => {
    await deleteActivityEntries('PUNT', { ticketId: 'ticket-1', activityIds: [] })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('does nothing in demo mode even with valid metadata', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await deleteActivityEntries('PUNT', { ticketId: 'ticket-1', groupId: 'g1' })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('posts to the batch-delete endpoint with groupId and activityIds', async () => {
    await deleteActivityEntries('PUNT', {
      ticketId: 'ticket-1',
      groupId: 'g1',
      activityIds: ['a1', 'a2'],
    })

    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockApiFetch.mock.calls[0]
    expect(url).toBe('/api/projects/PUNT/tickets/ticket-1/activity/batch-delete')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['X-Tab-Id']).toBe('test-tab-id')
    expect(JSON.parse(init?.body as string)).toEqual({ groupId: 'g1', activityIds: ['a1', 'a2'] })
  })

  it('proceeds when only activityIds are provided (no groupId)', async () => {
    await deleteActivityEntries('PUNT', { ticketId: 'ticket-1', activityIds: ['a1'] })
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
  })

  it('swallows API errors so undo is never blocked', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApiFetch.mockRejectedValue(new Error('network down'))

    await expect(
      deleteActivityEntries('PUNT', { ticketId: 'ticket-1', groupId: 'g1' }),
    ).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith('Failed to delete activity entries:', expect.any(Error))
  })
})
