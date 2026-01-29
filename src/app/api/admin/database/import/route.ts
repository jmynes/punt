import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { type ImportResult, importDatabase, parseExportFile } from '@/lib/database-import'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

const ImportRequestSchema = z.object({
  // Base64 encoded file content (for both ZIP and JSON)
  content: z.string().min(1),
  // Password for decryption (if encrypted)
  decryptionPassword: z.string().optional(),
  // Admin credentials for verification
  email: z.string().email(),
  password: z.string().min(1),
  // Confirmation string
  confirmText: z.string(),
})

const REQUIRED_CONFIRMATION = 'DELETE ALL DATA'

/**
 * POST /api/admin/database/import
 *
 * Imports a database backup, replacing all existing data.
 * Supports both ZIP (with files) and JSON (data only) formats.
 *
 * Requires:
 * - System admin
 * - Re-authentication with admin credentials
 * - Typing "DELETE ALL DATA" confirmation
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireSystemAdmin()

    // Parse request body
    const body = await request.json()
    const result = ImportRequestSchema.safeParse(body)
    if (!result.success) {
      return validationError(result)
    }

    const { content, decryptionPassword, email, password, confirmText } = result.data

    // Verify confirmation text
    if (confirmText !== REQUIRED_CONFIRMATION) {
      return badRequestError(`Please type "${REQUIRED_CONFIRMATION}" to confirm`)
    }

    // Verify admin credentials
    const adminUser = await db.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, isSystemAdmin: true },
    })

    if (!adminUser || adminUser.id !== currentUser.id) {
      return badRequestError('Invalid credentials')
    }

    if (!adminUser.passwordHash) {
      return badRequestError('Invalid credentials')
    }

    const passwordValid = await verifyPassword(password, adminUser.passwordHash)
    if (!passwordValid) {
      return badRequestError('Invalid credentials')
    }

    if (!adminUser.isSystemAdmin) {
      return NextResponse.json({ error: 'System admin required' }, { status: 403 })
    }

    // Decode base64 content to buffer
    const buffer = Buffer.from(content, 'base64')

    // Parse and validate export file (handles both ZIP and JSON)
    const parseResult = await parseExportFile(buffer, decryptionPassword)
    if (!parseResult.success) {
      return badRequestError(parseResult.error)
    }

    // Import the data (and files if ZIP)
    const importResult = await importDatabase(parseResult.data, {
      zipBuffer: parseResult.isZip ? parseResult.zipBuffer : undefined,
      exportOptions: parseResult.options,
    })

    return NextResponse.json(importResult)
  } catch (error) {
    // Check for transaction timeout
    if (error instanceof Error && error.message.includes('Transaction')) {
      return NextResponse.json(
        { error: 'Import timed out. The backup may be too large.' },
        { status: 500 },
      )
    }
    return handleApiError(error, 'import database')
  }
}
