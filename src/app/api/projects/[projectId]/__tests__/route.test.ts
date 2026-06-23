import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  requireAuth,
  requireMembership,
  requirePermission,
  requireProjectByKey,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import { getSystemSettings } from '@/lib/system-settings'
import { DELETE, GET, PATCH } from '../route'

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
  requireProjectByKey: vi.fn(),
  requireMembership: vi.fn(),
  requirePermission: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/events', () => ({
  projectEvents: { emitProjectEvent: vi.fn(), emitMemberEvent: vi.fn() },
}))
vi.mock('@/lib/system-settings', () => ({ getSystemSettings: vi.fn() }))
vi.mock('@/lib/demo/demo-config', () => ({ isDemoMode: vi.fn(() => false) }))
vi.mock('@/lib/password', () => ({ verifyPassword: vi.fn() }))
vi.mock('@/lib/totp', () => ({
  decryptTotpSecret: vi.fn(),
  verifyTotpToken: vi.fn(),
  verifyRecoveryCode: vi.fn(),
  markRecoveryCodeUsed: vi.fn(),
}))

const mAuth = vi.mocked(requireAuth)
const mByKey = vi.mocked(requireProjectByKey)
const mMembership = vi.mocked(requireMembership)
const mPermission = vi.mocked(requirePermission)
const mDemo = vi.mocked(isDemoMode)
const mVerifyPassword = vi.mocked(verifyPassword)
const mSettings = vi.mocked(getSystemSettings)

const params = Promise.resolve({ projectId: 'PUNT' })
const projectRow = {
  id: 'p1',
  name: 'Punt',
  key: 'PUNT',
  color: '#000',
  description: null,
  showAddColumnButton: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { tickets: 3, members: 2 },
  members: [{ role: { id: 'r1', name: 'Owner', color: '#f00' } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mAuth.mockResolvedValue({ id: 'u1' } as never)
  mByKey.mockResolvedValue('p1' as never)
  mMembership.mockResolvedValue(undefined as never)
  mPermission.mockResolvedValue(undefined as never)
  mDemo.mockReturnValue(false)
  mSettings.mockResolvedValue({ showAddColumnButton: true } as never)
})

describe('GET /api/projects/[projectId]', () => {
  it('returns the project with role + effective setting', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(projectRow as never)
    const res = await GET(new Request('http://localhost/api/projects/PUNT'), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'p1', role: 'Owner', effectiveShowAddColumnButton: true })
  })

  it('returns 404 when the project is missing', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null as never)
    const res = await GET(new Request('http://localhost/api/projects/PUNT'), { params })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    mAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(new Request('http://localhost/api/projects/PUNT'), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when membership is forbidden', async () => {
    mMembership.mockRejectedValue(new Error('Forbidden: not a member'))
    const res = await GET(new Request('http://localhost/api/projects/PUNT'), { params })
    expect(res.status).toBe(403)
  })
})

function patchReq(body: unknown) {
  return new Request('http://localhost/api/projects/PUNT', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Tab-Id': 'tab-1' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/projects/[projectId]', () => {
  it('updates and emits a project.updated event', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(db.project.update).mockResolvedValue(projectRow as never)
    const res = await PATCH(patchReq({ name: 'New Name' }), { params })
    expect(res.status).toBe(200)
    expect(projectEvents.emitProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'project.updated', projectId: 'p1' }),
    )
  })

  it('rejects an invalid body', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue({ id: 'p1' } as never)
    const res = await PATCH(patchReq({ color: 'not-a-hex' }), { params })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate key', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(db.project.findFirst).mockResolvedValue({ id: 'other' } as never)
    const res = await PATCH(patchReq({ key: 'TAKEN' }), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Project key already exists')
  })

  it('returns 403 when the permission check fails', async () => {
    mPermission.mockRejectedValue(new Error('Forbidden: need settings'))
    const res = await PATCH(patchReq({ name: 'x' }), { params })
    expect(res.status).toBe(403)
  })
})

function deleteReq(body?: unknown) {
  return new Request('http://localhost/api/projects/PUNT', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
}

describe('DELETE /api/projects/[projectId]', () => {
  it('requires a confirm password outside demo mode', async () => {
    const res = await DELETE(deleteReq({}), { params })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      passwordHash: 'h',
      totpEnabled: false,
    } as never)
    mVerifyPassword.mockResolvedValue(false)
    const res = await DELETE(deleteReq({ confirmPassword: 'wrong' }), { params })
    expect(res.status).toBe(401)
  })

  it('requires a 2FA code when TOTP is enabled', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      passwordHash: 'h',
      totpEnabled: true,
      totpSecret: 'enc',
    } as never)
    mVerifyPassword.mockResolvedValue(true)
    const res = await DELETE(deleteReq({ confirmPassword: 'right' }), { params })
    expect(res.status).toBe(401)
    expect((await res.json()).requires2fa).toBe(true)
  })

  it('deletes and emits events with a valid password (no TOTP)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      passwordHash: 'h',
      totpEnabled: false,
    } as never)
    mVerifyPassword.mockResolvedValue(true)
    vi.mocked(db.project.findUnique).mockResolvedValue({
      id: 'p1',
      members: [{ id: 'm1', userId: 'u2', role: { id: 'r1', name: 'Member' } }],
    } as never)
    vi.mocked(db.project.delete).mockResolvedValue({ id: 'p1' } as never)

    const res = await DELETE(deleteReq({ confirmPassword: 'right' }), { params })
    expect(res.status).toBe(200)
    expect(db.project.delete).toHaveBeenCalled()
    expect(projectEvents.emitProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'project.deleted' }),
    )
    expect(projectEvents.emitMemberEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'member.removed', memberId: 'm1' }),
    )
  })

  it('skips reauthentication in demo mode', async () => {
    mDemo.mockReturnValue(true)
    vi.mocked(db.project.findUnique).mockResolvedValue({ id: 'p1', members: [] } as never)
    vi.mocked(db.project.delete).mockResolvedValue({ id: 'p1' } as never)
    const res = await DELETE(deleteReq(), { params })
    expect(res.status).toBe(200)
    expect(mVerifyPassword).not.toHaveBeenCalled()
  })
})
