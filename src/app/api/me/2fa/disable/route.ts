import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { verifyPassword } from '@/lib/password'
import { decryptTotpSecret, verifyTotpToken } from '@/lib/totp'

const disableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().min(1, '2FA code is required'),
})

/**
 * POST /api/me/2fa/disable - Disable 2FA (requires password)
 */
export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ disabled: true })
    }

    const currentUser = await requireAuth()

    const body = await request.json()
    const parsed = disableSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { password, totpCode } = parsed.data

    // Verify the user's password
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

    // Disable 2FA and clear all TOTP data
    await db.user.update({
      where: { id: currentUser.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryCodes: null,
      },
    })

    return NextResponse.json({ disabled: true })
  } catch (error) {
    return handleApiError(error, 'disable 2FA')
  }
}
