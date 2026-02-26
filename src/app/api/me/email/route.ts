import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { DEMO_USER, isDemoMode } from '@/lib/demo/demo-config'
import {
  generateToken,
  getAppUrl,
  getExpirationDate,
  hashToken,
  isEmailFeatureEnabled,
  sendVerificationEmail,
  TOKEN_EXPIRY,
} from '@/lib/email'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const updateEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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

// PATCH /api/me/email - Update email address (requires password confirmation)
export async function PATCH(request: Request) {
  try {
    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      const body = await request.json()
      const parsed = updateEmailSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
      }

      return NextResponse.json({
        id: DEMO_USER.id,
        email: parsed.data.email,
        name: DEMO_USER.name,
        avatar: DEMO_USER.avatar,
        isSystemAdmin: DEMO_USER.isSystemAdmin,
        createdAt: DEMO_USER.createdAt,
        updatedAt: new Date(),
      })
    }

    const currentUser = await requireAuth()

    // Rate limiting - prevents brute force password guessing via email change
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'me/email')
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
    const parsed = updateEmailSchema.safeParse(body)

    if (!parsed.success) {
      // Log detailed errors server-side, return generic error to client
      console.error('Email update validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { email, password, totpCode, isRecoveryCode } = parsed.data

    // Verify password and 2FA
    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    // Check if email is the same
    const currentUserData = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true },
    })

    if (email === currentUserData?.email) {
      return NextResponse.json({ error: 'Email is the same as current email' }, { status: 400 })
    }

    // Check email uniqueness
    const emailExists = await db.user.findUnique({
      where: { email },
    })
    if (emailExists) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    // Check if email verification is enabled
    const isVerificationEnabled = await isEmailFeatureEnabled('verification')

    // Update email (clear emailVerified if verification is enabled)
    const updatedUser = await db.user.update({
      where: { id: currentUser.id },
      data: {
        email,
        emailVerified: isVerificationEnabled ? null : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Send verification email if enabled
    if (isVerificationEnabled) {
      // Delete any existing verification tokens
      await db.emailVerificationToken.deleteMany({
        where: { userId: currentUser.id },
      })

      // Generate new verification token
      const token = generateToken()
      const tokenHash = hashToken(token)
      const expiresAt = getExpirationDate(TOKEN_EXPIRY.EMAIL_VERIFICATION)

      await db.emailVerificationToken.create({
        data: {
          tokenHash,
          userId: currentUser.id,
          email,
          expiresAt,
        },
      })

      // Send verification email to new address
      const appUrl = getAppUrl()
      const verifyUrl = `${appUrl}/verify-email?token=${token}`

      sendVerificationEmail(email, {
        verifyUrl,
        email,
        expiresInMinutes: Math.round(TOKEN_EXPIRY.EMAIL_VERIFICATION / (60 * 1000)),
      }).catch((err) => {
        console.error('Failed to send verification email:', err)
      })
    }

    // Emit SSE event for email update
    const tabId = request.headers.get('x-tab-id') || undefined
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId,
      timestamp: Date.now(),
    })

    return NextResponse.json(updatedUser)
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
