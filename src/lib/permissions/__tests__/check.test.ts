import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canAssignRole,
  canManageMember,
  getEffectivePermissions,
  getRolePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isMember,
} from '../check'
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from '../constants'

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
  },
}))

// Import mocked db after vi.mock
import { db } from '@/lib/db'

// Type-safe mock accessors
const mockUserFindUnique = vi.mocked(db.user.findUnique)
const mockProjectMemberFindUnique = vi.mocked(db.projectMember.findUnique)
const mockRoleFindUnique = vi.mocked(db.role.findUnique)

// Test data helpers
const TEST_USER_ID = 'user-1'
const TEST_PROJECT_ID = 'project-1'
const TEST_ROLE_ID = 'role-1'

/**
 * Create a minimal mock member result with just the role position.
 * Used for canManageMember/canAssignRole tests where Prisma select
 * only returns { role: { position: number } }, but the mock type
 * expects the full model. Uses createMockMembership for type compatibility.
 */
function mockMemberWithPosition(position: number) {
  return createMockMembership([], null, position)
}

function createMockMembership(
  rolePermissions: Permission[],
  overrides: Permission[] | null = null,
  rolePosition = 2,
) {
  return {
    id: 'member-1',
    roleId: TEST_ROLE_ID,
    overrides: overrides ? JSON.stringify(overrides) : null,
    userId: TEST_USER_ID,
    projectId: TEST_PROJECT_ID,
    role: {
      id: TEST_ROLE_ID,
      name: 'Member',
      permissions: JSON.stringify(rolePermissions),
      isDefault: true,
      position: rolePosition,
    },
  }
}

describe('Permission Checking Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEffectivePermissions', () => {
    it('should return all permissions for system admin', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result.isSystemAdmin).toBe(true)
      expect(result.membership).toBeNull()
      expect(result.permissions.size).toBe(ALL_PERMISSIONS.length)
      for (const perm of ALL_PERMISSIONS) {
        expect(result.permissions.has(perm)).toBe(true)
      }
    })

    it('should return empty permissions for non-member', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(null)

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result.isSystemAdmin).toBe(false)
      expect(result.membership).toBeNull()
      expect(result.permissions.size).toBe(0)
    })

    it('should return role permissions for member without overrides', async () => {
      const rolePermissions: Permission[] = [
        PERMISSIONS.TICKETS_CREATE,
        PERMISSIONS.TICKETS_MANAGE_OWN,
      ]
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(createMockMembership(rolePermissions))

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result.isSystemAdmin).toBe(false)
      expect(result.membership).not.toBeNull()
      expect(result.permissions.size).toBe(2)
      expect(result.permissions.has(PERMISSIONS.TICKETS_CREATE)).toBe(true)
      expect(result.permissions.has(PERMISSIONS.TICKETS_MANAGE_OWN)).toBe(true)
    })

    it('should combine role permissions with overrides', async () => {
      const rolePermissions: Permission[] = [PERMISSIONS.TICKETS_CREATE]
      const overrides: Permission[] = [PERMISSIONS.LABELS_MANAGE]
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership(rolePermissions, overrides),
      )

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result.permissions.size).toBe(2)
      expect(result.permissions.has(PERMISSIONS.TICKETS_CREATE)).toBe(true)
      expect(result.permissions.has(PERMISSIONS.LABELS_MANAGE)).toBe(true)
    })

    it('should ignore invalid override JSON', async () => {
      const rolePermissions: Permission[] = [PERMISSIONS.TICKETS_CREATE]
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue({
        ...createMockMembership(rolePermissions),
        overrides: 'invalid-json{',
      })

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      // Should only have role permissions, invalid overrides ignored
      expect(result.permissions.size).toBe(1)
      expect(result.permissions.has(PERMISSIONS.TICKETS_CREATE)).toBe(true)
    })

    it('should filter invalid permissions in overrides', async () => {
      const rolePermissions: Permission[] = [PERMISSIONS.TICKETS_CREATE]
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue({
        ...createMockMembership(rolePermissions),
        overrides: JSON.stringify(['invalid.permission', PERMISSIONS.LABELS_MANAGE]),
      })

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      // Only valid permissions should be included
      expect(result.permissions.size).toBe(2)
      expect(result.permissions.has(PERMISSIONS.TICKETS_CREATE)).toBe(true)
      expect(result.permissions.has(PERMISSIONS.LABELS_MANAGE)).toBe(true)
    })

    it('should return empty permissions for user that does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null)
      mockProjectMemberFindUnique.mockResolvedValue(null)

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result.isSystemAdmin).toBe(false)
      expect(result.permissions.size).toBe(0)
    })

    it('should return empty set for Viewer role with no permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(createMockMembership([]))

      const result = await getEffectivePermissions(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result.permissions.size).toBe(0)
    })
  })

  describe('hasPermission', () => {
    it('should return true when user has the permission', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasPermission(TEST_USER_ID, TEST_PROJECT_ID, PERMISSIONS.TICKETS_CREATE)

      expect(result).toBe(true)
    })

    it('should return false when user does not have the permission', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasPermission(TEST_USER_ID, TEST_PROJECT_ID, PERMISSIONS.PROJECT_DELETE)

      expect(result).toBe(false)
    })

    it('should return true for system admin regardless of role permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await hasPermission(TEST_USER_ID, TEST_PROJECT_ID, PERMISSIONS.PROJECT_DELETE)

      expect(result).toBe(true)
    })

    it('should return false for non-member', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(null)

      const result = await hasPermission(TEST_USER_ID, TEST_PROJECT_ID, PERMISSIONS.TICKETS_CREATE)

      expect(result).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('should return true when user has one of the permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasAnyPermission(TEST_USER_ID, TEST_PROJECT_ID, [
        PERMISSIONS.TICKETS_CREATE,
        PERMISSIONS.SPRINTS_MANAGE,
      ])

      expect(result).toBe(true)
    })

    it('should return false when user has none of the permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasAnyPermission(TEST_USER_ID, TEST_PROJECT_ID, [
        PERMISSIONS.PROJECT_DELETE,
        PERMISSIONS.MEMBERS_ADMIN,
      ])

      expect(result).toBe(false)
    })

    it('should return false for empty permissions array', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasAnyPermission(TEST_USER_ID, TEST_PROJECT_ID, [])

      expect(result).toBe(false)
    })

    it('should return true for system admin regardless of permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await hasAnyPermission(TEST_USER_ID, TEST_PROJECT_ID, [
        PERMISSIONS.PROJECT_DELETE,
        PERMISSIONS.MEMBERS_ADMIN,
      ])

      expect(result).toBe(true)
    })
  })

  describe('hasAllPermissions', () => {
    it('should return true when user has all permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_MANAGE_OWN]),
      )

      const result = await hasAllPermissions(TEST_USER_ID, TEST_PROJECT_ID, [
        PERMISSIONS.TICKETS_CREATE,
        PERMISSIONS.TICKETS_MANAGE_OWN,
      ])

      expect(result).toBe(true)
    })

    it('should return false when user is missing one permission', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasAllPermissions(TEST_USER_ID, TEST_PROJECT_ID, [
        PERMISSIONS.TICKETS_CREATE,
        PERMISSIONS.PROJECT_DELETE,
      ])

      expect(result).toBe(false)
    })

    it('should return true for empty permissions array', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await hasAllPermissions(TEST_USER_ID, TEST_PROJECT_ID, [])

      expect(result).toBe(true)
    })

    it('should return true for system admin regardless of permissions', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await hasAllPermissions(TEST_USER_ID, TEST_PROJECT_ID, [
        PERMISSIONS.PROJECT_DELETE,
        PERMISSIONS.MEMBERS_ADMIN,
      ])

      expect(result).toBe(true)
    })
  })

  describe('isMember', () => {
    it('should return true for system admin even without membership', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await isMember(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result).toBe(true)
      // Should not check membership for system admin
      expect(mockProjectMemberFindUnique).not.toHaveBeenCalled()
    })

    it('should return true for actual member', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue({ id: 'member-1' })

      const result = await isMember(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result).toBe(true)
    })

    it('should return false for non-member', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(null)

      const result = await isMember(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })

    it('should return false for non-existent user', async () => {
      mockUserFindUnique.mockResolvedValue(null)
      mockProjectMemberFindUnique.mockResolvedValue(null)

      const result = await isMember(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })
  })

  describe('getRolePermissions', () => {
    it('should return parsed permissions for valid role', async () => {
      mockRoleFindUnique.mockResolvedValue({
        permissions: JSON.stringify([PERMISSIONS.TICKETS_CREATE, PERMISSIONS.LABELS_MANAGE]),
      })

      const result = await getRolePermissions(TEST_ROLE_ID)

      expect(result).toHaveLength(2)
      expect(result).toContain(PERMISSIONS.TICKETS_CREATE)
      expect(result).toContain(PERMISSIONS.LABELS_MANAGE)
    })

    it('should return empty array for non-existent role', async () => {
      mockRoleFindUnique.mockResolvedValue(null)

      const result = await getRolePermissions(TEST_ROLE_ID)

      expect(result).toEqual([])
    })

    it('should filter invalid permissions', async () => {
      mockRoleFindUnique.mockResolvedValue({
        permissions: JSON.stringify(['invalid.perm', PERMISSIONS.TICKETS_CREATE]),
      })

      const result = await getRolePermissions(TEST_ROLE_ID)

      expect(result).toHaveLength(1)
      expect(result).toContain(PERMISSIONS.TICKETS_CREATE)
    })
  })

  describe('canManageMember', () => {
    const actorId = 'actor-1'
    const targetId = 'target-1'

    it('should return false when trying to manage self', async () => {
      const result = await canManageMember(actorId, actorId, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })

    it('should return false when actor lacks members.manage permission', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })

    it('should return true for system admin', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(true)
    })

    it('should return true when actor has higher rank (Owner managing Admin)', async () => {
      // First call for getEffectivePermissions (actor)
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(
          createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 0), // Owner position
        )
        .mockResolvedValueOnce(mockMemberWithPosition(0)) // Actor's position
        .mockResolvedValueOnce(mockMemberWithPosition(1)) // Target's position (Admin)

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(true)
    })

    it('should return false when actor has lower rank (Admin managing Owner)', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(
          createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 1), // Admin position
        )
        .mockResolvedValueOnce(mockMemberWithPosition(1)) // Actor's position (Admin)
        .mockResolvedValueOnce(mockMemberWithPosition(0)) // Target's position (Owner)

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })

    it('should return false when actor has same rank (Admin managing Admin)', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(
          createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 1), // Admin position
        )
        .mockResolvedValueOnce(mockMemberWithPosition(1)) // Actor's position
        .mockResolvedValueOnce(mockMemberWithPosition(1)) // Target's position (same)

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })

    it('should return false when actor membership not found', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 0))
        .mockResolvedValueOnce(null) // Actor not found
        .mockResolvedValueOnce(mockMemberWithPosition(2))

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })

    it('should return false when target membership not found', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 0))
        .mockResolvedValueOnce(mockMemberWithPosition(0))
        .mockResolvedValueOnce(null) // Target not found

      const result = await canManageMember(actorId, targetId, TEST_PROJECT_ID)

      expect(result).toBe(false)
    })
  })

  describe('canAssignRole', () => {
    const actorId = 'actor-1'
    const targetRoleId = 'target-role-1'

    it('should return false when actor lacks members.manage permission', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique.mockResolvedValue(
        createMockMembership([PERMISSIONS.TICKETS_CREATE]),
      )

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(false)
    })

    it('should return true for system admin', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: true })

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(true)
    })

    it('should return true when assigning lower-ranked role (Owner assigning Admin)', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(
          createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 0), // Owner
        )
        .mockResolvedValueOnce(mockMemberWithPosition(0)) // Actor's position
      mockRoleFindUnique.mockResolvedValue({
        position: 1, // Admin position
      })

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(true)
    })

    it('should return false when assigning higher-ranked role (Admin assigning Owner)', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(
          createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 1), // Admin
        )
        .mockResolvedValueOnce(mockMemberWithPosition(1)) // Actor's position
      mockRoleFindUnique.mockResolvedValue({
        position: 0, // Owner position
      })

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(false)
    })

    it('should return false when assigning same-ranked role', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(
          createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 1), // Admin
        )
        .mockResolvedValueOnce(mockMemberWithPosition(1)) // Actor's position
      mockRoleFindUnique.mockResolvedValue({
        position: 1, // Same position
      })

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(false)
    })

    it('should return false when actor membership not found', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 0))
        .mockResolvedValueOnce(null) // Actor not found
      mockRoleFindUnique.mockResolvedValue({ position: 2 })

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(false)
    })

    it('should return false when target role not found', async () => {
      mockUserFindUnique.mockResolvedValue({ isSystemAdmin: false })
      mockProjectMemberFindUnique
        .mockResolvedValueOnce(createMockMembership([PERMISSIONS.MEMBERS_MANAGE], null, 0))
        .mockResolvedValueOnce(mockMemberWithPosition(0))
      mockRoleFindUnique.mockResolvedValue(null) // Role not found

      const result = await canAssignRole(actorId, TEST_PROJECT_ID, targetRoleId)

      expect(result).toBe(false)
    })
  })
})
