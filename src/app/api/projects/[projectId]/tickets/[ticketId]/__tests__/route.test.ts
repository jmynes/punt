import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireMembership, requireTicketPermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { DELETE, GET } from '../route'

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
  requireProjectByKey: vi.fn(async (k: string) => k),
  requireMembership: vi.fn().mockResolvedValue(undefined),
  requirePermission: vi.fn().mockResolvedValue(undefined),
  requireTicketPermission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/db', () => ({
  db: {
    ticket: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    ticketLink: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/events', () => ({ projectEvents: { emitTicketEvent: vi.fn() } }))
vi.mock('@/lib/audit', () => ({
  logTicketActivity: vi.fn(),
  logBatchChanges: vi.fn().mockResolvedValue({ activityIds: [] }),
  createActivityGroupId: vi.fn(() => 'g1'),
  computeTicketChanges: vi.fn(() => []),
}))
vi.mock('@/lib/prisma-selects', () => ({
  TICKET_SELECT_FULL: {},
  transformTicket: (t: unknown) => t,
}))

const mMembership = vi.mocked(requireMembership)
const mTicketPerm = vi.mocked(requireTicketPermission)
const mFindFirst = vi.mocked(db.ticket.findFirst)
const mLinkFindMany = vi.mocked(db.ticketLink.findMany)
const mDelete = vi.mocked(db.ticket.delete)
const params = Promise.resolve({ projectId: 'PUNT', ticketId: 't1' })

beforeEach(() => {
  vi.clearAllMocks()
  mMembership.mockResolvedValue(undefined as never)
  mTicketPerm.mockResolvedValue(undefined as never)
  mLinkFindMany.mockResolvedValue([] as never)
  mDelete.mockResolvedValue({ id: 't1' } as never)
})

describe('GET /api/projects/[projectId]/tickets/[ticketId]', () => {
  it('returns the ticket when found', async () => {
    mFindFirst.mockResolvedValue({ id: 't1', title: 'A' } as never)
    const res = await GET(new Request('http://localhost/x'), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 't1' })
  })

  it('returns 404 when the ticket is missing', async () => {
    mFindFirst.mockResolvedValue(null as never)
    const res = await GET(new Request('http://localhost/x'), { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when membership is forbidden', async () => {
    mMembership.mockRejectedValue(new Error('Forbidden: nope'))
    const res = await GET(new Request('http://localhost/x'), { params })
    expect(res.status).toBe(403)
  })
})

function delReq() {
  return new Request('http://localhost/x', { method: 'DELETE' })
}

describe('DELETE /api/projects/[projectId]/tickets/[ticketId]', () => {
  it('returns 404 when the ticket is missing', async () => {
    mFindFirst.mockResolvedValue(null as never)
    const res = await DELETE(delReq(), { params })
    expect(res.status).toBe(404)
  })

  it('deletes the ticket when found and permitted', async () => {
    mFindFirst.mockResolvedValue({
      id: 't1',
      number: 5,
      creatorId: 'u1',
      project: { key: 'PUNT' },
    } as never)
    const res = await DELETE(delReq(), { params })
    expect(res.status).toBe(200)
    expect(mDelete).toHaveBeenCalledWith({ where: { id: 't1' } })
  })

  it('returns 403 when the delete permission is denied', async () => {
    mFindFirst.mockResolvedValue({
      id: 't1',
      number: 5,
      creatorId: 'someone-else',
      project: { key: 'PUNT' },
    } as never)
    mTicketPerm.mockRejectedValue(new Error('Forbidden: cannot delete'))
    const res = await DELETE(delReq(), { params })
    expect(res.status).toBe(403)
    expect(mDelete).not.toHaveBeenCalled()
  })
})
