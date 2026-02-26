import { NextResponse } from 'next/server'
import { z } from 'zod'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import {
  createDatabaseExport,
  createDatabaseExportZip,
  createEncryptedDatabaseExport,
  generateExportFilename,
} from '@/lib/database-export'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const ExportRequestSchema = z.object({
  password: z.string().optional(),
  includeAttachments: z.boolean().optional(),
  includeAvatars: z.boolean().optional(),
  confirmPassword: z.string().min(1, 'Your password is required to confirm this action'),
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

    const {
      password,
      includeAttachments,
      includeAvatars,
      confirmPassword,
      totpCode,
      isRecoveryCode,
    } = result.data

    const authError = await verifyReauth(user.id, confirmPassword, totpCode, isRecoveryCode)
    if (authError) return authError

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
