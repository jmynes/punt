import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, rateLimitExceeded, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  generateToken,
  getAppUrl,
  getExpirationDate,
  hashToken,
  isEmailFeatureEnabled,
  sendVerificationEmail,
  TOKEN_EXPIRY,
} from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

const sendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
})

/**
 * POST /api/auth/send-verification
 * Request a verification email for the current user
 *
 * Security considerations:
 * - Requires authentication (user must be logged in)
 * - Rate limited per user ID to prevent spam
 * - Old tokens are deleted before creating new ones
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    // Check if email verification is enabled
    const isEnabled = await isEmailFeatureEnabled('verification')
    if (!isEnabled) {
      return NextResponse.json({ error: 'Email verification is not enabled' }, { status: 400 })
    }

    // Rate limit by user ID (3 per hour)
    const rateLimit = await checkRateLimit(currentUser.id, 'auth/send-verification')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    const body = await request.json().catch(() => ({}))
    const parsed = sendVerificationSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    // Get user's full details
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, name: true, email: true, emailVerified: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const targetEmail = parsed.data.email || user.email

    if (!targetEmail) {
      return NextResponse.json({ error: 'No email address to verify' }, { status: 400 })
    }

    // If already verified and same email, no need to re-verify
    if (user.emailVerified && targetEmail === user.email) {
      return NextResponse.json({
        message: 'Email is already verified',
        alreadyVerified: true,
      })
    }

    // If verifying a different email, check it's not taken
    if (targetEmail !== user.email) {
      const existingUser = await db.user.findUnique({
        where: { email: targetEmail },
      })
      if (existingUser) {
        return NextResponse.json({ error: 'Email address is already in use' }, { status: 400 })
      }
    }

    // Delete existing verification tokens for this user
    await db.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    })

    // Generate new token
    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = getExpirationDate(TOKEN_EXPIRY.EMAIL_VERIFICATION)

    // Store hashed token with the email being verified
    await db.emailVerificationToken.create({
      data: {
        tokenHash,
        userId: user.id,
        email: targetEmail,
        expiresAt,
      },
    })

    // Send verification email
    const appUrl = getAppUrl()
    const verifyUrl = `${appUrl}/verify-email?token=${token}`

    await sendVerificationEmail(targetEmail, {
      verifyUrl,
      userName: user.name || undefined,
      email: targetEmail,
      expiresInMinutes: Math.round(TOKEN_EXPIRY.EMAIL_VERIFICATION / (60 * 1000)),
    })

    return NextResponse.json({
      message: 'Verification email sent',
      email: targetEmail,
    })
  } catch (error) {
    return handleApiError(error, 'send verification email')
  }
}
