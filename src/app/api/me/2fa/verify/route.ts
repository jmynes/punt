import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import {
  decryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyTotpToken,
} from '@/lib/totp'

const verifySchema = z.object({
  code: z
    .string()
    .min(6, 'Code must be 6 digits')
    .max(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
})

/**
 * POST /api/me/2fa/verify - Verify TOTP code and enable 2FA
 * Called after /api/me/2fa/setup to confirm the user has set up their authenticator app.
 * Returns recovery codes on success.
 */
export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({
        enabled: true,
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
    const parsed = verifySchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { code } = parsed.data

    // Get the stored (but not yet enabled) TOTP secret
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { totpSecret: true, totpEnabled: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 },
      )
    }

    if (!user.totpSecret) {
      return NextResponse.json({ error: 'Please initiate 2FA setup first' }, { status: 400 })
    }

    // Decrypt and verify the code
    const secret = decryptTotpSecret(user.totpSecret)
    const isValid = verifyTotpToken(code, secret)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 },
      )
    }

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes()
    const hashedCodes = await hashRecoveryCodes(recoveryCodes)

    // Enable 2FA and store recovery codes
    await db.user.update({
      where: { id: currentUser.id },
      data: {
        totpEnabled: true,
        totpRecoveryCodes: hashedCodes,
      },
    })

    return NextResponse.json({
      enabled: true,
      recoveryCodes,
    })
  } catch (error) {
    return handleApiError(error, 'verify 2FA')
  }
}
