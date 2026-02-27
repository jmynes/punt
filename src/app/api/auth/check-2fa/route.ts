import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimitExceeded } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const checkSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

/**
 * POST /api/auth/check-2fa - Check if user has 2FA enabled
 * Also validates credentials so we don't reveal 2FA status to unauthenticated users.
 * Returns { requires2FA: boolean } after verifying credentials.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'auth/login')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    const body = await request.json()
    const parsed = checkSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { username, password } = parsed.data
    const normalizedUsername = username.normalize('NFC')

    const user = await db.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      select: {
        passwordHash: true,
        isActive: true,
        totpEnabled: true,
      },
    })

    if (!user?.passwordHash || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    return NextResponse.json({ requires2FA: user.totpEnabled })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
