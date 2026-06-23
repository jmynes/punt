import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import {
  computeTicketChanges,
  createActivityGroupId,
  logBatchChanges,
  logTicketActivity,
  logTicketCreated,
  logTicketDeleted,
  logTicketFieldChange,
} from '../audit'

vi.mock('@/lib/db', () => ({
  db: { ticketActivity: { create: vi.fn(), createMany: vi.fn() } },
}))

const mockCreate = vi.mocked(db.ticketActivity.create)
const mockCreateMany = vi.mocked(db.ticketActivity.createMany)

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue({ id: 'act-1' } as never)
  mockCreateMany.mockResolvedValue({ count: 0 } as never)
})

describe('computeTicketChanges', () => {
  it('detects changed fields and skips unchanged/undefined ones', () => {
    const changes = computeTicketChanges(
      { priority: 'low', title: 'A', type: 'task' },
      { priority: 'high', title: 'A', type: undefined },
    )
    expect(changes).toEqual([{ field: 'priority', oldValue: 'low', newValue: 'high' }])
  })

  it('treats equal dates as unchanged', () => {
    const d = new Date('2024-01-01')
    const changes = computeTicketChanges({ dueDate: d }, { dueDate: new Date('2024-01-01') })
    expect(changes).toEqual([])
  })

  it('compares objects/arrays structurally', () => {
    const same = computeTicketChanges({ labels: [{ id: 'l1' }] }, { labels: [{ id: 'l1' }] })
    expect(same).toEqual([])
    const diff = computeTicketChanges({ labels: [{ id: 'l1' }] }, { labels: [{ id: 'l2' }] })
    expect(diff).toHaveLength(1)
  })

  it('coerces a missing old value to null in the change record', () => {
    const changes = computeTicketChanges({}, { priority: 'high' })
    expect(changes).toEqual([{ field: 'priority', oldValue: null, newValue: 'high' }])
  })
})

describe('createActivityGroupId', () => {
  it('returns a grp_-prefixed id', () => {
    expect(createActivityGroupId()).toMatch(/^grp_/)
  })
})

describe('logTicketActivity', () => {
  it('creates an entry and returns its id', async () => {
    expect(await logTicketActivity('t1', 'u1', 'created')).toBe('act-1')
  })

  it('stringifies values and returns null when the DB throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error('db down'))
    expect(await logTicketActivity('t1', 'u1', 'updated', { field: 'x', oldValue: 1 })).toBeNull()
  })

  it('logTicketCreated and logTicketDeleted use the right actions', async () => {
    await logTicketCreated('t1', 'u1')
    expect(mockCreate.mock.calls[0][0].data.action).toBe('created')
    await logTicketDeleted('t1', 'u1')
    expect(mockCreate.mock.calls[1][0].data.action).toBe('deleted')
  })

  it('logTicketFieldChange maps the field to an action', async () => {
    await logTicketFieldChange('t1', 'u1', 'priority', 'low', 'high')
    expect(mockCreate.mock.calls[0][0].data.action).toBe('priority_changed')
  })
})

describe('logBatchChanges', () => {
  it('returns empty when only internal fields changed', async () => {
    const result = await logBatchChanges('t1', 'u1', [
      { field: 'order', oldValue: 0, newValue: 1 },
      { field: 'updatedAt', oldValue: 'a', newValue: 'b' },
    ])
    expect(result).toEqual({ activityIds: [], groupId: null })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('logs a single significant change without a group id', async () => {
    const result = await logBatchChanges('t1', 'u1', [
      { field: 'priority', oldValue: 'low', newValue: 'high' },
      { field: 'order', oldValue: 0, newValue: 1 },
    ])
    expect(result).toEqual({ activityIds: ['act-1'], groupId: null })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('createMany with a shared group id for multiple changes', async () => {
    const result = await logBatchChanges(
      't1',
      'u1',
      [
        { field: 'priority', oldValue: 'low', newValue: 'high' },
        { field: 'type', oldValue: 'task', newValue: 'bug' },
      ],
      'grp_fixed',
    )
    expect(result.groupId).toBe('grp_fixed')
    expect(mockCreateMany).toHaveBeenCalledTimes(1)
    const rows = mockCreateMany.mock.calls[0][0].data as Array<{ groupId: string; action: string }>
    expect(rows.every((r) => r.groupId === 'grp_fixed')).toBe(true)
  })

  it('returns a null group id when createMany throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateMany.mockRejectedValue(new Error('db down'))
    const result = await logBatchChanges('t1', 'u1', [
      { field: 'priority', oldValue: 'low', newValue: 'high' },
      { field: 'type', oldValue: 'task', newValue: 'bug' },
    ])
    expect(result).toEqual({ activityIds: [], groupId: null })
  })
})
