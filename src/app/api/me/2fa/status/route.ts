import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { countRemainingRecoveryCodes } from '@/lib/totp'

/**
 * GET /api/me/2fa/status - Get 2FA status and recovery code count
 */
export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({
        enabled: false,
        recoveryCodesRemaining: 0,
      })
    }

    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { totpEnabled: true, totpRecoveryCodes: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const recoveryCodesRemaining =
      user.totpEnabled && user.totpRecoveryCodes
        ? countRemainingRecoveryCodes(user.totpRecoveryCodes)
        : 0

    return NextResponse.json({
      enabled: user.totpEnabled,
      recoveryCodesRemaining,
    })
  } catch (error) {
    return handleApiError(error, 'get 2FA status')
  }
}
