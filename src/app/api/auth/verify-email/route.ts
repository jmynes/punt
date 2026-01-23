import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  badRequestError,
  handleApiError,
  rateLimitExceeded,
  validationError,
} from '@/lib/api-utils'
import { db } from '@/lib/db'
import { hashToken, isTokenExpired } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

/**
 * GET /api/auth/verify-email?token=xxx
 * Validate a verification token (check if it's valid and not expired)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    const parsed = verifyTokenSchema.safeParse({ token })
    if (!parsed.success) {
      return validationError(parsed)
    }

    const tokenHash = hashToken(parsed.data.token)

    // Find token in database
    const verificationToken = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    })

    if (!verificationToken) {
      return badRequestError('Invalid or expired verification link')
    }

    if (isTokenExpired(verificationToken.expiresAt)) {
      return badRequestError('This verification link has expired')
    }

    if (!verificationToken.user.isActive) {
      return badRequestError('Invalid or expired verification link')
    }

    return NextResponse.json({
      valid: true,
      email: verificationToken.email,
      currentEmail: verificationToken.user.email,
      willUpdateEmail: verificationToken.email !== verificationToken.user.email,
    })
  } catch (error) {
    return handleApiError(error, 'validate verification token')
  }
}

/**
 * POST /api/auth/verify-email
 * Complete email verification
 */
export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const clientIp = getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'auth/verify-email')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    const body = await request.json()
    const parsed = verifyTokenSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { token } = parsed.data
    const tokenHash = hashToken(token)

    // Find and validate token
    const verificationToken = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    })

    if (!verificationToken) {
      return badRequestError('Invalid or expired verification link')
    }

    if (isTokenExpired(verificationToken.expiresAt)) {
      return badRequestError('This verification link has expired')
    }

    if (!verificationToken.user.isActive) {
      return badRequestError('Invalid or expired verification link')
    }

    // Check if email is being changed and if new email is already taken
    const isEmailChange = verificationToken.email !== verificationToken.user.email
    if (isEmailChange) {
      const existingUser = await db.user.findUnique({
        where: { email: verificationToken.email },
      })
      if (existingUser && existingUser.id !== verificationToken.userId) {
        return badRequestError('Email address is already in use')
      }
    }

    // Update user and delete tokens atomically
    await db.$transaction([
      db.user.update({
        where: { id: verificationToken.userId },
        data: {
          email: verificationToken.email,
          emailVerified: new Date(),
        },
      }),
      // Delete all verification tokens for this user
      db.emailVerificationToken.deleteMany({
        where: { userId: verificationToken.userId },
      }),
    ])

    return NextResponse.json({
      message: 'Email verified successfully',
      email: verificationToken.email,
      emailUpdated: isEmailChange,
    })
  } catch (error) {
    return handleApiError(error, 'verify email')
  }
}
