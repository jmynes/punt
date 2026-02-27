import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { importDatabase, parseExportFile } from '@/lib/database-import'
import { db } from '@/lib/db'

const SetupImportSchema = z.object({
  content: z.string().min(1),
  decryptionPassword: z.string().optional(),
})

/**
 * POST /api/auth/setup/import
 *
 * Imports a database backup during first-run setup (no users in DB).
 * This endpoint is under /api/auth/* so the middleware allows it without auth.
 * Returns 403 if users already exist.
 */
export async function POST(request: Request) {
  try {
    const userCount = await db.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. Users already exist.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const result = SetupImportSchema.safeParse(body)
    if (!result.success) {
      return validationError(result)
    }

    const { content, decryptionPassword } = result.data
    const buffer = Buffer.from(content, 'base64')

    const parseResult = await parseExportFile(buffer, decryptionPassword)
    if (!parseResult.success) {
      return badRequestError(parseResult.error)
    }

    const importResult = await importDatabase(parseResult.data, {
      zipBuffer: parseResult.isZip ? parseResult.zipBuffer : undefined,
      exportOptions: parseResult.options,
    })

    return NextResponse.json(importResult)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Transaction')) {
      return NextResponse.json(
        { error: 'Import timed out. The backup may be too large.' },
        { status: 500 },
      )
    }
    return handleApiError(error, 'setup import')
  }
}
