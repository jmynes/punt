import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSIONS, type Permission } from '../permissions'

// Mock the auth module (must be before auth-helpers import)
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
  },
}))

// Mock the permissions module
vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
  isMember: vi.fn(),
  getEffectivePermissions: vi.fn(),
  PERMISSIONS: {
    PROJECT_SETTINGS: 'project.settings',
    PROJECT_DELETE: 'project.delete',
    MEMBERS_INVITE: 'members.invite',
    MEMBERS_MANAGE: 'members.manage',
    MEMBERS_ADMIN: 'members.admin',
    BOARD_MANAGE: 'board.manage',
    TICKETS_CREATE: 'tickets.create',
    TICKETS_MANAGE_OWN: 'tickets.manage_own',
    TICKETS_MANAGE_ANY: 'tickets.manage_any',
    SPRINTS_MANAGE: 'sprints.manage',
    LABELS_MANAGE: 'labels.manage',
    COMMENTS_MANAGE_ANY: 'comments.manage_any',
    ATTACHMENTS_MANAGE_ANY: 'attachments.manage_any',
  },
}))

// Import mocked functions
import {
  getEffectivePermissions,
  hasAnyPermission,
  hasPermission,
  isMember,
} from '@/lib/permissions'
// Import the auth-helpers after mocks are set up
import {
  requireAnyPermission,
  requireAttachmentPermission,
  requireCommentPermission,
  requireMembership,
  requirePermission,
  requireResourcePermission,
  requireTicketPermission,
} from '../auth-helpers'

const mockHasPermission = vi.mocked(hasPermission)
const mockHasAnyPermission = vi.mocked(hasAnyPermission)
const mockIsMember = vi.mocked(isMember)
const mockGetEffectivePermissions = vi.mocked(getEffectivePermissions)

// Test data
const TEST_USER_ID = 'user-1'
const TEST_PROJECT_ID = 'project-1'
const OTHER_USER_ID = 'other-user'

describe('Auth Helpers - Permission Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requirePermission', () => {
    it('should return true when user has the permission', async () => {
      mockHasPermission.mockResolvedValue(true)

      const result = await requirePermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        PERMISSIONS.TICKETS_CREATE,
      )

      expect(result).toBe(true)
      expect(mockHasPermission).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        PERMISSIONS.TICKETS_CREATE,
      )
    })

    it('should throw when user does not have the permission', async () => {
      mockHasPermission.mockResolvedValue(false)

      await expect(
        requirePermission(TEST_USER_ID, TEST_PROJECT_ID, PERMISSIONS.PROJECT_DELETE),
      ).rejects.toThrow('Forbidden: Missing permission project.delete')
    })
  })

  describe('requireAnyPermission', () => {
    it('should return true when user has at least one permission', async () => {
      mockHasAnyPermission.mockResolvedValue(true)

      const permissions: Permission[] = [PERMISSIONS.TICKETS_CREATE, PERMISSIONS.LABELS_MANAGE]
      const result = await requireAnyPermission(TEST_USER_ID, TEST_PROJECT_ID, permissions)

      expect(result).toBe(true)
      expect(mockHasAnyPermission).toHaveBeenCalledWith(TEST_USER_ID, TEST_PROJECT_ID, permissions)
    })

    it('should throw when user has none of the permissions', async () => {
      mockHasAnyPermission.mockResolvedValue(false)

      const permissions: Permission[] = [PERMISSIONS.PROJECT_DELETE, PERMISSIONS.MEMBERS_ADMIN]
      await expect(
        requireAnyPermission(TEST_USER_ID, TEST_PROJECT_ID, permissions),
      ).rejects.toThrow('Forbidden: Missing required permissions')
    })
  })

  describe('requireMembership', () => {
    it('should return true when user is a member', async () => {
      mockIsMember.mockResolvedValue(true)

      const result = await requireMembership(TEST_USER_ID, TEST_PROJECT_ID)

      expect(result).toBe(true)
      expect(mockIsMember).toHaveBeenCalledWith(TEST_USER_ID, TEST_PROJECT_ID)
    })

    it('should throw when user is not a member', async () => {
      mockIsMember.mockResolvedValue(false)

      await expect(requireMembership(TEST_USER_ID, TEST_PROJECT_ID)).rejects.toThrow(
        'Forbidden: Not a project member',
      )
    })
  })

  describe('requireResourcePermission', () => {
    const ownPermission = PERMISSIONS.TICKETS_MANAGE_OWN
    const anyPermission = PERMISSIONS.TICKETS_MANAGE_ANY

    it('should return true for system admin', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set(),
        membership: null,
        isSystemAdmin: true,
      })

      const result = await requireResourcePermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID,
        ownPermission,
        anyPermission,
      )

      expect(result).toBe(true)
    })

    it('should return true when user has "any" permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_ANY]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireResourcePermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID, // Different owner
        ownPermission,
        anyPermission,
      )

      expect(result).toBe(true)
    })

    it('should return true when user owns the resource and has "own" permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_OWN]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireResourcePermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        TEST_USER_ID, // Same as user
        ownPermission,
        anyPermission,
      )

      expect(result).toBe(true)
    })

    it('should throw when user owns the resource but lacks "own" permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set(), // No permissions
        membership: {} as any,
        isSystemAdmin: false,
      })

      await expect(
        requireResourcePermission(
          TEST_USER_ID,
          TEST_PROJECT_ID,
          TEST_USER_ID, // Same as user
          ownPermission,
          anyPermission,
        ),
      ).rejects.toThrow('Forbidden: Missing permission to modify this resource')
    })

    it('should throw when user does not own resource and lacks "any" permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_OWN]), // Only has "own"
        membership: {} as any,
        isSystemAdmin: false,
      })

      await expect(
        requireResourcePermission(
          TEST_USER_ID,
          TEST_PROJECT_ID,
          OTHER_USER_ID, // Different owner
          ownPermission,
          anyPermission,
        ),
      ).rejects.toThrow('Forbidden: Missing permission to modify this resource')
    })

    it('should handle null owner (legacy data)', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_ANY]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireResourcePermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        null, // No owner (legacy)
        ownPermission,
        anyPermission,
      )

      expect(result).toBe(true)
    })
  })

  describe('requireTicketPermission', () => {
    it('should allow ticket creator with manage_own permission to edit', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_OWN]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireTicketPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        TEST_USER_ID, // Creator is same as user
        'edit',
      )

      expect(result).toBe(true)
    })

    it('should allow ticket creator with manage_own permission to delete', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_OWN]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireTicketPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        TEST_USER_ID,
        'delete',
      )

      expect(result).toBe(true)
    })

    it('should allow user with manage_any to edit any ticket', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_ANY]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireTicketPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID, // Different creator
        'edit',
      )

      expect(result).toBe(true)
    })

    it('should deny non-creator with only manage_own permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_OWN]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      await expect(
        requireTicketPermission(
          TEST_USER_ID,
          TEST_PROJECT_ID,
          OTHER_USER_ID, // Different creator
          'edit',
        ),
      ).rejects.toThrow('Forbidden: Missing permission to modify this resource')
    })

    it('should allow system admin to edit any ticket', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set(),
        membership: null,
        isSystemAdmin: true,
      })

      const result = await requireTicketPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID,
        'edit',
      )

      expect(result).toBe(true)
    })
  })

  describe('requireCommentPermission', () => {
    it('should always allow editing own comment', async () => {
      // No need to mock - own comments are always allowed
      const result = await requireCommentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        TEST_USER_ID, // Same as user
        'edit',
      )

      expect(result).toBe(true)
      // getEffectivePermissions should not be called for own comments
      expect(mockGetEffectivePermissions).not.toHaveBeenCalled()
    })

    it('should always allow deleting own comment', async () => {
      const result = await requireCommentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        TEST_USER_ID,
        'delete',
      )

      expect(result).toBe(true)
    })

    it('should allow moderating other comments with comments.manage_any', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.COMMENTS_MANAGE_ANY]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireCommentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID,
        'delete',
      )

      expect(result).toBe(true)
    })

    it('should allow system admin to moderate any comment', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set(),
        membership: null,
        isSystemAdmin: true,
      })

      const result = await requireCommentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID,
        'edit',
      )

      expect(result).toBe(true)
    })

    it('should deny moderating other comments without permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_ANY]), // Wrong permission
        membership: {} as any,
        isSystemAdmin: false,
      })

      await expect(
        requireCommentPermission(TEST_USER_ID, TEST_PROJECT_ID, OTHER_USER_ID, 'delete'),
      ).rejects.toThrow('Forbidden: Cannot modify this comment')
    })
  })

  describe('requireAttachmentPermission', () => {
    it('should always allow deleting own attachment', async () => {
      const result = await requireAttachmentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        TEST_USER_ID, // Same as user (uploader)
        'delete',
      )

      expect(result).toBe(true)
      expect(mockGetEffectivePermissions).not.toHaveBeenCalled()
    })

    it('should allow deleting other attachments with attachments.manage_any', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.ATTACHMENTS_MANAGE_ANY]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireAttachmentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID,
        'delete',
      )

      expect(result).toBe(true)
    })

    it('should allow system admin to delete any attachment', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set(),
        membership: null,
        isSystemAdmin: true,
      })

      const result = await requireAttachmentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        OTHER_USER_ID,
        'delete',
      )

      expect(result).toBe(true)
    })

    it('should deny deleting other attachments without permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.TICKETS_MANAGE_ANY]), // Wrong permission
        membership: {} as any,
        isSystemAdmin: false,
      })

      await expect(
        requireAttachmentPermission(TEST_USER_ID, TEST_PROJECT_ID, OTHER_USER_ID, 'delete'),
      ).rejects.toThrow('Forbidden: Cannot delete this attachment')
    })

    it('should handle null uploader (legacy data) with manage_any permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set([PERMISSIONS.ATTACHMENTS_MANAGE_ANY]),
        membership: {} as any,
        isSystemAdmin: false,
      })

      const result = await requireAttachmentPermission(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        null, // No uploader (legacy)
        'delete',
      )

      expect(result).toBe(true)
    })

    it('should deny deleting when uploader is null and no permission', async () => {
      mockGetEffectivePermissions.mockResolvedValue({
        permissions: new Set(),
        membership: {} as any,
        isSystemAdmin: false,
      })

      await expect(
        requireAttachmentPermission(
          TEST_USER_ID,
          TEST_PROJECT_ID,
          null, // No uploader (legacy)
          'delete',
        ),
      ).rejects.toThrow('Forbidden: Cannot delete this attachment')
    })
  })
})
