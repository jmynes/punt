import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
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

// PATCH /api/me/password - Change password
export async function PATCH(request: Request) {
  try {
    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      const body = await request.json()
      const parsed = changePasswordSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
      }

      // Validate new password strength even in demo mode for UX consistency
      const passwordValidation = validatePasswordStrength(parsed.data.newPassword)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: 'Password does not meet requirements', details: passwordValidation.errors },
          { status: 400 },
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully (demo mode - changes are not persisted)',
      })
    }

    const currentUser = await requireAuth()

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'me/password')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        },
      )
    }

    const body = await request.json()
    const parsed = changePasswordSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Password change validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { currentPassword, newPassword, totpCode, isRecoveryCode } = parsed.data

    // Verify current password and 2FA
    const authError = await verifyReauth(currentUser.id, currentPassword, totpCode, isRecoveryCode)
    if (authError) return authError

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 },
      )
    }

    // Hash and update password, set passwordChangedAt to invalidate existing sessions
    const newPasswordHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: currentUser.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, message: 'Password changed successfully' })
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
