import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimitExceeded } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp, recordFailedAttempt } from '@/lib/rate-limit'

const checkSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

/**
 * POST /api/auth/check-2fa - Check if user has 2FA enabled
 * Also validates credentials so we don't reveal 2FA status to unauthenticated users.
 * Returns { requires2FA: boolean } after verifying credentials.
 *
 * Rate limiting strategy:
 * - Only counts failed attempts (invalid credentials)
 * - Invalid usernames: IP-based (prevents enumeration from single source)
 * - Valid usernames: username-based (protects specific accounts, can't be bypassed by VPN)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = checkSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { username, password } = parsed.data
    const normalizedUsername = username.normalize('NFC')

    // First check if user exists to determine rate limiting strategy
    const user = await db.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      select: {
        username: true,
        passwordHash: true,
        isActive: true,
        totpEnabled: true,
      },
    })

    // Rate limit by username if user exists, otherwise by IP
    // This prevents username enumeration while still protecting valid accounts
    const rateLimitIdentifier = user ? user.username : getClientIp(request)
    const rateLimit = await checkRateLimit(rateLimitIdentifier, 'auth/login')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    if (!user?.passwordHash || !user.isActive) {
      // Record failed attempt for invalid/inactive user
      await recordFailedAttempt(rateLimitIdentifier, 'auth/login')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      // Record failed attempt for wrong password
      await recordFailedAttempt(rateLimitIdentifier, 'auth/login')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Success - don't record anything, rate limit cleared on actual login success
    return NextResponse.json({ requires2FA: user.totpEnabled })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
