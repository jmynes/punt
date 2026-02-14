import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { parseExportFile } from '@/lib/database-import'

const PreviewRequestSchema = z.object({
  // Base64 encoded file content (for both ZIP and JSON)
  content: z.string().min(1),
  // Password for decryption (if encrypted)
  decryptionPassword: z.string().optional(),
})

export interface ImportPreview {
  version: number
  exportedAt: string
  isZip: boolean
  isEncrypted: boolean
  includesAttachments: boolean
  includesAvatars: boolean
  counts: {
    users: number
    projects: number
    roles: number
    columns: number
    labels: number
    sprints: number
    projectMembers: number
    tickets: number
    ticketLinks: number
    comments: number
    attachments: number
  }
}

/**
 * POST /api/admin/database/preview
 *
 * Parses and validates a database backup file without modifying the database.
 * Returns a preview of what will be imported.
 *
 * Requires:
 * - System admin
 */
export async function POST(request: Request) {
  try {
    await requireSystemAdmin()

    // Parse request body
    const body = await request.json()
    const result = PreviewRequestSchema.safeParse(body)
    if (!result.success) {
      return validationError(result)
    }

    const { content, decryptionPassword } = result.data

    // Decode base64 content to buffer
    const buffer = Buffer.from(content, 'base64')

    // Parse and validate export file (handles both ZIP and JSON)
    const parseResult = await parseExportFile(buffer, decryptionPassword)
    if (!parseResult.success) {
      return badRequestError(parseResult.error)
    }

    const { data, options, isZip, exportedAt } = parseResult

    // Build preview response
    const preview: ImportPreview = {
      version: 1, // Current export version
      exportedAt,
      isZip,
      isEncrypted: !!decryptionPassword,
      includesAttachments: options?.includeAttachments ?? false,
      includesAvatars: options?.includeAvatars ?? false,
      counts: {
        users: data.users.length,
        projects: data.projects.length,
        roles: data.roles.length,
        columns: data.columns.length,
        labels: data.labels.length,
        sprints: data.sprints.length,
        projectMembers: data.projectMembers.length,
        tickets: data.tickets.length,
        ticketLinks: data.ticketLinks.length,
        comments: data.comments.length,
        attachments: data.attachments.length,
      },
    }

    return NextResponse.json(preview)
  } catch (error) {
    return handleApiError(error, 'preview database import')
  }
}
