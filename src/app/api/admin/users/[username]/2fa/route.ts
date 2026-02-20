import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'

/**
 * DELETE /api/admin/users/[username]/2fa - Admin reset user's 2FA
 * Disables 2FA and clears all TOTP data for the specified user.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    await requireSystemAdmin()
    const { username } = await params

    if (isDemoMode()) {
      return NextResponse.json({ success: true })
    }

    // Find the target user
    const targetUser = await db.user.findUnique({
      where: { username },
      select: { id: true, totpEnabled: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!targetUser.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled for this user' },
        { status: 400 },
      )
    }

    // Disable 2FA and clear all TOTP data
    await db.user.update({
      where: { id: targetUser.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryCodes: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'reset user 2FA')
  }
}
