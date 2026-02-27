/**
 * Fuzz tests for database export/import schemas.
 * Tests that schemas accept both native JSON (PostgreSQL) and legacy string formats.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  ExportDataSchema,
  ProjectMemberSchema,
  RoleSchema,
  SystemSettingsSchema,
  UserSchema,
} from '@/lib/schemas/database-export'
import { FUZZ_CONFIG } from '../setup'

// Helper: generate a valid ISO datetime string
const isoDatetime = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  .filter((d) => !Number.isNaN(d.getTime()))
  .map((d) => d.toISOString())

describe('Database Export Schema Fuzz Tests', () => {
  describe('jsonOrString helper behavior', () => {
    it('should accept strings in RoleSchema permissions', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
          isoDatetime,
          isoDatetime,
          (perms, createdAt, updatedAt) => {
            const role = {
              id: 'role-1',
              name: 'Test',
              color: '#000',
              description: null,
              permissions: JSON.stringify(perms),
              isDefault: false,
              position: 0,
              projectId: 'proj-1',
              createdAt,
              updatedAt,
            }
            expect(RoleSchema.safeParse(role).success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept arrays in RoleSchema permissions', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
          isoDatetime,
          isoDatetime,
          (perms, createdAt, updatedAt) => {
            const role = {
              id: 'role-1',
              name: 'Test',
              color: '#000',
              description: null,
              permissions: perms,
              isDefault: false,
              position: 0,
              projectId: 'proj-1',
              createdAt,
              updatedAt,
            }
            expect(RoleSchema.safeParse(role).success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept objects in RoleSchema permissions', () => {
      const role = {
        id: 'role-1',
        name: 'Test',
        color: '#000',
        description: null,
        permissions: { 'tickets.create': true, 'board.manage': false },
        isDefault: false,
        position: 0,
        projectId: 'proj-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      expect(RoleSchema.safeParse(role).success).toBe(true)
    })

    it('should reject null/undefined/number/boolean in jsonOrString fields', () => {
      for (const invalid of [null, undefined, 42, true, false]) {
        const role = {
          id: 'role-1',
          name: 'Test',
          color: '#000',
          description: null,
          permissions: invalid,
          isDefault: false,
          position: 0,
          projectId: 'proj-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }
        expect(RoleSchema.safeParse(role).success).toBe(false)
      }
    })
  })

  describe('SystemSettingsSchema', () => {
    function makeSettings(overrides: Record<string, unknown> = {}) {
      return {
        id: 'system-settings',
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: null,
        appName: 'PUNT',
        logoUrl: null,
        logoLetter: 'P',
        logoGradientFrom: '#000',
        logoGradientTo: '#fff',
        maxImageSizeMB: 10,
        maxVideoSizeMB: 100,
        maxDocumentSizeMB: 25,
        maxAttachmentsPerTicket: 20,
        allowedImageTypes: ['image/jpeg', 'image/png'],
        allowedVideoTypes: ['video/mp4'],
        allowedDocumentTypes: ['application/pdf'],
        emailEnabled: false,
        emailProvider: 'console',
        emailFromAddress: 'noreply@example.com',
        emailFromName: 'PUNT',
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpSecure: true,
        emailPasswordReset: true,
        emailWelcome: true,
        emailVerification: true,
        emailInvitations: true,
        defaultRolePermissions: null,
        ...overrides,
      }
    }

    it('should accept native JSON arrays for MIME types', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { maxLength: 5 }),
          fc.array(fc.string(), { maxLength: 5 }),
          fc.array(fc.string(), { maxLength: 5 }),
          (imageTypes, videoTypes, docTypes) => {
            const settings = makeSettings({
              allowedImageTypes: imageTypes,
              allowedVideoTypes: videoTypes,
              allowedDocumentTypes: docTypes,
            })
            expect(SystemSettingsSchema.safeParse(settings).success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept legacy JSON strings for MIME types', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { maxLength: 5 }),
          fc.array(fc.string(), { maxLength: 5 }),
          fc.array(fc.string(), { maxLength: 5 }),
          (imageTypes, videoTypes, docTypes) => {
            const settings = makeSettings({
              allowedImageTypes: JSON.stringify(imageTypes),
              allowedVideoTypes: JSON.stringify(videoTypes),
              allowedDocumentTypes: JSON.stringify(docTypes),
            })
            expect(SystemSettingsSchema.safeParse(settings).success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept native JSON and legacy string for defaultRolePermissions', () => {
      const asObject = makeSettings({ defaultRolePermissions: { 'tickets.create': true } })
      expect(SystemSettingsSchema.safeParse(asObject).success).toBe(true)

      const asString = makeSettings({
        defaultRolePermissions: '{"tickets.create": true}',
      })
      expect(SystemSettingsSchema.safeParse(asString).success).toBe(true)

      const asNull = makeSettings({ defaultRolePermissions: null })
      expect(SystemSettingsSchema.safeParse(asNull).success).toBe(true)
    })
  })

  describe('UserSchema', () => {
    function makeUser(overrides: Record<string, unknown> = {}) {
      return {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        avatar: null,
        avatarColor: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: null,
        passwordHash: 'hash',
        passwordChangedAt: null,
        emailVerified: null,
        isSystemAdmin: false,
        isActive: true,
        mcpApiKey: null,
        ...overrides,
      }
    }

    it('should accept totpRecoveryCodes as native array', () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { maxLength: 8 }), (codes) => {
          const user = makeUser({ totpRecoveryCodes: codes })
          expect(UserSchema.safeParse(user).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept totpRecoveryCodes as legacy string', () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { maxLength: 8 }), (codes) => {
          const user = makeUser({ totpRecoveryCodes: JSON.stringify(codes) })
          expect(UserSchema.safeParse(user).success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept totpRecoveryCodes as null', () => {
      const user = makeUser({ totpRecoveryCodes: null })
      expect(UserSchema.safeParse(user).success).toBe(true)
    })

    it('should accept optional usernameLower for backward compatibility', () => {
      const withLower = makeUser({ usernameLower: 'testuser' })
      expect(UserSchema.safeParse(withLower).success).toBe(true)

      const withNull = makeUser({ usernameLower: null })
      expect(UserSchema.safeParse(withNull).success).toBe(true)

      const without = makeUser()
      expect(UserSchema.safeParse(without).success).toBe(true)
    })
  })

  describe('ProjectMemberSchema', () => {
    function makeMember(overrides: Record<string, unknown> = {}) {
      return {
        id: 'pm-1',
        roleId: 'role-1',
        overrides: null,
        userId: 'user-1',
        projectId: 'proj-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides,
      }
    }

    it('should accept overrides as native JSON object', () => {
      const member = makeMember({ overrides: { 'tickets.create': true } })
      expect(ProjectMemberSchema.safeParse(member).success).toBe(true)
    })

    it('should accept overrides as legacy string', () => {
      const member = makeMember({ overrides: '{"tickets.create": true}' })
      expect(ProjectMemberSchema.safeParse(member).success).toBe(true)
    })

    it('should accept overrides as null', () => {
      const member = makeMember({ overrides: null })
      expect(ProjectMemberSchema.safeParse(member).success).toBe(true)
    })

    it('should accept overrides as array', () => {
      const member = makeMember({ overrides: ['tickets.create'] })
      expect(ProjectMemberSchema.safeParse(member).success).toBe(true)
    })
  })

  describe('ExportDataSchema', () => {
    function makeMinimalExport(overrides: Record<string, unknown> = {}) {
      return {
        systemSettings: null,
        users: [],
        projects: [],
        roles: [],
        columns: [],
        labels: [],
        sprints: [],
        projectMembers: [],
        projectSprintSettings: [],
        tickets: [],
        ticketLinks: [],
        ticketWatchers: [],
        comments: [],
        ticketEdits: [],
        ticketActivities: [],
        attachments: [],
        ticketSprintHistory: [],
        invitations: [],
        ...overrides,
      }
    }

    it('should accept minimal valid export', () => {
      expect(ExportDataSchema.safeParse(makeMinimalExport()).success).toBe(true)
    })

    it('should accept export with native JSON fields', () => {
      const data = makeMinimalExport({
        users: [
          {
            id: 'u-1',
            username: 'admin',
            email: 'admin@test.com',
            name: 'Admin',
            avatar: null,
            avatarColor: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            lastLoginAt: null,
            passwordHash: 'hash',
            passwordChangedAt: null,
            emailVerified: null,
            isSystemAdmin: true,
            isActive: true,
            mcpApiKey: null,
            totpRecoveryCodes: ['code1', 'code2'],
          },
        ],
        roles: [
          {
            id: 'r-1',
            name: 'Admin',
            color: '#f00',
            description: null,
            permissions: ['tickets.create', 'board.manage'],
            isDefault: false,
            position: 0,
            projectId: 'p-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      })
      expect(ExportDataSchema.safeParse(data).success).toBe(true)
    })

    it('should accept export with legacy string fields', () => {
      const data = makeMinimalExport({
        users: [
          {
            id: 'u-1',
            username: 'admin',
            email: 'admin@test.com',
            name: 'Admin',
            avatar: null,
            avatarColor: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            lastLoginAt: null,
            passwordHash: 'hash',
            passwordChangedAt: null,
            emailVerified: null,
            isSystemAdmin: true,
            isActive: true,
            mcpApiKey: null,
            totpRecoveryCodes: '["code1", "code2"]',
          },
        ],
        roles: [
          {
            id: 'r-1',
            name: 'Admin',
            color: '#f00',
            description: null,
            permissions: '["tickets.create", "board.manage"]',
            isDefault: false,
            position: 0,
            projectId: 'p-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      })
      expect(ExportDataSchema.safeParse(data).success).toBe(true)
    })

    it('should accept export with mixed native + legacy formats', () => {
      const data = makeMinimalExport({
        users: [
          {
            id: 'u-1',
            username: 'admin',
            email: null,
            name: 'Admin',
            avatar: null,
            avatarColor: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            lastLoginAt: null,
            passwordHash: null,
            passwordChangedAt: null,
            emailVerified: null,
            isSystemAdmin: false,
            isActive: true,
            mcpApiKey: null,
            totpRecoveryCodes: ['native', 'array'], // native
          },
        ],
        roles: [
          {
            id: 'r-1',
            name: 'Member',
            color: '#0f0',
            description: null,
            permissions: '["tickets.create"]', // legacy string
            isDefault: true,
            position: 1,
            projectId: 'p-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        projectMembers: [
          {
            id: 'pm-1',
            roleId: 'r-1',
            overrides: '{"tickets.manage_any": true}', // legacy string
            userId: 'u-1',
            projectId: 'p-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      })
      expect(ExportDataSchema.safeParse(data).success).toBe(true)
    })
  })
})
