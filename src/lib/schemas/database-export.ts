/**
 * Zod validation schemas for database export/import
 *
 * These schemas validate the structure of exported data to ensure
 * it can be safely imported without corrupting the database.
 */

import { z } from 'zod'

// Helper for nullable dates
const nullableDate = z.union([z.string().datetime(), z.null()])
const optionalDate = z.string().datetime().optional()

// ============================================================================
// Model schemas (matching Prisma schema)
// ============================================================================

export const SystemSettingsSchema = z.object({
  id: z.string(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().nullable(),
  // Branding
  appName: z.string(),
  logoUrl: z.string().nullable(),
  logoLetter: z.string(),
  logoGradientFrom: z.string(),
  logoGradientTo: z.string(),
  // Upload limits
  maxImageSizeMB: z.number(),
  maxVideoSizeMB: z.number(),
  maxDocumentSizeMB: z.number(),
  maxAttachmentsPerTicket: z.number(),
  // Allowed MIME types
  allowedImageTypes: z.string(),
  allowedVideoTypes: z.string(),
  allowedDocumentTypes: z.string(),
  // Email settings
  emailEnabled: z.boolean(),
  emailProvider: z.string(),
  emailFromAddress: z.string(),
  emailFromName: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number(),
  smtpUsername: z.string(),
  smtpSecure: z.boolean(),
  emailPasswordReset: z.boolean(),
  emailWelcome: z.boolean(),
  emailVerification: z.boolean(),
  emailInvitations: z.boolean(),
  // Default role permissions
  defaultRolePermissions: z.string().nullable(),
})

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  name: z.string(),
  avatar: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: nullableDate,
  passwordHash: z.string().nullable(),
  passwordChangedAt: nullableDate,
  emailVerified: nullableDate,
  isSystemAdmin: z.boolean(),
  isActive: z.boolean(),
})

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
  permissions: z.string(),
  isDefault: z.boolean(),
  position: z.number(),
  projectId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const ColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  projectId: z.string(),
})

export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  projectId: z.string(),
})

export const SprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string().nullable(),
  startDate: nullableDate,
  endDate: nullableDate,
  budget: z.number().nullable(),
  status: z.string(),
  completedAt: nullableDate,
  completedById: z.string().nullable(),
  completedTicketCount: z.number().nullable(),
  incompleteTicketCount: z.number().nullable(),
  completedStoryPoints: z.number().nullable(),
  incompleteStoryPoints: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  projectId: z.string(),
})

export const ProjectMemberSchema = z.object({
  id: z.string(),
  roleId: z.string(),
  overrides: z.string().nullable(),
  userId: z.string(),
  projectId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const ProjectSprintSettingsSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  defaultSprintDuration: z.number(),
  autoCarryOverIncomplete: z.boolean(),
  doneColumnIds: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const TicketSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  priority: z.string(),
  order: z.number(),
  storyPoints: z.number().nullable(),
  estimate: z.string().nullable(),
  startDate: nullableDate,
  dueDate: nullableDate,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  environment: z.string().nullable(),
  affectedVersion: z.string().nullable(),
  fixVersion: z.string().nullable(),
  projectId: z.string(),
  columnId: z.string(),
  assigneeId: z.string().nullable(),
  creatorId: z.string().nullable(),
  sprintId: z.string().nullable(),
  isCarriedOver: z.boolean(),
  carriedFromSprintId: z.string().nullable(),
  carriedOverCount: z.number(),
  parentId: z.string().nullable(),
  // Many-to-many label IDs (handled separately)
  labelIds: z.array(z.string()).optional(),
})

export const TicketLinkSchema = z.object({
  id: z.string(),
  linkType: z.string(),
  fromTicketId: z.string(),
  toTicketId: z.string(),
  createdAt: z.string().datetime(),
})

export const TicketWatcherSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  ticketId: z.string(),
  userId: z.string(),
})

export const CommentSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ticketId: z.string(),
  authorId: z.string(),
})

export const TicketEditSchema = z.object({
  id: z.string(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  createdAt: z.string().datetime(),
  ticketId: z.string(),
  userId: z.string(),
})

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string(),
  createdAt: z.string().datetime(),
  ticketId: z.string(),
  uploaderId: z.string().nullable(),
})

export const TicketSprintHistorySchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  sprintId: z.string(),
  addedAt: z.string().datetime(),
  removedAt: nullableDate,
  entryType: z.string(),
  exitStatus: z.string().nullable(),
  carriedFromSprintId: z.string().nullable(),
})

export const InvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  token: z.string(),
  expiresAt: z.string().datetime(),
  status: z.string(),
  createdAt: z.string().datetime(),
  senderId: z.string().nullable(),
  projectId: z.string(),
})

// ============================================================================
// Export data schema
// ============================================================================

export const ExportDataSchema = z.object({
  systemSettings: SystemSettingsSchema.nullable(),
  users: z.array(UserSchema),
  projects: z.array(ProjectSchema),
  roles: z.array(RoleSchema),
  columns: z.array(ColumnSchema),
  labels: z.array(LabelSchema),
  sprints: z.array(SprintSchema),
  projectMembers: z.array(ProjectMemberSchema),
  projectSprintSettings: z.array(ProjectSprintSettingsSchema),
  tickets: z.array(TicketSchema),
  ticketLinks: z.array(TicketLinkSchema),
  ticketWatchers: z.array(TicketWatcherSchema),
  comments: z.array(CommentSchema),
  ticketEdits: z.array(TicketEditSchema),
  attachments: z.array(AttachmentSchema),
  ticketSprintHistory: z.array(TicketSprintHistorySchema),
  invitations: z.array(InvitationSchema),
})

export type ExportData = z.infer<typeof ExportDataSchema>

// ============================================================================
// Export options schema
// ============================================================================

export const ExportOptionsSchema = z.object({
  includeAttachments: z.boolean().optional(),
  includeAvatars: z.boolean().optional(),
})

export type ExportOptionsType = z.infer<typeof ExportOptionsSchema>

// ============================================================================
// Full export file schema
// ============================================================================

export const DatabaseExportSchema = z.object({
  version: z.string(),
  exportedAt: z.string().datetime(),
  exportedBy: z.string(),
  encrypted: z.literal(false),
  options: ExportOptionsSchema.optional(),
  data: ExportDataSchema,
})

export type DatabaseExport = z.infer<typeof DatabaseExportSchema>

// Encrypted version (data is replaced with encryption fields)
export const EncryptedDatabaseExportSchema = z.object({
  version: z.string(),
  exportedAt: z.string().datetime(),
  exportedBy: z.string(),
  encrypted: z.literal(true),
  options: ExportOptionsSchema.optional(),
  ciphertext: z.string(),
  salt: z.string(),
  iv: z.string(),
  authTag: z.string(),
})

export type EncryptedDatabaseExport = z.infer<typeof EncryptedDatabaseExportSchema>

// Union type for parsing either format
export const AnyDatabaseExportSchema = z.union([
  DatabaseExportSchema,
  EncryptedDatabaseExportSchema,
])

export type AnyDatabaseExport = z.infer<typeof AnyDatabaseExportSchema>

// Export version for compatibility checks
export const EXPORT_VERSION = '1.0.0'
