import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyTotpToken,
} from '@/lib/totp'

const regenerateSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().min(1, '2FA code is required'),
})

/**
 * POST /api/me/2fa/recovery-codes/regenerate - Generate new recovery codes
 * Invalidates all old recovery codes.
 */
export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({
        recoveryCodes: [
          'ABCDE-12345',
          'FGHIJ-67890',
          'KLMNO-11111',
          'PQRST-22222',
          'UVWXY-33333',
          'ZABCD-44444',
          'EFGHI-55555',
          'JKLMN-66666',
        ],
      })
    }

    const currentUser = await requireAuth()

    const body = await request.json()
    const parsed = regenerateSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { password, totpCode } = parsed.data

    // Verify password
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true, totpEnabled: true, totpSecret: true },
    })

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: 'Cannot verify password for this account type' },
        { status: 400 },
      )
    }

    if (!user.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 },
      )
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    // Verify TOTP code
    if (user.totpSecret) {
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json(
          { error: 'Invalid two-factor authentication code' },
          { status: 401 },
        )
      }
    }

    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes()
    const hashedCodes = await hashRecoveryCodes(recoveryCodes)

    // Update recovery codes (invalidates old ones)
    await db.user.update({
      where: { id: currentUser.id },
      data: { totpRecoveryCodes: hashedCodes },
    })

    return NextResponse.json({ recoveryCodes })
  } catch (error) {
    return handleApiError(error, 'regenerate recovery codes')
  }
}
