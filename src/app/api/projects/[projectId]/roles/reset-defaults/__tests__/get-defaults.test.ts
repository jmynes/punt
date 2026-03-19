import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PERMISSIONS, PERMISSIONS } from '@/lib/permissions'
import { ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_PRESETS } from '@/lib/permissions/presets'

// Mock all dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    systemSettings: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/events', () => ({
  projectEvents: {
    emitRoleEvent: vi.fn(),
  },
}))

vi.mock('@/lib/auth-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth-helpers')>()
  return {
    ...original,
    requireAuth: vi.fn(),
    requireProjectByKey: vi.fn().mockImplementation(async (key: string) => key),
    requirePermission: vi.fn(),
  }
})

vi.mock('@/lib/demo/demo-config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/demo/demo-config')>()
  return {
    ...original,
    isDemoMode: vi.fn(() => false),
  }
})

import { requireAuth, requirePermission } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { GET } from '../route'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockRequireAuth = vi.mocked(requireAuth)
const mockRequirePermission = vi.mocked(requirePermission)

const TEST_USER = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  avatar: null,
  isSystemAdmin: false,
  isActive: true,
}

function makeRequest() {
  return new Request('http://localhost:3000/api/projects/proj-1/roles/reset-defaults', {
    method: 'GET',
  })
}

const makeParams = () => ({ params: Promise.resolve({ projectId: 'proj-1' }) })

describe('GET /api/projects/[projectId]/roles/reset-defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(TEST_USER)
    mockRequirePermission.mockResolvedValue(true)
  })

  it('returns hardcoded defaults when no admin customization exists', async () => {
    mockDb.systemSettings.findUnique.mockResolvedValue(null)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.defaults).toBeDefined()
    expect(body.customRoles).toBeDefined()
    expect(body.customRoles).toEqual([])

    // Owner should have all permissions
    expect(body.defaults.Owner.permissions.sort()).toEqual([...ALL_PERMISSIONS].sort())
    expect(body.defaults.Owner.color).toBe(ROLE_COLORS.Owner)
    expect(body.defaults.Owner.description).toBe(ROLE_DESCRIPTIONS.Owner)

    // Admin should have preset permissions
    expect(body.defaults.Admin.permissions.sort()).toEqual([...ROLE_PRESETS.Admin].sort())
    expect(body.defaults.Admin.color).toBe(ROLE_COLORS.Admin)

    // Member should have preset permissions
    expect(body.defaults.Member.permissions.sort()).toEqual([...ROLE_PRESETS.Member].sort())
    expect(body.defaults.Member.color).toBe(ROLE_COLORS.Member)
  })

  it('returns customized values when admin has modified defaults', async () => {
    const customSettings = {
      Owner: { color: '#ff0000', description: 'Custom owner desc' },
      Admin: {
        name: 'Moderator',
        permissions: [PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_MANAGE_ANY],
        color: '#00ff00',
        description: 'Custom admin role',
      },
      Member: { permissions: [PERMISSIONS.TICKETS_CREATE] },
      _customRoles: [
        {
          id: 'custom-1',
          name: 'Reviewer',
          permissions: [PERMISSIONS.TICKETS_CREATE],
          color: '#purple',
          description: 'Reviews tickets',
          position: 5,
        },
      ],
    }

    mockDb.systemSettings.findUnique.mockResolvedValue({
      defaultRolePermissions: customSettings,
    })

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)

    const body = await res.json()

    // Owner color/description customized, but still has ALL permissions
    expect(body.defaults.Owner.color).toBe('#ff0000')
    expect(body.defaults.Owner.description).toBe('Custom owner desc')
    expect(body.defaults.Owner.permissions.sort()).toEqual([...ALL_PERMISSIONS].sort())

    // Admin fully customized
    expect(body.defaults.Admin.name).toBe('Moderator')
    expect(body.defaults.Admin.color).toBe('#00ff00')
    expect(body.defaults.Admin.description).toBe('Custom admin role')
    expect(body.defaults.Admin.permissions.sort()).toEqual(
      [PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_MANAGE_ANY].sort(),
    )

    // Member permissions customized
    expect(body.defaults.Member.permissions).toEqual([PERMISSIONS.TICKETS_CREATE])

    // Custom roles included
    expect(body.customRoles).toHaveLength(1)
    expect(body.customRoles[0].name).toBe('Reviewer')
    expect(body.customRoles[0].color).toBe('#purple')
  })

  it('requires authentication', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))

    const res = await GET(makeRequest(), makeParams())
    // handleApiError returns error response
    expect(res.status).toBe(401)
  })

  it('requires members.admin permission', async () => {
    mockRequirePermission.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })
})
