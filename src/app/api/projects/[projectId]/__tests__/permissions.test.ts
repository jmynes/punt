import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '@/lib/permissions'

// Mock all dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    projectMember: { findUnique: vi.fn(), deleteMany: vi.fn() },
    role: { findUnique: vi.fn(), deleteMany: vi.fn() },
    ticket: { deleteMany: vi.fn() },
    column: { deleteMany: vi.fn() },
    label: { deleteMany: vi.fn() },
    sprint: { deleteMany: vi.fn() },
    invitation: { deleteMany: vi.fn() },
    projectSprintSettings: { delete: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/events', () => ({
  projectEvents: {
    emitProjectEvent: vi.fn(),
    emitMemberEvent: vi.fn(),
  },
}))

vi.mock('@/lib/auth-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth-helpers')>()
  return {
    ...original,
    requireAuth: vi.fn(),
    // Mock requireProjectByKey to return the key as-is (tests use IDs)
    requireProjectByKey: vi.fn().mockImplementation(async (key: string) => key),
  }
})

vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/demo/demo-config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/demo/demo-config')>()
  return {
    ...original,
    isDemoMode: vi.fn(() => false),
  }
})

vi.mock('@/lib/permissions/check', () => ({
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
  hasAllPermissions: vi.fn(),
  isMember: vi.fn(),
  getEffectivePermissions: vi.fn(),
  getRolePermissions: vi.fn(),
  canManageMember: vi.fn(),
  canAssignRole: vi.fn(),
}))

import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { hasPermission, isMember } from '@/lib/permissions/check'
// Import routes after mocks
import { DELETE, GET, PATCH } from '../route'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockRequireAuth = vi.mocked(requireAuth)
const mockHasPermission = vi.mocked(hasPermission)
const mockIsMember = vi.mocked(isMember)
const mockVerifyPassword = vi.mocked(verifyPassword)

// Test data
const TEST_USER = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@test.com',
  name: 'Test',
  isSystemAdmin: false,
  isActive: true,
  avatar: null,
}
const TEST_PROJECT_ID = 'project-1'

function createRequest(method: string, body?: unknown): Request {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  return new Request(`http://localhost:3000/api/projects/${TEST_PROJECT_ID}`, options)
}

describe('Project API - Permission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/projects/[projectId]', () => {
    it('should return 403 when user is not a project member', async () => {
      mockRequireAuth.mockResolvedValue(TEST_USER)
      mockIsMember.mockResolvedValue(false)

      const response = await GET(createRequest('GET'), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID }),
      })

      expect(response.status).toBe(403)
    })

    it('should call isMember when user is authenticated', async () => {
      mockRequireAuth.mockResolvedValue(TEST_USER)
      mockIsMember.mockResolvedValue(true)
      // Allow the route to fail on business logic - we're testing permission check
      mockDb.project.findUnique.mockResolvedValue(null)

      await GET(createRequest('GET'), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID }),
      })

      // Verify isMember was called for membership check
      expect(mockIsMember).toHaveBeenCalledWith(TEST_USER.id, TEST_PROJECT_ID)
    })
  })

  describe('PATCH /api/projects/[projectId]', () => {
    it('should return 403 when user lacks project.settings permission', async () => {
      mockRequireAuth.mockResolvedValue(TEST_USER)
      mockHasPermission.mockResolvedValue(false)

      const response = await PATCH(createRequest('PATCH', { name: 'New Name' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID }),
      })

      expect(response.status).toBe(403)
      expect(mockHasPermission).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_PROJECT_ID,
        PERMISSIONS.PROJECT_SETTINGS,
      )
    })

    it('should call hasPermission with project.settings when updating', async () => {
      mockRequireAuth.mockResolvedValue(TEST_USER)
      mockHasPermission.mockResolvedValue(true)
      // Allow business logic to proceed - we're testing permission check was made
      mockDb.project.update.mockResolvedValue(null)

      await PATCH(createRequest('PATCH', { name: 'New Name' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID }),
      })

      expect(mockHasPermission).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_PROJECT_ID,
        PERMISSIONS.PROJECT_SETTINGS,
      )
    })
  })

  describe('DELETE /api/projects/[projectId]', () => {
    it('should return 403 when user lacks project.delete permission', async () => {
      mockRequireAuth.mockResolvedValue(TEST_USER)
      mockHasPermission.mockResolvedValue(false)

      const response = await DELETE(createRequest('DELETE'), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID }),
      })

      expect(response.status).toBe(403)
      expect(mockHasPermission).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_PROJECT_ID,
        PERMISSIONS.PROJECT_DELETE,
      )
    })

    it('should return 200 when user has project.delete permission', async () => {
      mockRequireAuth.mockResolvedValue(TEST_USER)
      mockHasPermission.mockResolvedValue(true)
      mockVerifyPassword.mockResolvedValue(true)
      mockDb.user.findUnique.mockResolvedValue({
        passwordHash: 'hashed-password',
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryCodes: null,
      })
      mockDb.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        members: [{ id: 'member-1', userId: TEST_USER.id, role: { id: 'role-1', name: 'owner' } }],
      })
      mockDb.project.delete.mockResolvedValue({ id: TEST_PROJECT_ID })

      const response = await DELETE(createRequest('DELETE', { confirmPassword: 'password123' }), {
        params: Promise.resolve({ projectId: TEST_PROJECT_ID }),
      })

      expect(response.status).toBe(200)
    })
  })
})
