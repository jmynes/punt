import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, rateLimitExceeded, validationError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import {
  generateToken,
  getAppUrl,
  getExpirationDate,
  hashToken,
  isEmailFeatureEnabled,
  sendPasswordResetEmail,
  TOKEN_EXPIRY,
} from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 *
 * Security considerations:
 * - Same response regardless of whether email exists (prevents enumeration)
 * - Rate limited per email address to prevent abuse
 * - Tokens are hashed before storage
 * - Old tokens for the same user are invalidated
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { email } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check if password reset emails are enabled
    const isEnabled = await isEmailFeatureEnabled('passwordReset')
    if (!isEnabled) {
      // Return same response as success to not reveal configuration
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Rate limit by email to prevent enumeration attacks
    const rateLimit = await checkRateLimit(normalizedEmail, 'auth/forgot-password')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    // Also rate limit by IP to prevent mass enumeration from single source
    const clientIp = getClientIp(request)
    const ipRateLimit = await checkRateLimit(clientIp, 'auth/forgot-password')
    if (!ipRateLimit.allowed) {
      return rateLimitExceeded(ipRateLimit)
    }

    // Find user by email (if exists)
    const user = await db.user.findFirst({
      where: {
        email: normalizedEmail,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Always return success response to prevent email enumeration
    // But only send email if user exists
    if (user?.email) {
      // Delete any existing password reset tokens for this user
      await db.passwordResetToken.deleteMany({
        where: { userId: user.id },
      })

      // Generate new token
      const token = generateToken()
      const tokenHash = hashToken(token)
      const expiresAt = getExpirationDate(TOKEN_EXPIRY.PASSWORD_RESET)

      // Store hashed token
      await db.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      })

      // Send password reset email
      const appUrl = getAppUrl()
      const resetUrl = `${appUrl}/reset-password?token=${token}`

      await sendPasswordResetEmail(user.email, {
        resetUrl,
        userName: user.name || undefined,
        expiresInMinutes: Math.round(TOKEN_EXPIRY.PASSWORD_RESET / (60 * 1000)),
      })
    }

    // Same response regardless of whether email exists
    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    return handleApiError(error, 'process forgot password request')
  }
}
