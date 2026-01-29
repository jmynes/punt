/**
 * Database export utilities
 *
 * Exports all database models in a foreign-key safe order
 * that can be imported without constraint violations.
 * Optionally includes attachment files and profile pictures in a ZIP archive.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { encrypt } from '@/lib/crypto'
import { db } from '@/lib/db'
import {
  type DatabaseExport,
  type EncryptedDatabaseExport,
  EXPORT_VERSION,
  type ExportData,
} from '@/lib/schemas/database-export'

export interface ExportOptions {
  includeAttachments?: boolean
  includeAvatars?: boolean
  password?: string
}

export interface FileManifest {
  attachments: Array<{ url: string; exists: boolean }>
  avatars: Array<{ url: string; exists: boolean }>
}

/**
 * Export all database data in FK-safe order
 *
 * Order is important for import:
 * 1. SystemSettings (no dependencies)
 * 2. Users (no dependencies)
 * 3. Projects (no dependencies)
 * 4. Roles (depends on Projects)
 * 5. Columns (depends on Projects)
 * 6. Labels (depends on Projects)
 * 7. Sprints (depends on Projects, Users for completedBy)
 * 8. ProjectMembers (depends on Users, Projects, Roles)
 * 9. ProjectSprintSettings (depends on Projects)
 * 10. Tickets (depends on Projects, Columns, Users, Sprints, Labels)
 * 11. TicketLinks (depends on Tickets)
 * 12. TicketWatchers (depends on Tickets, Users)
 * 13. Comments (depends on Tickets, Users)
 * 14. TicketEdits (depends on Tickets, Users)
 * 15. Attachments (depends on Tickets, Users)
 * 16. TicketSprintHistory (depends on Tickets, Sprints)
 * 17. Invitations (depends on Projects, Users)
 */
export async function exportDatabase(): Promise<ExportData> {
  // Fetch all data in parallel for efficiency
  const [
    systemSettings,
    users,
    projects,
    roles,
    columns,
    labels,
    sprints,
    projectMembers,
    projectSprintSettings,
    tickets,
    ticketLinks,
    ticketWatchers,
    comments,
    ticketEdits,
    attachments,
    ticketSprintHistory,
    invitations,
  ] = await Promise.all([
    db.systemSettings.findUnique({ where: { id: 'system-settings' } }),
    db.user.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.project.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.role.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.column.findMany({
      orderBy: { order: 'asc' },
    }),
    db.label.findMany({
      orderBy: { name: 'asc' },
    }),
    db.sprint.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.projectMember.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.projectSprintSettings.findMany(),
    db.ticket.findMany({
      include: { labels: { select: { id: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.ticketLink.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.ticketWatcher.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.comment.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.ticketEdit.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.attachment.findMany({
      orderBy: { createdAt: 'asc' },
    }),
    db.ticketSprintHistory.findMany({
      orderBy: { addedAt: 'asc' },
    }),
    db.invitation.findMany({
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Convert dates to ISO strings and extract label IDs for tickets
  const ticketsWithLabelIds = tickets.map((ticket) => ({
    ...ticket,
    startDate: ticket.startDate?.toISOString() ?? null,
    dueDate: ticket.dueDate?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    labelIds: ticket.labels.map((l) => l.id),
  }))

  // Remove the labels relation from the ticket objects
  const ticketsForExport = ticketsWithLabelIds.map(({ labels: _, ...ticket }) => ticket)

  return {
    systemSettings: systemSettings
      ? {
          ...systemSettings,
          updatedAt: systemSettings.updatedAt.toISOString(),
        }
      : null,
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
      emailVerified: u.emailVerified?.toISOString() ?? null,
    })),
    projects: projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    roles: roles.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    columns,
    labels,
    sprints: sprints.map((s) => ({
      ...s,
      startDate: s.startDate?.toISOString() ?? null,
      endDate: s.endDate?.toISOString() ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    projectMembers: projectMembers.map((pm) => ({
      ...pm,
      createdAt: pm.createdAt.toISOString(),
      updatedAt: pm.updatedAt.toISOString(),
    })),
    projectSprintSettings: projectSprintSettings.map((pss) => ({
      ...pss,
      createdAt: pss.createdAt.toISOString(),
      updatedAt: pss.updatedAt.toISOString(),
    })),
    tickets: ticketsForExport,
    ticketLinks: ticketLinks.map((tl) => ({
      ...tl,
      createdAt: tl.createdAt.toISOString(),
    })),
    ticketWatchers: ticketWatchers.map((tw) => ({
      ...tw,
      createdAt: tw.createdAt.toISOString(),
    })),
    comments: comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    ticketEdits: ticketEdits.map((te) => ({
      ...te,
      createdAt: te.createdAt.toISOString(),
    })),
    attachments: attachments.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    ticketSprintHistory: ticketSprintHistory.map((tsh) => ({
      ...tsh,
      addedAt: tsh.addedAt.toISOString(),
      removedAt: tsh.removedAt?.toISOString() ?? null,
    })),
    invitations: invitations.map((inv) => ({
      ...inv,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
  }
}

/**
 * Converts a URL path to a filesystem path
 * e.g., /uploads/foo.jpg -> public/uploads/foo.jpg
 */
function urlToFilePath(url: string): string {
  // Remove leading slash and prepend public directory
  const relativePath = url.startsWith('/') ? url.slice(1) : url
  return join(process.cwd(), 'public', relativePath)
}

/**
 * Creates the JSON backup content (optionally encrypted)
 */
function createBackupJson(
  data: ExportData,
  userId: string,
  options: ExportOptions,
): DatabaseExport | EncryptedDatabaseExport {
  const baseExport = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    options: {
      includeAttachments: options.includeAttachments ?? false,
      includeAvatars: options.includeAvatars ?? false,
    },
  }

  if (options.password) {
    const dataJson = JSON.stringify(data)
    const encrypted = encrypt(dataJson, options.password)
    return {
      ...baseExport,
      encrypted: true,
      ...encrypted,
    }
  }

  return {
    ...baseExport,
    encrypted: false,
    data,
  }
}

/**
 * Creates a ZIP archive containing the backup JSON and optionally files
 * Returns a Buffer of the ZIP content
 */
export async function createDatabaseExportZip(
  userId: string,
  options: ExportOptions = {},
): Promise<{ buffer: Buffer; manifest: FileManifest }> {
  const data = await exportDatabase()
  const backupJson = createBackupJson(data, userId, options)

  const manifest: FileManifest = {
    attachments: [],
    avatars: [],
  }

  // Create ZIP archive using adm-zip
  const zip = new AdmZip()

  // Add the JSON backup
  zip.addFile('backup.json', Buffer.from(JSON.stringify(backupJson, null, 2), 'utf8'))

  // Add attachment files if requested
  if (options.includeAttachments) {
    for (const attachment of data.attachments) {
      if (attachment.url) {
        const filePath = urlToFilePath(attachment.url)
        const exists = existsSync(filePath)
        manifest.attachments.push({ url: attachment.url, exists })

        if (exists) {
          // Store in files/ directory, preserving the URL structure
          const archivePath = `files${attachment.url}`
          const fileContent = readFileSync(filePath)
          zip.addFile(archivePath, fileContent)
        }
      }
    }
  }

  // Add avatar files if requested
  if (options.includeAvatars) {
    for (const user of data.users) {
      if (user.avatar) {
        const filePath = urlToFilePath(user.avatar)
        const exists = existsSync(filePath)
        manifest.avatars.push({ url: user.avatar, exists })

        if (exists) {
          // Store in files/ directory, preserving the URL structure
          const archivePath = `files${user.avatar}`
          const fileContent = readFileSync(filePath)
          zip.addFile(archivePath, fileContent)
        }
      }
    }
  }

  // Get the ZIP buffer
  const buffer = zip.toBuffer()

  return { buffer, manifest }
}

/**
 * Creates a simple JSON export (no files, legacy format)
 */
export async function createDatabaseExport(userId: string): Promise<DatabaseExport> {
  const data = await exportDatabase()

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    encrypted: false,
    data,
  }
}

/**
 * Creates an encrypted JSON export (no files, legacy format)
 */
export async function createEncryptedDatabaseExport(
  userId: string,
  password: string,
): Promise<EncryptedDatabaseExport> {
  const data = await exportDatabase()
  const dataJson = JSON.stringify(data)
  const encrypted = encrypt(dataJson, password)

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    encrypted: true,
    ...encrypted,
  }
}

/**
 * Generates a filename for the export
 */
export function generateExportFilename(includeFiles: boolean): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const extension = includeFiles ? 'zip' : 'json'
  return `punt-backup-${date}.${extension}`
}
