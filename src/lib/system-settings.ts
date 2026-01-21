/**
 * System settings helper for fetching and managing global configuration.
 * Provides cached access to system-wide settings like file upload limits.
 */

import { db } from '@/lib/db'

// Default values matching Prisma schema defaults
const DEFAULT_SETTINGS = {
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

export interface SystemSettings {
  id: string
  updatedAt: Date
  updatedBy: string | null
  maxImageSizeMB: number
  maxVideoSizeMB: number
  maxDocumentSizeMB: number
  maxAttachmentsPerTicket: number
  allowedImageTypes: string[]
  allowedVideoTypes: string[]
  allowedDocumentTypes: string[]
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
 * Parse JSON string array from database, with fallback to default
 */
function parseJsonArray(jsonString: string, fallback: string[]): string[] {
  try {
    const parsed = JSON.parse(jsonString)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

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
    maxImageSizeMB: settings.maxImageSizeMB,
    maxVideoSizeMB: settings.maxVideoSizeMB,
    maxDocumentSizeMB: settings.maxDocumentSizeMB,
    maxAttachmentsPerTicket: settings.maxAttachmentsPerTicket,
    allowedImageTypes: parseJsonArray(
      settings.allowedImageTypes,
      DEFAULT_SETTINGS.allowedImageTypes,
    ),
    allowedVideoTypes: parseJsonArray(
      settings.allowedVideoTypes,
      DEFAULT_SETTINGS.allowedVideoTypes,
    ),
    allowedDocumentTypes: parseJsonArray(
      settings.allowedDocumentTypes,
      DEFAULT_SETTINGS.allowedDocumentTypes,
    ),
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
