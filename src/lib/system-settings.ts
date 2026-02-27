/**
 * System settings helper for fetching and managing global configuration.
 * Provides cached access to system-wide settings like file upload limits and branding.
 */

import { type BrandingSettings, DEFAULT_BRANDING } from '@/lib/branding'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export type { BrandingSettings } from '@/lib/branding'
export { DEFAULT_BRANDING } from '@/lib/branding'

// Default values matching Prisma schema defaults
const DEFAULT_SETTINGS = {
  ...DEFAULT_BRANDING,
  maxImageSizeMB: 10,
  maxVideoSizeMB: 100,
  maxDocumentSizeMB: 25,
  maxAttachmentsPerTicket: 20,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  allowedDocumentTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
}

// Supported hosting providers for repository configuration
export type RepoHostingProvider = 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'codeberg' | 'other'

export interface SystemSettings {
  id: string
  updatedAt: Date
  updatedBy: string | null
  // Branding
  appName: string
  logoUrl: string | null
  logoLetter: string
  logoGradientFrom: string
  logoGradientTo: string
  // Upload settings
  maxImageSizeMB: number
  maxVideoSizeMB: number
  maxDocumentSizeMB: number
  maxAttachmentsPerTicket: number
  allowedImageTypes: string[]
  allowedVideoTypes: string[]
  allowedDocumentTypes: string[]
  // Board settings
  showAddColumnButton: boolean
  // Repository configuration
  canonicalRepoUrl: string | null
  repoHostingProvider: RepoHostingProvider | null
  forkRepoUrl: string | null
  // Agent configuration defaults
  defaultBranchTemplate: string
  defaultAgentGuidance: string | null
  // Default sprint times (system-wide defaults for new projects)
  defaultSprintStartTime: string // HH:mm format (e.g., "09:00")
  defaultSprintEndTime: string // HH:mm format (e.g., "17:00")
}

export interface UploadConfig {
  allowedTypes: string[]
  maxSizes: {
    image: number // in bytes
    video: number
    document: number
  }
  maxAttachmentsPerTicket: number
}

/**
 * Coerce a Json field value to a string array, with fallback to default.
 * With PostgreSQL native Json, the value is already parsed. Handles both
 * pre-parsed arrays and legacy string values for backwards compatibility.
 */
function coerceJsonArray(value: unknown, fallback: string[], fieldName?: string): string[] {
  if (Array.isArray(value)) {
    return value as string[]
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fall through to fallback
    }
  }
  logger.warn(
    `System settings JSON field${fieldName ? ` '${fieldName}'` : ''} is not an array, using fallback`,
  )
  return fallback
}

export { coerceJsonArray as _coerceJsonArrayForTesting }

/**
 * Fetch system settings from database, creating defaults if none exist.
 * Returns parsed settings with MIME type arrays.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  // Upsert to ensure settings exist with defaults
  const settings = await db.systemSettings.upsert({
    where: { id: 'system-settings' },
    update: {},
    create: {
      id: 'system-settings',
    },
  })

  return {
    id: settings.id,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
    // Branding
    appName: settings.appName,
    logoUrl: settings.logoUrl,
    logoLetter: settings.logoLetter,
    logoGradientFrom: settings.logoGradientFrom,
    logoGradientTo: settings.logoGradientTo,
    // Upload settings
    maxImageSizeMB: settings.maxImageSizeMB,
    maxVideoSizeMB: settings.maxVideoSizeMB,
    maxDocumentSizeMB: settings.maxDocumentSizeMB,
    maxAttachmentsPerTicket: settings.maxAttachmentsPerTicket,
    allowedImageTypes: coerceJsonArray(
      settings.allowedImageTypes,
      DEFAULT_SETTINGS.allowedImageTypes,
      'allowedImageTypes',
    ),
    allowedVideoTypes: coerceJsonArray(
      settings.allowedVideoTypes,
      DEFAULT_SETTINGS.allowedVideoTypes,
      'allowedVideoTypes',
    ),
    allowedDocumentTypes: coerceJsonArray(
      settings.allowedDocumentTypes,
      DEFAULT_SETTINGS.allowedDocumentTypes,
      'allowedDocumentTypes',
    ),
    // Board settings
    showAddColumnButton: settings.showAddColumnButton,
    // Repository configuration
    canonicalRepoUrl: settings.canonicalRepoUrl,
    repoHostingProvider: settings.repoHostingProvider as RepoHostingProvider | null,
    forkRepoUrl: settings.forkRepoUrl,
    // Agent configuration defaults
    defaultBranchTemplate: settings.defaultBranchTemplate,
    defaultAgentGuidance: settings.defaultAgentGuidance,
    // Default sprint times
    defaultSprintStartTime: settings.defaultSprintStartTime,
    defaultSprintEndTime: settings.defaultSprintEndTime,
  }
}

/**
 * Fetch branding settings from database.
 * This is a public endpoint (no auth required) for use in header and login page.
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  // Find existing settings or return defaults
  const settings = await db.systemSettings.findUnique({
    where: { id: 'system-settings' },
    select: {
      appName: true,
      logoUrl: true,
      logoLetter: true,
      logoGradientFrom: true,
      logoGradientTo: true,
    },
  })

  if (!settings) {
    return { ...DEFAULT_BRANDING }
  }

  return {
    appName: settings.appName,
    logoUrl: settings.logoUrl,
    logoLetter: settings.logoLetter,
    logoGradientFrom: settings.logoGradientFrom,
    logoGradientTo: settings.logoGradientTo,
  }
}

/**
 * Get upload configuration for client-side validation.
 * Converts MB limits to bytes and combines all allowed types.
 */
export async function getUploadConfig(): Promise<UploadConfig> {
  const settings = await getSystemSettings()

  return {
    allowedTypes: [
      ...settings.allowedImageTypes,
      ...settings.allowedVideoTypes,
      ...settings.allowedDocumentTypes,
    ],
    maxSizes: {
      image: settings.maxImageSizeMB * 1024 * 1024,
      video: settings.maxVideoSizeMB * 1024 * 1024,
      document: settings.maxDocumentSizeMB * 1024 * 1024,
    },
    maxAttachmentsPerTicket: settings.maxAttachmentsPerTicket,
  }
}

/**
 * Get max file size for a specific MIME type.
 */
export function getMaxSizeForMimeType(mimetype: string, settings: SystemSettings): number {
  if (settings.allowedImageTypes.includes(mimetype)) {
    return settings.maxImageSizeMB * 1024 * 1024
  }
  if (settings.allowedVideoTypes.includes(mimetype)) {
    return settings.maxVideoSizeMB * 1024 * 1024
  }
  // Document or unknown - use document limit
  return settings.maxDocumentSizeMB * 1024 * 1024
}

/**
 * Get file category for a MIME type.
 */
export function getFileCategoryForMimeType(
  mimetype: string,
  settings: SystemSettings,
): 'image' | 'video' | 'document' {
  if (settings.allowedImageTypes.includes(mimetype)) return 'image'
  if (settings.allowedVideoTypes.includes(mimetype)) return 'video'
  return 'document'
}
