import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireMembership } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { validateColumnInProject } from '@/lib/ticket-mutations-server'
import { GET, PATCH } from '../route'

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
  requireProjectByKey: vi.fn(async (k: string) => k),
  requireMembership: vi.fn().mockResolvedValue(undefined),
  requirePermission: vi.fn().mockResolvedValue(undefined),
  requireTicketPermission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/db', () => ({
  db: {
    ticket: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/events', () => ({ projectEvents: { emitTicketEvent: vi.fn() } }))
vi.mock('@/lib/audit', () => ({
  logTicketCreated: vi.fn(),
  logBatchChanges: vi.fn().mockResolvedValue({ activityIds: [] }),
  createActivityGroupId: vi.fn(() => 'g1'),
  logTicketActivity: vi.fn(),
  computeTicketChanges: vi.fn(() => []),
}))
vi.mock('@/lib/prisma-selects', () => ({
  TICKET_SELECT_FULL: {},
  transformTicket: (t: unknown) => t,
}))
vi.mock('@/lib/ticket-mutations-server', () => ({
  validateColumnInProject: vi.fn(),
  resolveResolutionColumnCoupling: vi.fn(),
  validateMemberships: vi.fn(),
  validateParentForCreate: vi.fn(),
  validateProjectMembership: vi.fn(),
  validateSprintNotCompletedUnresolved: vi.fn(),
}))

const mMembership = vi.mocked(requireMembership)
const mFindMany = vi.mocked(db.ticket.findMany)
const mValidateColumn = vi.mocked(validateColumnInProject)
const params = Promise.resolve({ projectId: 'PUNT' })

beforeEach(() => {
  vi.clearAllMocks()
  mMembership.mockResolvedValue(undefined as never)
})

describe('GET /api/projects/[projectId]/tickets', () => {
  it('returns the project tickets', async () => {
    mFindMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }] as never)
    const res = await GET(new Request('http://localhost/api/projects/PUNT/tickets'), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(2)
  })

  it('applies the hasAttachments=true filter', async () => {
    mFindMany.mockResolvedValue([] as never)
    await GET(new Request('http://localhost/api/projects/PUNT/tickets?hasAttachments=true'), {
      params,
    })
    expect(mFindMany.mock.calls[0][0].where.attachments).toEqual({ some: {} })
  })

  it('applies the hasAttachments=false filter', async () => {
    mFindMany.mockResolvedValue([] as never)
    await GET(new Request('http://localhost/api/projects/PUNT/tickets?hasAttachments=false'), {
      params,
    })
    expect(mFindMany.mock.calls[0][0].where.attachments).toEqual({ none: {} })
  })

  it('returns 403 when membership is forbidden', async () => {
    mMembership.mockRejectedValue(new Error('Forbidden: not a member'))
    const res = await GET(new Request('http://localhost/api/projects/PUNT/tickets'), { params })
    expect(res.status).toBe(403)
  })
})

function patchReq(body: unknown) {
  return new Request('http://localhost/api/projects/PUNT/tickets', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/projects/[projectId]/tickets (batch move)', () => {
  it('rejects an invalid body', async () => {
    const res = await PATCH(patchReq({ nonsense: true }), { params })
    expect(res.status).toBe(400)
  })

  it('rejects when the target column is not in the project', async () => {
    mValidateColumn.mockResolvedValue(null as never)
    const res = await PATCH(patchReq({ ticketIds: ['t1'], toColumnId: 'c2', newOrder: 0 }), {
      params,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Target column not found')
  })

  it('rejects when some tickets do not belong to the project', async () => {
    mValidateColumn.mockResolvedValue({ id: 'c2', name: 'Done' } as never)
    mFindMany.mockResolvedValue([] as never) // fewer than requested
    const res = await PATCH(patchReq({ ticketIds: ['t1', 't2'], toColumnId: 'c2', newOrder: 0 }), {
      params,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('not found or do not belong')
  })
})
