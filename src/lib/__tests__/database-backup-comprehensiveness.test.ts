/**
 * Comprehensive tests for database backup/restore functionality
 *
 * Verifies:
 * - All Prisma models are included in exports
 * - All fields within each model are exported/imported correctly
 * - Data integrity through round-trip export/import
 * - Relationships are preserved
 * - Edge cases (empty database, large datasets)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { exportDatabase } from '@/lib/database-export'
import { importDatabase } from '@/lib/database-import'
import { db } from '@/lib/db'
import { ExportDataSchema } from '@/lib/schemas/database-export'

// ============================================================================
// Test Data Factory
// ============================================================================

const createTestUser = (overrides: Record<string, unknown> = {}) => ({
  id: `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  username: `testuser_${Date.now()}`,
  email: `test${Date.now()}@example.com`,
  name: 'Test User',
  avatar: '/uploads/avatars/test.webp',
  avatarColor: '#ff5733',
  passwordHash: '$2a$12$testhashedpassword',
  passwordChangedAt: new Date(),
  emailVerified: new Date(),
  isSystemAdmin: true,
  isActive: true,
  lastLoginAt: new Date(),
  mcpApiKey: `mcp_key_${Date.now()}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createTestProject = (overrides: Record<string, unknown> = {}) => ({
  id: `test-project-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: 'Test Project',
  key: `TP${Date.now().toString(36).toUpperCase().slice(-4)}`,
  description: 'A test project description',
  color: '#3b82f6',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createTestColumn = (projectId: string, overrides: Record<string, unknown> = {}) => ({
  id: `test-column-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: 'To Do',
  icon: 'circle',
  color: '#4ade80',
  order: 0,
  projectId,
  ...overrides,
})

const createTestLabel = (projectId: string, overrides: Record<string, unknown> = {}) => ({
  id: `test-label-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: `bug_${Date.now()}`,
  color: '#ef4444',
  projectId,
  ...overrides,
})

const createTestRole = (projectId: string, overrides: Record<string, unknown> = {}) => ({
  id: `test-role-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: `Role_${Date.now()}`,
  color: '#3b82f6',
  description: 'Project owner with all permissions',
  permissions: JSON.stringify(['all']),
  isDefault: false,
  position: 0,
  projectId,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createTestSprint = (projectId: string, overrides: Record<string, unknown> = {}) => ({
  id: `test-sprint-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: 'Sprint 1',
  goal: 'Complete all tasks',
  startDate: new Date(),
  endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  budget: 20,
  status: 'active',
  completedAt: null,
  completedById: null,
  completedTicketCount: null,
  incompleteTicketCount: null,
  completedStoryPoints: null,
  incompleteStoryPoints: null,
  projectId,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createTestTicket = (
  projectId: string,
  columnId: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: `test-ticket-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  number: Math.floor(Math.random() * 10000),
  title: 'Test Ticket',
  description: 'Test description with **markdown**',
  type: 'task',
  priority: 'high',
  order: 0,
  storyPoints: 5,
  estimate: '2d',
  startDate: new Date(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  resolution: 'Done',
  environment: 'Production',
  affectedVersion: '1.0.0',
  fixVersion: '1.1.0',
  projectId,
  columnId,
  assigneeId: null,
  creatorId: null,
  sprintId: null,
  isCarriedOver: true,
  carriedFromSprintId: null,
  carriedOverCount: 2,
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// ============================================================================
// Helper Functions
// ============================================================================

async function cleanupTestData() {
  await db.ticketSprintHistory.deleteMany()
  await db.attachment.deleteMany()
  await db.ticketEdit.deleteMany()
  await db.comment.deleteMany()
  await db.ticketWatcher.deleteMany()
  await db.ticketLink.deleteMany()
  await db.ticket.deleteMany()
  await db.projectSprintSettings.deleteMany()
  await db.projectMember.deleteMany()
  await db.sprint.deleteMany()
  await db.label.deleteMany()
  await db.column.deleteMany()
  await db.role.deleteMany()
  await db.invitation.deleteMany()
  await db.project.deleteMany()
  await db.rateLimit.deleteMany()
  await db.passwordResetToken.deleteMany()
  await db.emailVerificationToken.deleteMany()
  await db.session.deleteMany()
  await db.account.deleteMany()
  await db.user.deleteMany()
  await db.systemSettings.deleteMany()
}

// ============================================================================
// Tests
// ============================================================================

describe('Database Backup Comprehensiveness', () => {
  beforeEach(async () => {
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Model Completeness', () => {
    it('should export all required models', async () => {
      // Seed minimal data
      const _user = await db.user.create({ data: createTestUser() })
      const _project = await db.project.create({ data: createTestProject() })

      const data = await exportDatabase()

      // Verify all model arrays exist
      expect(data).toHaveProperty('systemSettings')
      expect(data).toHaveProperty('users')
      expect(data).toHaveProperty('projects')
      expect(data).toHaveProperty('roles')
      expect(data).toHaveProperty('columns')
      expect(data).toHaveProperty('labels')
      expect(data).toHaveProperty('sprints')
      expect(data).toHaveProperty('projectMembers')
      expect(data).toHaveProperty('projectSprintSettings')
      expect(data).toHaveProperty('tickets')
      expect(data).toHaveProperty('ticketLinks')
      expect(data).toHaveProperty('ticketWatchers')
      expect(data).toHaveProperty('comments')
      expect(data).toHaveProperty('ticketEdits')
      expect(data).toHaveProperty('attachments')
      expect(data).toHaveProperty('ticketSprintHistory')
      expect(data).toHaveProperty('invitations')

      // All should be arrays (except systemSettings which can be null)
      expect(Array.isArray(data.users)).toBe(true)
      expect(Array.isArray(data.projects)).toBe(true)
      expect(Array.isArray(data.roles)).toBe(true)
      expect(Array.isArray(data.columns)).toBe(true)
      expect(Array.isArray(data.labels)).toBe(true)
      expect(Array.isArray(data.sprints)).toBe(true)
      expect(Array.isArray(data.projectMembers)).toBe(true)
      expect(Array.isArray(data.projectSprintSettings)).toBe(true)
      expect(Array.isArray(data.tickets)).toBe(true)
      expect(Array.isArray(data.ticketLinks)).toBe(true)
      expect(Array.isArray(data.ticketWatchers)).toBe(true)
      expect(Array.isArray(data.comments)).toBe(true)
      expect(Array.isArray(data.ticketEdits)).toBe(true)
      expect(Array.isArray(data.attachments)).toBe(true)
      expect(Array.isArray(data.ticketSprintHistory)).toBe(true)
      expect(Array.isArray(data.invitations)).toBe(true)
    })

    it('should NOT export ephemeral/security-sensitive models', async () => {
      // These models should not be exported:
      // - Session (auth sessions)
      // - Account (OAuth tokens)
      // - RateLimit (ephemeral)
      // - PasswordResetToken (security)
      // - EmailVerificationToken (security)

      const data = await exportDatabase()

      // Verify these are NOT in the export
      expect(data).not.toHaveProperty('sessions')
      expect(data).not.toHaveProperty('accounts')
      expect(data).not.toHaveProperty('rateLimits')
      expect(data).not.toHaveProperty('passwordResetTokens')
      expect(data).not.toHaveProperty('emailVerificationTokens')
    })
  })

  describe('User Field Completeness', () => {
    it('should export all User fields including avatarColor and mcpApiKey', async () => {
      const userData = createTestUser({
        avatarColor: '#ff5733',
        mcpApiKey: 'test_mcp_api_key_12345',
      })
      await db.user.create({ data: userData })

      const data = await exportDatabase()
      const exportedUser = data.users[0]

      // Verify all fields are present
      expect(exportedUser.id).toBe(userData.id)
      expect(exportedUser.username).toBe(userData.username)
      expect(exportedUser.email).toBe(userData.email)
      expect(exportedUser.name).toBe(userData.name)
      expect(exportedUser.avatar).toBe(userData.avatar)
      expect(exportedUser.avatarColor).toBe(userData.avatarColor)
      expect(exportedUser.passwordHash).toBe(userData.passwordHash)
      expect(exportedUser.isSystemAdmin).toBe(userData.isSystemAdmin)
      expect(exportedUser.isActive).toBe(userData.isActive)
      expect(exportedUser.mcpApiKey).toBe(userData.mcpApiKey)

      // Date fields should be ISO strings
      expect(typeof exportedUser.createdAt).toBe('string')
      expect(typeof exportedUser.updatedAt).toBe('string')
      expect(typeof exportedUser.lastLoginAt).toBe('string')
      expect(typeof exportedUser.passwordChangedAt).toBe('string')
      expect(typeof exportedUser.emailVerified).toBe('string')
    })

    it('should round-trip User fields including new fields', async () => {
      const userData = createTestUser({
        avatarColor: '#123abc',
        mcpApiKey: 'mcp_roundtrip_test',
      })
      await db.user.create({ data: userData })

      const data = await exportDatabase()
      await cleanupTestData()
      await importDatabase(data)

      const importedUser = await db.user.findUnique({ where: { id: userData.id } })

      expect(importedUser).not.toBeNull()
      expect(importedUser?.avatarColor).toBe(userData.avatarColor)
      expect(importedUser?.mcpApiKey).toBe(userData.mcpApiKey)
      expect(importedUser?.username).toBe(userData.username)
      expect(importedUser?.email).toBe(userData.email)
      expect(importedUser?.name).toBe(userData.name)
      expect(importedUser?.avatar).toBe(userData.avatar)
    })
  })

  describe('Column Field Completeness', () => {
    it('should export all Column fields including icon and color', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const columnData = createTestColumn(project.id, {
        icon: 'check-circle',
        color: '#22c55e',
      })
      await db.column.create({ data: columnData })

      const data = await exportDatabase()
      const exportedColumn = data.columns[0]

      expect(exportedColumn.id).toBe(columnData.id)
      expect(exportedColumn.name).toBe(columnData.name)
      expect(exportedColumn.icon).toBe(columnData.icon)
      expect(exportedColumn.color).toBe(columnData.color)
      expect(exportedColumn.order).toBe(columnData.order)
      expect(exportedColumn.projectId).toBe(columnData.projectId)
    })

    it('should round-trip Column fields including icon and color', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const columnData = createTestColumn(project.id, {
        icon: 'in-progress',
        color: '#f59e0b',
      })
      await db.column.create({ data: columnData })

      const data = await exportDatabase()
      await cleanupTestData()
      await importDatabase(data)

      const importedColumn = await db.column.findUnique({ where: { id: columnData.id } })

      expect(importedColumn).not.toBeNull()
      expect(importedColumn?.icon).toBe(columnData.icon)
      expect(importedColumn?.color).toBe(columnData.color)
      expect(importedColumn?.name).toBe(columnData.name)
    })
  })

  describe('Ticket Field Completeness', () => {
    it('should export all Ticket fields including resolution', async () => {
      const user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const ticketData = createTestTicket(project.id, column.id, {
        resolution: "Won't Fix",
        assigneeId: user.id,
        creatorId: user.id,
      })
      await db.ticket.create({ data: ticketData })

      const data = await exportDatabase()
      const exportedTicket = data.tickets[0]

      expect(exportedTicket.id).toBe(ticketData.id)
      expect(exportedTicket.number).toBe(ticketData.number)
      expect(exportedTicket.title).toBe(ticketData.title)
      expect(exportedTicket.description).toBe(ticketData.description)
      expect(exportedTicket.type).toBe(ticketData.type)
      expect(exportedTicket.priority).toBe(ticketData.priority)
      expect(exportedTicket.order).toBe(ticketData.order)
      expect(exportedTicket.storyPoints).toBe(ticketData.storyPoints)
      expect(exportedTicket.estimate).toBe(ticketData.estimate)
      expect(exportedTicket.resolution).toBe(ticketData.resolution)
      expect(exportedTicket.environment).toBe(ticketData.environment)
      expect(exportedTicket.affectedVersion).toBe(ticketData.affectedVersion)
      expect(exportedTicket.fixVersion).toBe(ticketData.fixVersion)
      expect(exportedTicket.isCarriedOver).toBe(ticketData.isCarriedOver)
      expect(exportedTicket.carriedOverCount).toBe(ticketData.carriedOverCount)
    })

    it('should round-trip Ticket fields including resolution', async () => {
      const user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const ticketData = createTestTicket(project.id, column.id, {
        resolution: 'Duplicate',
        assigneeId: user.id,
        creatorId: user.id,
      })
      await db.ticket.create({ data: ticketData })

      const data = await exportDatabase()
      await cleanupTestData()
      await importDatabase(data)

      const importedTicket = await db.ticket.findUnique({ where: { id: ticketData.id } })

      expect(importedTicket).not.toBeNull()
      expect(importedTicket?.resolution).toBe(ticketData.resolution)
      expect(importedTicket?.environment).toBe(ticketData.environment)
      expect(importedTicket?.affectedVersion).toBe(ticketData.affectedVersion)
      expect(importedTicket?.fixVersion).toBe(ticketData.fixVersion)
    })
  })

  describe('Relationship Preservation', () => {
    it('should preserve ticket-label many-to-many relationships', async () => {
      const _user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const label1 = await db.label.create({ data: createTestLabel(project.id, { name: 'bug' }) })
      const label2 = await db.label.create({
        data: createTestLabel(project.id, { name: 'feature' }),
      })
      const ticket = await db.ticket.create({
        data: {
          ...createTestTicket(project.id, column.id),
          labels: { connect: [{ id: label1.id }, { id: label2.id }] },
        },
        include: { labels: true },
      })

      const data = await exportDatabase()
      expect(data.tickets[0].labelIds).toContain(label1.id)
      expect(data.tickets[0].labelIds).toContain(label2.id)

      await cleanupTestData()
      await importDatabase(data)

      const importedTicket = await db.ticket.findUnique({
        where: { id: ticket.id },
        include: { labels: true },
      })

      expect(importedTicket?.labels).toHaveLength(2)
      expect(importedTicket?.labels.map((l) => l.id)).toContain(label1.id)
      expect(importedTicket?.labels.map((l) => l.id)).toContain(label2.id)
    })

    it('should preserve ticket-watcher relationships', async () => {
      const user1 = await db.user.create({ data: createTestUser() })
      const user2 = await db.user.create({ data: createTestUser({ username: 'user2' }) })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const ticket = await db.ticket.create({
        data: createTestTicket(project.id, column.id),
      })
      await db.ticketWatcher.create({ data: { ticketId: ticket.id, userId: user1.id } })
      await db.ticketWatcher.create({ data: { ticketId: ticket.id, userId: user2.id } })

      const data = await exportDatabase()
      expect(data.ticketWatchers).toHaveLength(2)

      await cleanupTestData()
      await importDatabase(data)

      const watchers = await db.ticketWatcher.findMany({ where: { ticketId: ticket.id } })
      expect(watchers).toHaveLength(2)
    })

    it('should preserve ticket-link relationships', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const ticket1 = await db.ticket.create({
        data: createTestTicket(project.id, column.id, { number: 1 }),
      })
      const ticket2 = await db.ticket.create({
        data: createTestTicket(project.id, column.id, { number: 2 }),
      })
      await db.ticketLink.create({
        data: {
          fromTicketId: ticket1.id,
          toTicketId: ticket2.id,
          linkType: 'blocks',
        },
      })

      const data = await exportDatabase()
      expect(data.ticketLinks).toHaveLength(1)
      expect(data.ticketLinks[0].linkType).toBe('blocks')

      await cleanupTestData()
      await importDatabase(data)

      const links = await db.ticketLink.findMany()
      expect(links).toHaveLength(1)
      expect(links[0].linkType).toBe('blocks')
      expect(links[0].fromTicketId).toBe(ticket1.id)
      expect(links[0].toTicketId).toBe(ticket2.id)
    })

    it('should preserve project-member-role relationships', async () => {
      const user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })
      const role = await db.role.create({ data: createTestRole(project.id) })
      await db.projectMember.create({
        data: {
          userId: user.id,
          projectId: project.id,
          roleId: role.id,
          overrides: JSON.stringify(['extra.permission']),
        },
      })

      const data = await exportDatabase()
      expect(data.projectMembers).toHaveLength(1)
      expect(data.projectMembers[0].roleId).toBe(role.id)

      await cleanupTestData()
      await importDatabase(data)

      const member = await db.projectMember.findFirst({
        where: { userId: user.id },
        include: { role: true },
      })

      expect(member).not.toBeNull()
      expect(member?.roleId).toBe(role.id)
      expect(member?.role.name).toBe(role.name)
    })

    it('should preserve ticket-sprint relationships', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const sprint = await db.sprint.create({
        data: createTestSprint(project.id),
      })
      const ticket = await db.ticket.create({
        data: {
          ...createTestTicket(project.id, column.id),
          sprintId: sprint.id,
        },
      })

      const data = await exportDatabase()
      expect(data.tickets[0].sprintId).toBe(sprint.id)

      await cleanupTestData()
      await importDatabase(data)

      const importedTicket = await db.ticket.findUnique({
        where: { id: ticket.id },
        include: { sprint: true },
      })

      expect(importedTicket?.sprintId).toBe(sprint.id)
      expect(importedTicket?.sprint?.name).toBe(sprint.name)
    })

    it('should preserve parent-child ticket relationships (subtasks)', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const parentTicket = await db.ticket.create({
        data: createTestTicket(project.id, column.id, { number: 1, type: 'story' }),
      })
      const subtask = await db.ticket.create({
        data: {
          ...createTestTicket(project.id, column.id, { number: 2, type: 'subtask' }),
          parentId: parentTicket.id,
        },
      })

      const data = await exportDatabase()
      const exportedSubtask = data.tickets.find((t) => t.id === subtask.id)
      expect(exportedSubtask?.parentId).toBe(parentTicket.id)

      await cleanupTestData()
      await importDatabase(data)

      const importedSubtask = await db.ticket.findUnique({
        where: { id: subtask.id },
        include: { parent: true },
      })

      expect(importedSubtask?.parentId).toBe(parentTicket.id)
      expect(importedSubtask?.parent?.title).toBe(parentTicket.title)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty database export', async () => {
      const data = await exportDatabase()

      expect(data.users).toHaveLength(0)
      expect(data.projects).toHaveLength(0)
      expect(data.tickets).toHaveLength(0)
      expect(data.systemSettings).toBeNull()

      // Should still be valid schema
      const result = ExportDataSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should handle import into empty database', async () => {
      // Create data
      const _user = await db.user.create({ data: createTestUser() })
      const _project = await db.project.create({ data: createTestProject() })

      const data = await exportDatabase()
      await cleanupTestData()

      // Verify empty
      expect(await db.user.count()).toBe(0)
      expect(await db.project.count()).toBe(0)

      // Import
      const result = await importDatabase(data)

      expect(result.success).toBe(true)
      expect(result.counts.users).toBe(1)
      expect(result.counts.projects).toBe(1)
    })

    it('should handle null/optional fields correctly', async () => {
      const userData = createTestUser({
        avatar: null,
        avatarColor: null,
        email: null,
        lastLoginAt: null,
        passwordChangedAt: null,
        emailVerified: null,
        mcpApiKey: null,
      })
      await db.user.create({ data: userData })

      const data = await exportDatabase()
      const exportedUser = data.users[0]

      expect(exportedUser.avatar).toBeNull()
      expect(exportedUser.avatarColor).toBeNull()
      expect(exportedUser.email).toBeNull()
      expect(exportedUser.lastLoginAt).toBeNull()
      expect(exportedUser.passwordChangedAt).toBeNull()
      expect(exportedUser.emailVerified).toBeNull()
      expect(exportedUser.mcpApiKey).toBeNull()

      await cleanupTestData()
      await importDatabase(data)

      const importedUser = await db.user.findUnique({ where: { id: userData.id } })
      expect(importedUser?.avatar).toBeNull()
      expect(importedUser?.avatarColor).toBeNull()
    })

    it('should handle special characters in text fields', async () => {
      const user = await db.user.create({
        data: createTestUser({
          name: 'Test "User" with <special> & chars \\ / 日本語',
        }),
      })
      const project = await db.project.create({
        data: createTestProject({
          description: 'Description with "quotes" and <html> & symbols\n\ttabs\r\nnewlines',
        }),
      })

      const data = await exportDatabase()
      await cleanupTestData()
      await importDatabase(data)

      const importedUser = await db.user.findUnique({ where: { id: user.id } })
      const importedProject = await db.project.findUnique({ where: { id: project.id } })

      expect(importedUser?.name).toBe(user.name)
      expect(importedProject?.description).toBe(project.description)
    })

    it('should handle large dataset export/import', async () => {
      // Create multiple users, projects, tickets
      // Use null mcpApiKey to avoid unique constraint issues with fast sequential creation
      const _users = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          db.user.create({
            data: createTestUser({
              username: `bulkuser${i}`,
              email: `bulk${i}@test.com`,
              mcpApiKey: null,
            }),
          }),
        ),
      )

      const projects = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          db.project.create({
            data: createTestProject({ key: `BLK${i}`, name: `Bulk Project ${i}` }),
          }),
        ),
      )

      // Create columns and tickets for each project
      for (const project of projects) {
        const column = await db.column.create({
          data: createTestColumn(project.id),
        })
        await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            db.ticket.create({
              data: createTestTicket(project.id, column.id, { number: i + 1 }),
            }),
          ),
        )
      }

      const data = await exportDatabase()

      expect(data.users.length).toBe(10)
      expect(data.projects.length).toBe(5)
      expect(data.tickets.length).toBe(100)

      await cleanupTestData()
      const result = await importDatabase(data)

      expect(result.success).toBe(true)
      expect(result.counts.users).toBe(10)
      expect(result.counts.projects).toBe(5)
      expect(result.counts.tickets).toBe(100)

      // Verify data integrity
      const importedUsers = await db.user.count()
      const importedProjects = await db.project.count()
      const importedTickets = await db.ticket.count()

      expect(importedUsers).toBe(10)
      expect(importedProjects).toBe(5)
      expect(importedTickets).toBe(100)
    })

    it('should handle SystemSettings export/import', async () => {
      await db.systemSettings.upsert({
        where: { id: 'system-settings' },
        create: {
          id: 'system-settings',
          appName: 'Custom PUNT',
          logoLetter: 'C',
          logoGradientFrom: '#ff0000',
          logoGradientTo: '#00ff00',
          maxImageSizeMB: 20,
          maxVideoSizeMB: 200,
          emailEnabled: true,
          emailProvider: 'resend',
        },
        update: {
          appName: 'Custom PUNT',
          logoLetter: 'C',
          logoGradientFrom: '#ff0000',
          logoGradientTo: '#00ff00',
          maxImageSizeMB: 20,
          maxVideoSizeMB: 200,
          emailEnabled: true,
          emailProvider: 'resend',
        },
      })

      const data = await exportDatabase()
      expect(data.systemSettings).not.toBeNull()
      expect(data.systemSettings?.appName).toBe('Custom PUNT')
      expect(data.systemSettings?.emailEnabled).toBe(true)

      await cleanupTestData()
      await importDatabase(data)

      const importedSettings = await db.systemSettings.findUnique({
        where: { id: 'system-settings' },
      })

      expect(importedSettings).not.toBeNull()
      expect(importedSettings?.appName).toBe('Custom PUNT')
      expect(importedSettings?.logoGradientFrom).toBe('#ff0000')
      expect(importedSettings?.emailEnabled).toBe(true)
    })
  })

  describe('Schema Validation', () => {
    it('should validate complete export against ExportDataSchema', async () => {
      // Create comprehensive test data
      const user = await db.user.create({
        data: createTestUser({ avatarColor: '#abc123', mcpApiKey: 'test_key' }),
      })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({
        data: createTestColumn(project.id, { icon: 'star', color: '#gold' }),
      })
      const role = await db.role.create({ data: createTestRole(project.id) })
      const sprint = await db.sprint.create({ data: createTestSprint(project.id) })
      const label = await db.label.create({ data: createTestLabel(project.id) })
      await db.projectMember.create({
        data: { userId: user.id, projectId: project.id, roleId: role.id },
      })
      await db.ticket.create({
        data: {
          ...createTestTicket(project.id, column.id, {
            resolution: 'Done',
            sprintId: sprint.id,
          }),
          labels: { connect: [{ id: label.id }] },
        },
      })

      const data = await exportDatabase()
      const result = ExportDataSchema.safeParse(data)

      expect(result.success).toBe(true)
      if (!result.success) {
        console.error('Schema validation errors:', result.error.issues)
      }
    })

    it('should include all new fields in schema validation', async () => {
      const _user = await db.user.create({
        data: createTestUser({
          avatarColor: '#ff5733',
          mcpApiKey: 'mcp_validation_test',
        }),
      })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({
        data: createTestColumn(project.id, {
          icon: 'check',
          color: '#22c55e',
        }),
      })
      await db.ticket.create({
        data: createTestTicket(project.id, column.id, {
          resolution: 'Cannot Reproduce',
        }),
      })

      const data = await exportDatabase()

      // Validate specific fields exist and are correct types
      expect(data.users[0]).toHaveProperty('avatarColor')
      expect(data.users[0]).toHaveProperty('mcpApiKey')
      expect(data.columns[0]).toHaveProperty('icon')
      expect(data.columns[0]).toHaveProperty('color')
      expect(data.tickets[0]).toHaveProperty('resolution')

      // Full schema validation
      const result = ExportDataSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('Data Integrity', () => {
    it('should preserve exact field values through round-trip', async () => {
      const exactDate = new Date('2024-06-15T10:30:00.000Z')
      const user = await db.user.create({
        data: createTestUser({
          createdAt: exactDate,
          updatedAt: exactDate,
          lastLoginAt: exactDate,
          avatarColor: '#AABBCC',
          mcpApiKey: 'exact_key_test_123',
        }),
      })

      const project = await db.project.create({
        data: createTestProject({
          createdAt: exactDate,
          color: '#112233',
        }),
      })

      const column = await db.column.create({
        data: createTestColumn(project.id, {
          icon: 'exact-icon',
          color: '#445566',
          order: 42,
        }),
      })

      const ticket = await db.ticket.create({
        data: createTestTicket(project.id, column.id, {
          storyPoints: 13,
          estimate: '3w 2d',
          resolution: 'Incomplete',
          environment: 'Staging',
          affectedVersion: '2.0.0-beta.1',
          fixVersion: '2.0.0',
          carriedOverCount: 5,
        }),
      })

      const data = await exportDatabase()
      await cleanupTestData()
      await importDatabase(data)

      // Verify user
      const importedUser = await db.user.findUnique({ where: { id: user.id } })
      expect(importedUser?.avatarColor).toBe('#AABBCC')
      expect(importedUser?.mcpApiKey).toBe('exact_key_test_123')
      expect(importedUser?.lastLoginAt?.toISOString()).toBe(exactDate.toISOString())

      // Verify project
      const importedProject = await db.project.findUnique({ where: { id: project.id } })
      expect(importedProject?.color).toBe('#112233')

      // Verify column
      const importedColumn = await db.column.findUnique({ where: { id: column.id } })
      expect(importedColumn?.icon).toBe('exact-icon')
      expect(importedColumn?.color).toBe('#445566')
      expect(importedColumn?.order).toBe(42)

      // Verify ticket
      const importedTicket = await db.ticket.findUnique({ where: { id: ticket.id } })
      expect(importedTicket?.storyPoints).toBe(13)
      expect(importedTicket?.estimate).toBe('3w 2d')
      expect(importedTicket?.resolution).toBe('Incomplete')
      expect(importedTicket?.environment).toBe('Staging')
      expect(importedTicket?.affectedVersion).toBe('2.0.0-beta.1')
      expect(importedTicket?.fixVersion).toBe('2.0.0')
      expect(importedTicket?.carriedOverCount).toBe(5)
    })

    it('should preserve ticket sprint history', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const sprint1 = await db.sprint.create({
        data: createTestSprint(project.id, { name: 'Sprint 1' }),
      })
      const sprint2 = await db.sprint.create({
        data: createTestSprint(project.id, { name: 'Sprint 2' }),
      })
      const ticket = await db.ticket.create({
        data: createTestTicket(project.id, column.id, { sprintId: sprint2.id }),
      })

      // Create sprint history
      await db.ticketSprintHistory.create({
        data: {
          ticketId: ticket.id,
          sprintId: sprint1.id,
          entryType: 'added',
          exitStatus: 'carried_over',
          removedAt: new Date(),
        },
      })

      const data = await exportDatabase()
      expect(data.ticketSprintHistory).toHaveLength(1)
      expect(data.ticketSprintHistory[0].entryType).toBe('added')
      expect(data.ticketSprintHistory[0].exitStatus).toBe('carried_over')

      await cleanupTestData()
      await importDatabase(data)

      const history = await db.ticketSprintHistory.findMany()
      expect(history).toHaveLength(1)
      expect(history[0].entryType).toBe('added')
      expect(history[0].exitStatus).toBe('carried_over')
    })

    it('should preserve comments and ticket edits', async () => {
      const user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const ticket = await db.ticket.create({
        data: createTestTicket(project.id, column.id),
      })

      await db.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          content: 'This is a **markdown** comment',
        },
      })

      await db.ticketEdit.create({
        data: {
          ticketId: ticket.id,
          userId: user.id,
          field: 'priority',
          oldValue: 'low',
          newValue: 'high',
        },
      })

      const data = await exportDatabase()
      expect(data.comments).toHaveLength(1)
      expect(data.ticketEdits).toHaveLength(1)

      await cleanupTestData()
      await importDatabase(data)

      const comments = await db.comment.findMany()
      const edits = await db.ticketEdit.findMany()

      expect(comments).toHaveLength(1)
      expect(comments[0].content).toBe('This is a **markdown** comment')
      expect(edits).toHaveLength(1)
      expect(edits[0].field).toBe('priority')
      expect(edits[0].oldValue).toBe('low')
      expect(edits[0].newValue).toBe('high')
    })

    it('should preserve attachments metadata', async () => {
      const user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({ data: createTestColumn(project.id) })
      const ticket = await db.ticket.create({
        data: createTestTicket(project.id, column.id),
      })

      await db.attachment.create({
        data: {
          ticketId: ticket.id,
          uploaderId: user.id,
          filename: 'test-file.pdf',
          mimeType: 'application/pdf',
          size: 1024000,
          url: '/uploads/attachments/test-file.pdf',
        },
      })

      const data = await exportDatabase()
      expect(data.attachments).toHaveLength(1)
      expect(data.attachments[0].filename).toBe('test-file.pdf')
      expect(data.attachments[0].uploaderId).toBe(user.id)

      await cleanupTestData()
      await importDatabase(data)

      const attachments = await db.attachment.findMany()
      expect(attachments).toHaveLength(1)
      expect(attachments[0].filename).toBe('test-file.pdf')
      expect(attachments[0].mimeType).toBe('application/pdf')
      expect(attachments[0].size).toBe(1024000)
      expect(attachments[0].uploaderId).toBe(user.id)
    })

    it('should preserve invitations', async () => {
      const user = await db.user.create({ data: createTestUser() })
      const project = await db.project.create({ data: createTestProject() })

      await db.invitation.create({
        data: {
          email: 'invited@example.com',
          role: 'admin',
          token: 'test_invitation_token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
          senderId: user.id,
          projectId: project.id,
        },
      })

      const data = await exportDatabase()
      expect(data.invitations).toHaveLength(1)
      expect(data.invitations[0].email).toBe('invited@example.com')
      expect(data.invitations[0].role).toBe('admin')

      await cleanupTestData()
      await importDatabase(data)

      const invitations = await db.invitation.findMany()
      expect(invitations).toHaveLength(1)
      expect(invitations[0].email).toBe('invited@example.com')
      expect(invitations[0].status).toBe('pending')
    })

    it('should preserve project sprint settings', async () => {
      const project = await db.project.create({ data: createTestProject() })
      const column = await db.column.create({
        data: createTestColumn(project.id, { name: 'Done' }),
      })

      await db.projectSprintSettings.create({
        data: {
          projectId: project.id,
          defaultSprintDuration: 21,
          autoCarryOverIncomplete: false,
          doneColumnIds: JSON.stringify([column.id]),
        },
      })

      const data = await exportDatabase()
      expect(data.projectSprintSettings).toHaveLength(1)
      expect(data.projectSprintSettings[0].defaultSprintDuration).toBe(21)
      expect(data.projectSprintSettings[0].autoCarryOverIncomplete).toBe(false)

      await cleanupTestData()
      await importDatabase(data)

      const settings = await db.projectSprintSettings.findUnique({
        where: { projectId: project.id },
      })
      expect(settings).not.toBeNull()
      expect(settings?.defaultSprintDuration).toBe(21)
      expect(settings?.autoCarryOverIncomplete).toBe(false)
      expect(JSON.parse(settings?.doneColumnIds)).toContain(column.id)
    })
  })
})
