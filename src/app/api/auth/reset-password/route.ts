import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  badRequestError,
  handleApiError,
  passwordValidationError,
  rateLimitExceeded,
  validationError,
} from '@/lib/api-utils'
import { db } from '@/lib/db'
import { hashToken, isTokenExpired } from '@/lib/email'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
})

const validateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

/**
 * GET /api/auth/reset-password?token=xxx
 * Validate a password reset token (check if it's valid and not expired)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    const parsed = validateTokenSchema.safeParse({ token })
    if (!parsed.success) {
      return validationError(parsed)
    }

    const tokenHash = hashToken(parsed.data.token)

    // Find token in database
    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    })

    if (!resetToken) {
      return badRequestError('Invalid or expired reset link')
    }

    if (resetToken.usedAt) {
      return badRequestError('This reset link has already been used')
    }

    if (isTokenExpired(resetToken.expiresAt)) {
      return badRequestError('This reset link has expired')
    }

    if (!resetToken.user.isActive) {
      return badRequestError('Invalid or expired reset link')
    }

    return NextResponse.json({
      valid: true,
      email: resetToken.user.email,
    })
  } catch (error) {
    return handleApiError(error, 'validate reset token')
  }
}

/**
 * POST /api/auth/reset-password
 * Complete password reset with new password
 */
export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const clientIp = getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'auth/reset-password')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { token, password } = parsed.data
    const tokenHash = hashToken(token)

    // Find and validate token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    })

    if (!resetToken) {
      return badRequestError('Invalid or expired reset link')
    }

    if (resetToken.usedAt) {
      return badRequestError('This reset link has already been used')
    }

    if (isTokenExpired(resetToken.expiresAt)) {
      return badRequestError('This reset link has expired')
    }

    if (!resetToken.user.isActive) {
      return badRequestError('Invalid or expired reset link')
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return passwordValidationError(passwordValidation.errors)
    }

    // Hash new password
    const passwordHash = await hashPassword(password)

    // Update password and mark token as used in a transaction
    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
        },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Delete all other reset tokens for this user
      db.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ])

    return NextResponse.json({
      message: 'Password has been reset successfully',
    })
  } catch (error) {
    return handleApiError(error, 'reset password')
  }
}
