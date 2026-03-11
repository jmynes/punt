import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'

/**
 * DELETE /api/admin/rate-limits - Clear all auth-related rate limits
 * Removes all rate limit entries for auth/login and auth/2fa endpoints.
 * Both use username-based rate limiting.
 */
export async function DELETE() {
  try {
    await requireSystemAdmin()

    if (isDemoMode()) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    // Delete all auth-related rate limit entries
    const result = await db.rateLimit.deleteMany({
      where: {
        endpoint: { in: ['auth/login', 'auth/2fa'] },
      },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    return handleApiError(error, 'clear auth rate limits')
  }
}
