import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isEmailFeatureEnabled } from '@/lib/email'

/**
 * GET /api/me/verification-status
 * Get current user's email verification status
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: {
        email: true,
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const emailVerificationEnabled = await isEmailFeatureEnabled('verification')

    return NextResponse.json({
      email: user.email,
      emailVerified: !!user.emailVerified,
      emailVerificationEnabled,
    })
  } catch (error) {
    return handleApiError(error, 'get verification status')
  }
}
