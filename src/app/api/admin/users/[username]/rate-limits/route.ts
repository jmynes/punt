import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'

/**
 * DELETE /api/admin/users/[username]/rate-limits - Clear rate limits for a user
 * Removes rate limit entries associated with this username (username-based limits only).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    await requireSystemAdmin()
    const { username } = await params

    if (isDemoMode()) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    // Find the user to verify they exist
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { username: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete rate limit entries where identifier matches the username (case-insensitive)
    // Note: This only clears username-based limits. IP/fingerprint-based limits
    // (like auth/login) must be cleared via the global "Clear all auth rate limits" option.
    const result = await db.rateLimit.deleteMany({
      where: {
        identifier: { equals: user.username, mode: 'insensitive' },
      },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    return handleApiError(error, 'reset user rate limits')
  }
}
