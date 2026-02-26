import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
  confirmation: z.literal('DELETE MY ACCOUNT'),
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

  // If 2FA is enabled, require TOTP code or recovery code
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      // Verify recovery code
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      // Mark recovery code as used
      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      // Verify TOTP code
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null // Success
}

// DELETE /api/me/account - Delete account
export async function DELETE(request: Request) {
  try {
    // Handle demo mode - account deletion not available
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Account deletion is not available in demo mode' },
        { status: 400 },
      )
    }

    const currentUser = await requireAuth()

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'me/account/delete')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const parsed = deleteAccountSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Account deletion validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { password, totpCode, isRecoveryCode } = parsed.data

    // Verify password and 2FA
    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    // Check if user is the sole system admin
    const userInfo = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { isSystemAdmin: true },
    })

    if (userInfo?.isSystemAdmin) {
      const adminCount = await db.user.count({
        where: { isSystemAdmin: true, isActive: true },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only system administrator account' },
          { status: 400 },
        )
      }
    }

    // Delete all sessions for this user first
    await db.session.deleteMany({
      where: { userId: currentUser.id },
    })

    // Hard delete: permanently remove the user
    await db.user.delete({
      where: { id: currentUser.id },
    })

    return NextResponse.json({ success: true, message: 'Account deleted successfully' })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Account disabled') {
        return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
