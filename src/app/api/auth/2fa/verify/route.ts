import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, rateLimitExceeded, validationError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  decryptTotpSecret,
  isTotpReplay,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const verifySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  code: z.string().min(1, 'Verification code is required'),
  isRecoveryCode: z.boolean().optional().default(false),
})

/**
 * POST /api/auth/2fa/verify - Verify TOTP code during login
 * This is called after the initial password verification when the user has 2FA enabled.
 * Re-verifies credentials + TOTP code before returning user data for session creation.
 *
 * Rate limiting strategy:
 * - Invalid usernames: IP-based (prevents enumeration from single source)
 * - Valid usernames: username-based (protects specific accounts, can't be bypassed by VPN)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = verifySchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { username, password, code, isRecoveryCode } = parsed.data

    // Normalize username to NFC
    const normalizedUsername = username.normalize('NFC')

    // First check if user exists to determine rate limiting strategy
    const user = await db.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        isActive: true,
        totpEnabled: true,
        totpSecret: true,
        totpRecoveryCodes: true,
        totpLastUsedAt: true,
      },
    })

    // Rate limit by username if user exists, otherwise by IP
    // This prevents username enumeration while still protecting valid accounts
    const rateLimitIdentifier = user ? user.username : getClientIp(request)
    const rateLimit = await checkRateLimit(rateLimitIdentifier, 'auth/2fa')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    if (!user?.passwordHash || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ error: '2FA is not enabled for this account' }, { status: 400 })
    }

    if (isRecoveryCode) {
      // Verify recovery code
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 400 })
      }

      // Normalize recovery code: uppercase, ensure dash format
      const normalizedCode = code.toUpperCase().trim()

      const matchIndex = await verifyRecoveryCode(normalizedCode, user.totpRecoveryCodes)
      if (matchIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      // Mark the recovery code as used
      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, matchIndex)
      await db.user.update({
        where: { id: user.id },
        data: { totpRecoveryCodes: updatedCodes },
      })

      // Update last login timestamp
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      return NextResponse.json({ verified: true, usedRecoveryCode: true })
    }

    // Verify TOTP code
    const secret = decryptTotpSecret(user.totpSecret)
    const isValid = verifyTotpToken(code, secret)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 })
    }

    // Replay protection: reject if the same time window was already used
    if (isTotpReplay(user.totpLastUsedAt)) {
      return NextResponse.json(
        { error: 'This code was already used. Please wait for a new code.' },
        { status: 401 },
      )
    }

    // Don't update totpLastUsedAt here - let the signIn callback handle it
    // This endpoint is just for pre-validation to get proper error messages
    return NextResponse.json({ verified: true })
  } catch (error) {
    return handleApiError(error, 'verify 2FA login')
  }
}
