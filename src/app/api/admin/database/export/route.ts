import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import {
  createDatabaseExport,
  createDatabaseExportZip,
  createEncryptedDatabaseExport,
  generateExportFilename,
} from '@/lib/database-export'

const ExportRequestSchema = z.object({
  password: z.string().optional(),
  includeAttachments: z.boolean().optional(),
  includeAvatars: z.boolean().optional(),
})

/**
 * POST /api/admin/database/export
 *
 * Exports the entire database.
 * - If includeAttachments or includeAvatars is true, returns a ZIP file
 * - Otherwise returns JSON
 * - Optionally encrypts data with password if provided
 *
 * Requires system admin.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSystemAdmin()

    // Parse request body
    let body: unknown = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch {
      // Empty body is OK
    }

    const result = ExportRequestSchema.safeParse(body)
    if (!result.success) {
      return validationError(result)
    }

    const { password, includeAttachments, includeAvatars } = result.data
    const includeFiles = includeAttachments || includeAvatars

    if (includeFiles) {
      // Create ZIP with files
      const { buffer } = await createDatabaseExportZip(user.id, {
        password,
        includeAttachments,
        includeAvatars,
      })

      const filename = generateExportFilename(true)

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Create JSON export (legacy format, no files)
    let exportData: object
    if (password) {
      exportData = await createEncryptedDatabaseExport(user.id, password)
    } else {
      exportData = await createDatabaseExport(user.id)
    }

    // Return as downloadable JSON
    const filename = generateExportFilename(false)
    const json = JSON.stringify(exportData, null, 2)

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'export database')
  }
}
