/**
 * Database import utilities
 *
 * Imports data from a database export, wiping existing data first.
 * All operations run in a transaction for atomicity.
 * Supports ZIP archives with files and plain JSON.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import JSZip from 'jszip'
import { decrypt } from '@/lib/crypto'
import { db } from '@/lib/db'
import {
  type AnyDatabaseExport,
  AnyDatabaseExportSchema,
  type DatabaseExport,
  type EncryptedDatabaseExport,
  EXPORT_VERSION,
  type ExportData,
  ExportDataSchema,
  type ExportOptionsType,
} from '@/lib/schemas/database-export'

export interface ImportResult {
  success: boolean
  counts: {
    users: number
    projects: number
    roles: number
    columns: number
    labels: number
    sprints: number
    projectMembers: number
    projectSprintSettings: number
    tickets: number
    ticketLinks: number
    ticketWatchers: number
    comments: number
    ticketEdits: number
    ticketActivities: number
    attachments: number
    ticketSprintHistory: number
    invitations: number
  }
  files: {
    attachmentsRestored: number
    attachmentsMissing: number
    avatarsRestored: number
    avatarsMissing: number
    missingFiles: string[]
  }
}

export interface ImportError {
  success: false
  error: string
}

interface ParsedBackup {
  data: ExportData
  options?: ExportOptionsType
  exportedAt: string
}

/**
 * Extracts and parses backup.json from a ZIP buffer
 */
async function extractBackupJsonFromZip(
  zipBuffer: Buffer,
  password?: string,
): Promise<{ success: true; parsed: ParsedBackup } | ImportError> {
  const zip = await JSZip.loadAsync(zipBuffer)
  const backupEntry = zip.file('backup.json')

  if (!backupEntry) {
    return { success: false, error: 'backup.json not found in ZIP archive' }
  }

  const backupJson = await backupEntry.async('string')

  return parseBackupJson(backupJson, password)
}

// Maximum size for backup JSON to prevent memory exhaustion attacks
// 500MB should be plenty for most backups while preventing DoS
const MAX_BACKUP_JSON_SIZE = 500 * 1024 * 1024

/**
 * Parses and validates backup JSON content
 */
function parseBackupJson(
  content: string,
  password?: string,
): { success: true; parsed: ParsedBackup } | ImportError {
  // Security: Prevent memory exhaustion from oversized JSON
  if (content.length > MAX_BACKUP_JSON_SIZE) {
    return { success: false, error: 'Backup file too large (max 500MB)' }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    return { success: false, error: 'Invalid JSON format' }
  }

  // Validate basic structure
  const result = AnyDatabaseExportSchema.safeParse(parsed)
  if (!result.success) {
    return { success: false, error: 'Invalid export file structure' }
  }

  const exportFile = result.data as AnyDatabaseExport

  // Check version compatibility
  const COMPATIBLE_VERSIONS = ['1.0.0', EXPORT_VERSION]
  if (!COMPATIBLE_VERSIONS.includes(exportFile.version)) {
    return {
      success: false,
      error: `Incompatible export version: ${exportFile.version}. Expected one of: ${COMPATIBLE_VERSIONS.join(', ')}`,
    }
  }

  // Handle encrypted exports
  if (exportFile.encrypted) {
    if (!password) {
      return { success: false, error: 'This backup is encrypted. Please provide the password.' }
    }

    const encrypted = exportFile as EncryptedDatabaseExport

    let decryptedJson: string
    try {
      decryptedJson = decrypt(
        {
          ciphertext: encrypted.ciphertext,
          salt: encrypted.salt,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
        password,
      )
    } catch {
      return { success: false, error: 'Incorrect password or corrupted data' }
    }

    let decryptedData: unknown
    try {
      decryptedData = JSON.parse(decryptedJson)
    } catch {
      return { success: false, error: 'Decrypted data is not valid JSON' }
    }

    // Validate decrypted data
    const dataResult = ExportDataSchema.safeParse(decryptedData)
    if (!dataResult.success) {
      return { success: false, error: 'Decrypted data has invalid structure' }
    }

    return {
      success: true,
      parsed: {
        data: dataResult.data,
        options: encrypted.options,
        exportedAt: encrypted.exportedAt,
      },
    }
  }

  // Non-encrypted export
  const unencrypted = exportFile as DatabaseExport
  return {
    success: true,
    parsed: {
      data: unencrypted.data,
      options: unencrypted.options,
      exportedAt: unencrypted.exportedAt,
    },
  }
}

/**
 * Determines if content is a ZIP file (by magic bytes)
 */
export function isZipFile(buffer: Buffer): boolean {
  // ZIP magic bytes: 50 4B 03 04
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  )
}

/**
 * Parses the export file content (ZIP or JSON)
 */
export async function parseExportFile(
  content: string | Buffer,
  password?: string,
): Promise<
  | {
      success: true
      data: ExportData
      options?: ExportOptionsType
      exportedAt: string
      isZip: boolean
      zipBuffer?: Buffer
    }
  | ImportError
> {
  // Convert string to buffer if needed
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content

  // Check if it's a ZIP file
  if (isZipFile(buffer)) {
    const result = await extractBackupJsonFromZip(buffer, password)
    if (!result.success) return result
    return {
      success: true,
      data: result.parsed.data,
      options: result.parsed.options,
      exportedAt: result.parsed.exportedAt,
      isZip: true,
      zipBuffer: buffer,
    }
  }

  // Plain JSON
  const jsonContent = typeof content === 'string' ? content : content.toString('utf8')
  const result = parseBackupJson(jsonContent, password)
  if (!result.success) return result
  return {
    success: true,
    data: result.parsed.data,
    options: result.parsed.options,
    exportedAt: result.parsed.exportedAt,
    isZip: false,
  }
}

/**
 * Checks if an export file is encrypted
 */
export function isExportEncrypted(content: string | Buffer): boolean {
  try {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content

    // For ZIP files, we'd need to extract and check - return false for now
    // The UI will detect encryption after parsing
    if (isZipFile(buffer)) {
      return false // Will be detected during actual parsing
    }

    const parsed = JSON.parse(buffer.toString('utf8'))
    return parsed?.encrypted === true
  } catch {
    return false
  }
}

/**
 * Restores files from a ZIP archive to the filesystem
 */
async function restoreFilesFromZip(
  zipBuffer: Buffer,
  data: ExportData,
  options?: ExportOptionsType,
): Promise<{
  attachmentsRestored: number
  attachmentsMissing: number
  avatarsRestored: number
  avatarsMissing: number
  missingFiles: string[]
}> {
  const result = {
    attachmentsRestored: 0,
    attachmentsMissing: 0,
    avatarsRestored: 0,
    avatarsMissing: 0,
    missingFiles: [] as string[],
  }

  const zip = await JSZip.loadAsync(zipBuffer)
  const fileMap = new Map<string, JSZip.JSZipObject>()

  // Build map of files in the ZIP
  zip.forEach((relativePath, file) => {
    if (relativePath.startsWith('files/') && !file.dir) {
      // Map to URL path (files/uploads/foo.jpg -> /uploads/foo.jpg)
      const urlPath = relativePath.replace(/^files/, '')
      fileMap.set(urlPath, file)
    }
  })

  // Restore attachment files
  if (options?.includeAttachments) {
    for (const attachment of data.attachments) {
      if (attachment.url) {
        const zipFile = fileMap.get(attachment.url)
        if (zipFile) {
          try {
            const fileBuffer = await zipFile.async('nodebuffer')
            const destPath = join(process.cwd(), 'public', attachment.url.slice(1))
            await mkdir(dirname(destPath), { recursive: true })
            await writeFile(destPath, fileBuffer)
            result.attachmentsRestored++
          } catch (_err) {
            result.attachmentsMissing++
            result.missingFiles.push(attachment.url)
          }
        } else {
          result.attachmentsMissing++
          result.missingFiles.push(attachment.url)
        }
      }
    }
  }

  // Restore avatar files
  if (options?.includeAvatars) {
    for (const user of data.users) {
      if (user.avatar) {
        const zipFile = fileMap.get(user.avatar)
        if (zipFile) {
          try {
            const fileBuffer = await zipFile.async('nodebuffer')
            const destPath = join(process.cwd(), 'public', user.avatar.slice(1))
            await mkdir(dirname(destPath), { recursive: true })
            await writeFile(destPath, fileBuffer)
            result.avatarsRestored++
          } catch (_err) {
            result.avatarsMissing++
            result.missingFiles.push(user.avatar)
          }
        } else {
          result.avatarsMissing++
          result.missingFiles.push(user.avatar)
        }
      }
    }
  }

  return result
}

/**
 * Deletes all data from the database in reverse FK order
 */
async function wipeDatabase(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  // Delete in reverse FK order to avoid constraint violations
  await tx.ticketSprintHistory.deleteMany()
  await tx.attachment.deleteMany()
  await tx.ticketActivity.deleteMany()
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
  // Clean up auth tokens
  await tx.passwordResetToken.deleteMany()
  await tx.emailVerificationToken.deleteMany()
  await tx.session.deleteMany()
  await tx.account.deleteMany()
  await tx.user.deleteMany()
  // Keep SystemSettings - we'll update it instead
}

/**
 * Imports data into the database
 * Wipes all existing data first, then imports in FK-safe order
 * If zipBuffer is provided, also restores files
 */
export async function importDatabase(
  data: ExportData,
  options?: { zipBuffer?: Buffer; exportOptions?: ExportOptionsType },
): Promise<ImportResult> {
  const counts = {
    users: 0,
    projects: 0,
    roles: 0,
    columns: 0,
    labels: 0,
    sprints: 0,
    projectMembers: 0,
    projectSprintSettings: 0,
    tickets: 0,
    ticketLinks: 0,
    ticketWatchers: 0,
    comments: 0,
    ticketEdits: 0,
    ticketActivities: 0,
    attachments: 0,
    ticketSprintHistory: 0,
    invitations: 0,
  }

  let files = {
    attachmentsRestored: 0,
    attachmentsMissing: 0,
    avatarsRestored: 0,
    avatarsMissing: 0,
    missingFiles: [] as string[],
  }

  // Handle missing files: clear avatar field if file won't be present
  const shouldClearMissingAvatars = options?.exportOptions?.includeAvatars && !options?.zipBuffer
  const dataToImport = shouldClearMissingAvatars
    ? {
        ...data,
        users: data.users.map((u) => ({ ...u, avatar: null })),
      }
    : data

  // Use a transaction with a long timeout (2 minutes) for large imports
  await db.$transaction(
    async (tx) => {
      // Step 1: Wipe existing data
      await wipeDatabase(tx)

      // Step 2: Import SystemSettings (upsert)
      if (dataToImport.systemSettings) {
        await tx.systemSettings.upsert({
          where: { id: 'system-settings' },
          create: {
            ...dataToImport.systemSettings,
            updatedAt: new Date(dataToImport.systemSettings.updatedAt),
          },
          update: {
            ...dataToImport.systemSettings,
            updatedAt: new Date(dataToImport.systemSettings.updatedAt),
          },
        })
      }

      // Step 3: Import Users
      if (dataToImport.users.length > 0) {
        for (const user of dataToImport.users) {
          await tx.user.create({
            data: {
              ...user,
              createdAt: new Date(user.createdAt),
              updatedAt: new Date(user.updatedAt),
              lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
              passwordChangedAt: user.passwordChangedAt ? new Date(user.passwordChangedAt) : null,
              emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
            },
          })
        }
        counts.users = dataToImport.users.length
      }

      // Step 4: Import Projects
      if (dataToImport.projects.length > 0) {
        for (const project of dataToImport.projects) {
          await tx.project.create({
            data: {
              ...project,
              createdAt: new Date(project.createdAt),
              updatedAt: new Date(project.updatedAt),
            },
          })
        }
        counts.projects = dataToImport.projects.length
      }

      // Step 5: Import Roles
      if (dataToImport.roles.length > 0) {
        for (const role of dataToImport.roles) {
          await tx.role.create({
            data: {
              ...role,
              createdAt: new Date(role.createdAt),
              updatedAt: new Date(role.updatedAt),
            },
          })
        }
        counts.roles = dataToImport.roles.length
      }

      // Step 6: Import Columns
      if (dataToImport.columns.length > 0) {
        for (const column of dataToImport.columns) {
          await tx.column.create({ data: column })
        }
        counts.columns = dataToImport.columns.length
      }

      // Step 7: Import Labels
      if (dataToImport.labels.length > 0) {
        for (const label of dataToImport.labels) {
          await tx.label.create({ data: label })
        }
        counts.labels = dataToImport.labels.length
      }

      // Step 8: Import Sprints
      if (dataToImport.sprints.length > 0) {
        for (const sprint of dataToImport.sprints) {
          await tx.sprint.create({
            data: {
              ...sprint,
              startDate: sprint.startDate ? new Date(sprint.startDate) : null,
              endDate: sprint.endDate ? new Date(sprint.endDate) : null,
              completedAt: sprint.completedAt ? new Date(sprint.completedAt) : null,
              createdAt: new Date(sprint.createdAt),
              updatedAt: new Date(sprint.updatedAt),
            },
          })
        }
        counts.sprints = dataToImport.sprints.length
      }

      // Step 9: Import ProjectMembers
      if (dataToImport.projectMembers.length > 0) {
        for (const member of dataToImport.projectMembers) {
          await tx.projectMember.create({
            data: {
              ...member,
              createdAt: new Date(member.createdAt),
              updatedAt: new Date(member.updatedAt),
            },
          })
        }
        counts.projectMembers = dataToImport.projectMembers.length
      }

      // Step 10: Import ProjectSprintSettings
      if (dataToImport.projectSprintSettings.length > 0) {
        for (const settings of dataToImport.projectSprintSettings) {
          await tx.projectSprintSettings.create({
            data: {
              ...settings,
              createdAt: new Date(settings.createdAt),
              updatedAt: new Date(settings.updatedAt),
            },
          })
        }
        counts.projectSprintSettings = dataToImport.projectSprintSettings.length
      }

      // Step 11: Import Tickets (without labels or parentId first, then link parents)
      // Two-pass approach: parentId is a self-referencing FK, so child tickets
      // must be inserted after their parents. We insert all tickets without
      // parentId first, then update the parent references in a second pass.
      if (dataToImport.tickets.length > 0) {
        for (const ticket of dataToImport.tickets) {
          const { labelIds, parentId, ...ticketData } = ticket
          await tx.ticket.create({
            data: {
              ...ticketData,
              parentId: null,
              startDate: ticketData.startDate ? new Date(ticketData.startDate) : null,
              dueDate: ticketData.dueDate ? new Date(ticketData.dueDate) : null,
              resolvedAt: ticketData.resolvedAt ? new Date(ticketData.resolvedAt) : null,
              createdAt: new Date(ticketData.createdAt),
              updatedAt: new Date(ticketData.updatedAt),
            },
          })
        }
        counts.tickets = dataToImport.tickets.length

        // Connect parent tickets (second pass for self-referencing FK)
        for (const ticket of dataToImport.tickets) {
          if (ticket.parentId) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { parentId: ticket.parentId },
            })
          }
        }

        // Connect ticket labels
        for (const ticket of dataToImport.tickets) {
          if (ticket.labelIds && ticket.labelIds.length > 0) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: {
                labels: {
                  connect: ticket.labelIds.map((id) => ({ id })),
                },
              },
            })
          }
        }
      }

      // Step 12: Import TicketLinks
      if (dataToImport.ticketLinks.length > 0) {
        for (const link of dataToImport.ticketLinks) {
          await tx.ticketLink.create({
            data: {
              ...link,
              createdAt: new Date(link.createdAt),
            },
          })
        }
        counts.ticketLinks = dataToImport.ticketLinks.length
      }

      // Step 13: Import TicketWatchers
      if (dataToImport.ticketWatchers.length > 0) {
        for (const watcher of dataToImport.ticketWatchers) {
          await tx.ticketWatcher.create({
            data: {
              ...watcher,
              createdAt: new Date(watcher.createdAt),
            },
          })
        }
        counts.ticketWatchers = dataToImport.ticketWatchers.length
      }

      // Step 14: Import Comments
      if (dataToImport.comments.length > 0) {
        for (const comment of dataToImport.comments) {
          await tx.comment.create({
            data: {
              ...comment,
              createdAt: new Date(comment.createdAt),
              updatedAt: new Date(comment.updatedAt),
            },
          })
        }
        counts.comments = dataToImport.comments.length
      }

      // Step 15: Import TicketEdits
      if (dataToImport.ticketEdits.length > 0) {
        for (const edit of dataToImport.ticketEdits) {
          await tx.ticketEdit.create({
            data: {
              ...edit,
              createdAt: new Date(edit.createdAt),
            },
          })
        }
        counts.ticketEdits = dataToImport.ticketEdits.length
      }

      // Step 15.5: Import TicketActivities
      const ticketActivities = dataToImport.ticketActivities ?? []
      if (ticketActivities.length > 0) {
        for (const activity of ticketActivities) {
          await tx.ticketActivity.create({
            data: {
              ...activity,
              createdAt: new Date(activity.createdAt),
            },
          })
        }
        counts.ticketActivities = ticketActivities.length
      }

      // Step 16: Import Attachments (metadata)
      // Note: If files are missing, we still import metadata but the URL won't resolve
      if (dataToImport.attachments.length > 0) {
        for (const attachment of dataToImport.attachments) {
          await tx.attachment.create({
            data: {
              ...attachment,
              createdAt: new Date(attachment.createdAt),
            },
          })
        }
        counts.attachments = dataToImport.attachments.length
      }

      // Step 17: Import TicketSprintHistory
      if (dataToImport.ticketSprintHistory.length > 0) {
        for (const history of dataToImport.ticketSprintHistory) {
          await tx.ticketSprintHistory.create({
            data: {
              ...history,
              addedAt: new Date(history.addedAt),
              removedAt: history.removedAt ? new Date(history.removedAt) : null,
            },
          })
        }
        counts.ticketSprintHistory = dataToImport.ticketSprintHistory.length
      }

      // Step 18: Import Invitations
      if (dataToImport.invitations.length > 0) {
        for (const invitation of dataToImport.invitations) {
          await tx.invitation.create({
            data: {
              ...invitation,
              expiresAt: new Date(invitation.expiresAt),
              createdAt: new Date(invitation.createdAt),
            },
          })
        }
        counts.invitations = dataToImport.invitations.length
      }
    },
    {
      timeout: 120_000, // 2 minute timeout for large imports
    },
  )

  // Restore files from ZIP after successful database import
  if (options?.zipBuffer) {
    files = await restoreFilesFromZip(options.zipBuffer, data, options.exportOptions)
  }

  return { success: true, counts, files }
}
