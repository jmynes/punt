/**
 * Integration tests for database backup/restore functionality
 *
 * Tests export, import, and wipe operations with various configurations:
 * - With/without encryption
 * - With/without attachments
 * - ZIP vs JSON formats
 * - Error handling
 */

import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decrypt, encrypt } from '@/lib/crypto'
import {
  createDatabaseExport,
  createDatabaseExportZip,
  createEncryptedDatabaseExport,
  exportDatabase,
  generateExportFilename,
} from '@/lib/database-export'
import {
  importDatabase,
  isExportEncrypted,
  isZipFile,
  parseExportFile,
} from '@/lib/database-import'
import { db } from '@/lib/db'
import {
  AnyDatabaseExportSchema,
  DatabaseExportSchema,
  EncryptedDatabaseExportSchema,
  EXPORT_VERSION,
  ExportDataSchema,
} from '@/lib/schemas/database-export'

// Test data
const TEST_USER = {
  id: 'test-user-1',
  username: 'testuser',
  usernameLower: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  avatar: null,
  passwordHash: '$2a$12$testhashedpassword',
  passwordChangedAt: null,
  emailVerified: null,
  isSystemAdmin: true,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEST_PROJECT = {
  id: 'test-project-1',
  name: 'Test Project',
  key: 'TEST',
  description: 'A test project',
  color: '#3b82f6',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEST_COLUMN = {
  id: 'test-column-1',
  name: 'To Do',
  order: 0,
  projectId: 'test-project-1',
}

const TEST_LABEL = {
  id: 'test-label-1',
  name: 'bug',
  color: '#ef4444',
  projectId: 'test-project-1',
}

const TEST_ROLE = {
  id: 'test-role-1',
  name: 'Owner',
  color: '#3b82f6',
  description: 'Project owner',
  permissions: '{"all": true}',
  isDefault: false,
  position: 0,
  projectId: 'test-project-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEST_PROJECT_MEMBER = {
  id: 'test-member-1',
  roleId: 'test-role-1',
  overrides: null,
  userId: 'test-user-1',
  projectId: 'test-project-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEST_TICKET = {
  id: 'test-ticket-1',
  number: 1,
  title: 'Test Ticket',
  description: 'Test description',
  type: 'task',
  priority: 'medium',
  order: 0,
  storyPoints: 3,
  estimate: null,
  startDate: null,
  dueDate: null,
  environment: null,
  affectedVersion: null,
  fixVersion: null,
  projectId: 'test-project-1',
  columnId: 'test-column-1',
  assigneeId: 'test-user-1',
  creatorId: 'test-user-1',
  sprintId: null,
  isCarriedOver: false,
  carriedFromSprintId: null,
  carriedOverCount: 0,
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// Helper to clean up test data
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
}

// Helper to seed test data
async function seedTestData() {
  await db.user.create({ data: TEST_USER })
  await db.project.create({ data: TEST_PROJECT })
  await db.column.create({ data: TEST_COLUMN })
  await db.label.create({ data: TEST_LABEL })
  await db.role.create({ data: TEST_ROLE })
  await db.projectMember.create({ data: TEST_PROJECT_MEMBER })
  await db.ticket.create({
    data: {
      ...TEST_TICKET,
      labels: { connect: [{ id: TEST_LABEL.id }] },
    },
  })
}

describe('Database Backup/Restore', () => {
  beforeEach(async () => {
    await cleanupTestData()
    await seedTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Export Functions', () => {
    describe('exportDatabase', () => {
      it('should export all data in correct format', async () => {
        const data = await exportDatabase()

        expect(data.users).toHaveLength(1)
        expect(data.users[0].id).toBe(TEST_USER.id)
        expect(data.users[0].username).toBe(TEST_USER.username)

        expect(data.projects).toHaveLength(1)
        expect(data.projects[0].id).toBe(TEST_PROJECT.id)

        expect(data.columns).toHaveLength(1)
        expect(data.labels).toHaveLength(1)
        expect(data.roles).toHaveLength(1)
        expect(data.projectMembers).toHaveLength(1)

        expect(data.tickets).toHaveLength(1)
        expect(data.tickets[0].labelIds).toContain(TEST_LABEL.id)
      })

      it('should convert dates to ISO strings', async () => {
        const data = await exportDatabase()

        expect(typeof data.users[0].createdAt).toBe('string')
        expect(typeof data.projects[0].createdAt).toBe('string')
        expect(typeof data.tickets[0].createdAt).toBe('string')

        // Verify they're valid ISO dates
        expect(new Date(data.users[0].createdAt).toISOString()).toBe(data.users[0].createdAt)
      })

      it('should validate against ExportDataSchema', async () => {
        const data = await exportDatabase()
        const result = ExportDataSchema.safeParse(data)

        expect(result.success).toBe(true)
      })
    })

    describe('createDatabaseExport', () => {
      it('should create unencrypted export with metadata', async () => {
        const exportFile = await createDatabaseExport('test-user-1')

        expect(exportFile.version).toBe(EXPORT_VERSION)
        expect(exportFile.exportedBy).toBe('test-user-1')
        expect(exportFile.encrypted).toBe(false)
        expect(exportFile.data).toBeDefined()
        expect(exportFile.data.users).toHaveLength(1)
      })

      it('should validate against DatabaseExportSchema', async () => {
        const exportFile = await createDatabaseExport('test-user-1')
        const result = DatabaseExportSchema.safeParse(exportFile)

        expect(result.success).toBe(true)
      })
    })

    describe('createEncryptedDatabaseExport', () => {
      it('should create encrypted export', async () => {
        const password = 'TestPassword123!'
        const exportFile = await createEncryptedDatabaseExport('test-user-1', password)

        expect(exportFile.version).toBe(EXPORT_VERSION)
        expect(exportFile.exportedBy).toBe('test-user-1')
        expect(exportFile.encrypted).toBe(true)
        expect(exportFile.ciphertext).toBeDefined()
        expect(exportFile.salt).toBeDefined()
        expect(exportFile.iv).toBeDefined()
        expect(exportFile.authTag).toBeDefined()
        expect('data' in exportFile).toBe(false)
      })

      it('should be decryptable with correct password', async () => {
        const password = 'TestPassword123!'
        const exportFile = await createEncryptedDatabaseExport('test-user-1', password)

        const decrypted = decrypt(
          {
            ciphertext: exportFile.ciphertext,
            salt: exportFile.salt,
            iv: exportFile.iv,
            authTag: exportFile.authTag,
          },
          password,
        )

        const data = JSON.parse(decrypted)
        expect(data.users).toHaveLength(1)
        expect(data.users[0].id).toBe(TEST_USER.id)
      })

      it('should fail decryption with wrong password', async () => {
        const password = 'TestPassword123!'
        const exportFile = await createEncryptedDatabaseExport('test-user-1', password)

        expect(() =>
          decrypt(
            {
              ciphertext: exportFile.ciphertext,
              salt: exportFile.salt,
              iv: exportFile.iv,
              authTag: exportFile.authTag,
            },
            'WrongPassword456!',
          ),
        ).toThrow()
      })

      it('should validate against EncryptedDatabaseExportSchema', async () => {
        const exportFile = await createEncryptedDatabaseExport('test-user-1', 'TestPassword123!')
        const result = EncryptedDatabaseExportSchema.safeParse(exportFile)

        expect(result.success).toBe(true)
      })
    })

    describe('createDatabaseExportZip', () => {
      it('should create ZIP with backup.json', async () => {
        const { buffer } = await createDatabaseExportZip('test-user-1')

        expect(buffer.length).toBeGreaterThan(0)

        // Write to temp file
        const tempDir = join(process.cwd(), 'temp-test-dir')
        const tempPath = join(process.cwd(), 'temp-test.zip')
        const { writeFileSync, readFileSync, mkdirSync, rmSync } = await import('node:fs')
        const { execSync } = await import('node:child_process')

        writeFileSync(tempPath, buffer)

        // Use system unzip to extract (works around adm-zip issue in vitest)
        mkdirSync(tempDir, { recursive: true })
        execSync(`unzip -o "${tempPath}" -d "${tempDir}"`)

        // Read the extracted file
        const text = readFileSync(join(tempDir, 'backup.json'), 'utf8')

        // Cleanup
        rmSync(tempDir, { recursive: true, force: true })
        rmSync(tempPath, { force: true })

        expect(text.length).toBeGreaterThan(0)
        const backupJson = JSON.parse(text)
        expect(backupJson.version).toBe(EXPORT_VERSION)
        expect(backupJson.data.users).toHaveLength(1)
      })

      it('should create encrypted ZIP when password provided', async () => {
        const password = 'TestPassword123!'
        const { buffer } = await createDatabaseExportZip('test-user-1', { password })

        // Write to temp file and extract with system unzip
        const tempDir = join(process.cwd(), 'temp-enc-test-dir')
        const tempPath = join(process.cwd(), 'temp-enc-test.zip')
        const { writeFileSync, readFileSync, mkdirSync, rmSync } = await import('node:fs')
        const { execSync } = await import('node:child_process')

        writeFileSync(tempPath, buffer)
        mkdirSync(tempDir, { recursive: true })
        execSync(`unzip -o "${tempPath}" -d "${tempDir}"`)

        const text = readFileSync(join(tempDir, 'backup.json'), 'utf8')
        const backupJson = JSON.parse(text)

        // Cleanup
        rmSync(tempDir, { recursive: true, force: true })
        rmSync(tempPath, { force: true })

        expect(backupJson.encrypted).toBe(true)
        expect(backupJson.ciphertext).toBeDefined()
      })
    })

    describe('generateExportFilename', () => {
      it('should generate .json filename when no files included', () => {
        const filename = generateExportFilename(false)
        expect(filename).toMatch(/^punt-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/)
      })

      it('should generate .zip filename when files included', () => {
        const filename = generateExportFilename(true)
        expect(filename).toMatch(/^punt-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/)
      })
    })
  })

  describe('Import Functions', () => {
    describe('isZipFile', () => {
      it('should detect ZIP files by magic bytes', () => {
        // ZIP magic bytes: 50 4B 03 04
        const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
        expect(isZipFile(zipBuffer)).toBe(true)
      })

      it('should reject non-ZIP files', () => {
        const jsonBuffer = Buffer.from('{"test": true}')
        expect(isZipFile(jsonBuffer)).toBe(false)
      })

      it('should handle short buffers', () => {
        const shortBuffer = Buffer.from([0x50, 0x4b])
        expect(isZipFile(shortBuffer)).toBe(false)
      })
    })

    describe('isExportEncrypted', () => {
      it('should detect encrypted exports', async () => {
        const exportFile = await createEncryptedDatabaseExport('test-user-1', 'TestPassword123!')
        const content = JSON.stringify(exportFile)

        expect(isExportEncrypted(content)).toBe(true)
      })

      it('should detect unencrypted exports', async () => {
        const exportFile = await createDatabaseExport('test-user-1')
        const content = JSON.stringify(exportFile)

        expect(isExportEncrypted(content)).toBe(false)
      })

      it('should handle invalid JSON', () => {
        expect(isExportEncrypted('not valid json')).toBe(false)
      })
    })

    describe('parseExportFile', () => {
      it('should parse unencrypted JSON export', async () => {
        const exportFile = await createDatabaseExport('test-user-1')
        const content = JSON.stringify(exportFile)

        const result = await parseExportFile(content)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.isZip).toBe(false)
          expect(result.data.users).toHaveLength(1)
        }
      })

      it('should parse encrypted JSON export with password', async () => {
        const password = 'TestPassword123!'
        const exportFile = await createEncryptedDatabaseExport('test-user-1', password)
        const content = JSON.stringify(exportFile)

        const result = await parseExportFile(content, password)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.users).toHaveLength(1)
        }
      })

      it('should fail to parse encrypted export without password', async () => {
        const exportFile = await createEncryptedDatabaseExport('test-user-1', 'TestPassword123!')
        const content = JSON.stringify(exportFile)

        const result = await parseExportFile(content)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toContain('encrypted')
        }
      })

      it('should fail to parse encrypted export with wrong password', async () => {
        const exportFile = await createEncryptedDatabaseExport('test-user-1', 'TestPassword123!')
        const content = JSON.stringify(exportFile)

        const result = await parseExportFile(content, 'WrongPassword!')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toContain('password')
        }
      })

      it('should parse ZIP export', async () => {
        const { buffer } = await createDatabaseExportZip('test-user-1')

        const result = await parseExportFile(buffer)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.isZip).toBe(true)
          expect(result.zipBuffer).toBeDefined()
          expect(result.data.users).toHaveLength(1)
        }
      })

      it('should fail on invalid JSON', async () => {
        const result = await parseExportFile('not valid json')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toContain('Invalid')
        }
      })

      it('should fail on invalid export structure', async () => {
        const result = await parseExportFile('{"foo": "bar"}')

        expect(result.success).toBe(false)
      })
    })

    describe('importDatabase', () => {
      it('should import data successfully', async () => {
        // Export current data
        const data = await exportDatabase()

        // Clear database
        await cleanupTestData()

        // Verify empty
        const usersBeforeImport = await db.user.count()
        expect(usersBeforeImport).toBe(0)

        // Import
        const result = await importDatabase(data)

        expect(result.success).toBe(true)
        expect(result.counts.users).toBe(1)
        expect(result.counts.projects).toBe(1)
        expect(result.counts.tickets).toBe(1)

        // Verify data restored
        const users = await db.user.findMany()
        expect(users).toHaveLength(1)
        expect(users[0].id).toBe(TEST_USER.id)
        expect(users[0].username).toBe(TEST_USER.username)

        const projects = await db.project.findMany()
        expect(projects).toHaveLength(1)
        expect(projects[0].id).toBe(TEST_PROJECT.id)
      })

      it('should restore ticket-label relationships', async () => {
        const data = await exportDatabase()
        await cleanupTestData()

        await importDatabase(data)

        const ticket = await db.ticket.findUnique({
          where: { id: TEST_TICKET.id },
          include: { labels: true },
        })

        expect(ticket?.labels).toHaveLength(1)
        expect(ticket?.labels[0].id).toBe(TEST_LABEL.id)
      })

      it('should wipe existing data before import', async () => {
        // Create additional user
        await db.user.create({
          data: {
            id: 'extra-user',
            username: 'extrauser',
            name: 'Extra User',
            isSystemAdmin: false,
            isActive: true,
          },
        })

        const usersBefore = await db.user.count()
        expect(usersBefore).toBe(2)

        // Export (only contains original user)
        const data = await exportDatabase()
        // Manually filter to just the original test user for this test
        data.users = data.users.filter((u) => u.id === TEST_USER.id)

        await importDatabase(data)

        // Should only have imported user, extra user wiped
        const usersAfter = await db.user.count()
        expect(usersAfter).toBe(1)
      })
    })
  })

  describe('Full Round-Trip Tests', () => {
    it('should round-trip unencrypted JSON export/import', async () => {
      const exportFile = await createDatabaseExport('test-user-1')
      const content = JSON.stringify(exportFile)

      await cleanupTestData()

      const parseResult = await parseExportFile(content)
      expect(parseResult.success).toBe(true)

      if (parseResult.success) {
        const importResult = await importDatabase(parseResult.data)
        expect(importResult.success).toBe(true)

        const users = await db.user.findMany()
        expect(users).toHaveLength(1)
        expect(users[0].username).toBe(TEST_USER.username)
      }
    })

    it('should round-trip encrypted JSON export/import', async () => {
      const password = 'SecurePassword123!'
      const exportFile = await createEncryptedDatabaseExport('test-user-1', password)
      const content = JSON.stringify(exportFile)

      await cleanupTestData()

      const parseResult = await parseExportFile(content, password)
      expect(parseResult.success).toBe(true)

      if (parseResult.success) {
        const importResult = await importDatabase(parseResult.data)
        expect(importResult.success).toBe(true)

        const users = await db.user.findMany()
        expect(users).toHaveLength(1)
        expect(users[0].passwordHash).toBe(TEST_USER.passwordHash)
      }
    })

    it('should round-trip ZIP export/import', async () => {
      const { buffer } = await createDatabaseExportZip('test-user-1')

      await cleanupTestData()

      const parseResult = await parseExportFile(buffer)
      expect(parseResult.success).toBe(true)

      if (parseResult.success) {
        const importResult = await importDatabase(parseResult.data)
        expect(importResult.success).toBe(true)

        const projects = await db.project.findMany()
        expect(projects).toHaveLength(1)
        expect(projects[0].key).toBe(TEST_PROJECT.key)
      }
    })

    it('should round-trip encrypted ZIP export/import', async () => {
      const password = 'SecurePassword123!'
      const { buffer } = await createDatabaseExportZip('test-user-1', { password })

      await cleanupTestData()

      const parseResult = await parseExportFile(buffer, password)
      expect(parseResult.success).toBe(true)

      if (parseResult.success) {
        const importResult = await importDatabase(parseResult.data)
        expect(importResult.success).toBe(true)

        const tickets = await db.ticket.findMany()
        expect(tickets).toHaveLength(1)
        expect(tickets[0].title).toBe(TEST_TICKET.title)
      }
    })
  })

  describe('Crypto Functions', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'Hello, World! This is a test message.'
      const password = 'TestPassword123!'

      const encrypted = encrypt(plaintext, password)
      const decrypted = decrypt(encrypted, password)

      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Same message'
      const password = 'TestPassword123!'

      const encrypted1 = encrypt(plaintext, password)
      const encrypted2 = encrypt(plaintext, password)

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
    })

    it('should handle large data', () => {
      const largeData = JSON.stringify({ data: 'x'.repeat(1_000_000) })
      const password = 'TestPassword123!'

      const encrypted = encrypt(largeData, password)
      const decrypted = decrypt(encrypted, password)

      expect(decrypted).toBe(largeData)
    })

    it('should handle special characters in password', () => {
      const plaintext = 'Test data'
      const password = 'P@$$w0rd!#%^&*()中文🔐'

      const encrypted = encrypt(plaintext, password)
      const decrypted = decrypt(encrypted, password)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('Schema Validation', () => {
    it('should validate complete export against AnyDatabaseExportSchema', async () => {
      const unencrypted = await createDatabaseExport('test-user-1')
      const encrypted = await createEncryptedDatabaseExport('test-user-1', 'TestPassword123!')

      expect(AnyDatabaseExportSchema.safeParse(unencrypted).success).toBe(true)
      expect(AnyDatabaseExportSchema.safeParse(encrypted).success).toBe(true)
    })

    it('should reject invalid export structures', () => {
      const invalid = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'user',
        encrypted: false,
        // Missing data field
      }

      expect(DatabaseExportSchema.safeParse(invalid).success).toBe(false)
    })
  })

  describe('Wipe Projects (Keep Users)', () => {
    it('should delete all projects while keeping users', async () => {
      // Verify initial state
      const usersBefore = await db.user.findMany()
      const projectsBefore = await db.project.findMany()
      const ticketsBefore = await db.ticket.findMany()

      expect(usersBefore).toHaveLength(1)
      expect(projectsBefore).toHaveLength(1)
      expect(ticketsBefore).toHaveLength(1)

      // Wipe projects (simulating what the API does)
      await db.$transaction(async (tx) => {
        await tx.ticketSprintHistory.deleteMany()
        await tx.attachment.deleteMany()
        await tx.ticketEdit.deleteMany()
        await tx.comment.deleteMany()
        await tx.ticketWatcher.deleteMany()
        await tx.ticketLink.deleteMany()
        await tx.ticket.deleteMany()
        await tx.projectSprintSettings.deleteMany()
        await tx.projectMember.deleteMany()
        await tx.sprint.deleteMany()
        await tx.label.deleteMany()
        await tx.column.deleteMany()
        await tx.role.deleteMany()
        await tx.invitation.deleteMany()
        await tx.project.deleteMany()
      })

      // Verify projects are deleted
      const projectsAfter = await db.project.findMany()
      const ticketsAfter = await db.ticket.findMany()
      const labelsAfter = await db.label.findMany()
      const columnsAfter = await db.column.findMany()

      expect(projectsAfter).toHaveLength(0)
      expect(ticketsAfter).toHaveLength(0)
      expect(labelsAfter).toHaveLength(0)
      expect(columnsAfter).toHaveLength(0)

      // Verify users are preserved
      const usersAfter = await db.user.findMany()
      expect(usersAfter).toHaveLength(1)
      expect(usersAfter[0].id).toBe(TEST_USER.id)
      expect(usersAfter[0].username).toBe(TEST_USER.username)
      expect(usersAfter[0].isSystemAdmin).toBe(TEST_USER.isSystemAdmin)
    })
  })
})
