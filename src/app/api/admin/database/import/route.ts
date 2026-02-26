import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { importDatabase, parseExportFile } from '@/lib/database-import'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const ImportRequestSchema = z.object({
  // Base64 encoded file content (for both ZIP and JSON)
  content: z.string().min(1),
  // Password for decryption (if encrypted)
  decryptionPassword: z.string().optional(),
  // Admin password for re-authentication
  confirmPassword: z.string().min(1),
  // Confirmation string
  confirmText: z.string(),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

async function verifyReauth(
  userId: string,
  password: string,
  totpCode?: string,
  isRecoveryCode?: boolean,
): Promise<NextResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      totpRecoveryCodes: true,
    },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash)
  if (!isValidPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null
}

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

    const { content, decryptionPassword, confirmPassword, confirmText, totpCode, isRecoveryCode } =
      result.data

    // Verify confirmation text
    if (confirmText !== REQUIRED_CONFIRMATION) {
      return badRequestError(`Please type "${REQUIRED_CONFIRMATION}" to confirm`)
    }

    const authError = await verifyReauth(currentUser.id, confirmPassword, totpCode, isRecoveryCode)
    if (authError) return authError

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

    // Emit database event for real-time updates
    // This notifies other browser tabs/windows to sign out
    projectEvents.emitDatabaseEvent({
      type: 'database.wiped',
      userId: currentUser.id,
      timestamp: Date.now(),
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
