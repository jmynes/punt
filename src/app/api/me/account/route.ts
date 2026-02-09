import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
  confirmation: z.literal('DELETE MY ACCOUNT'),
})

// DELETE /api/me/account - Delete account
export async function DELETE(request: Request) {
  try {
    // Handle demo mode - account deletion not available
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Account deletion is not available in demo mode' },
        { status: 400 },
      )
    }

    const currentUser = await requireAuth()

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'me/account/delete')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const parsed = deleteAccountSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Account deletion validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { password } = parsed.data

    // Get user with password hash
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true, isSystemAdmin: true },
    })

    if (!user?.passwordHash) {
      return NextResponse.json({ error: 'Cannot delete this account type' }, { status: 400 })
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 })
    }

    // Check if user is the sole system admin
    if (user.isSystemAdmin) {
      const adminCount = await db.user.count({
        where: { isSystemAdmin: true, isActive: true },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only system administrator account' },
          { status: 400 },
        )
      }
    }

    // Delete all sessions for this user first
    await db.session.deleteMany({
      where: { userId: currentUser.id },
    })

    // Hard delete: permanently remove the user
    await db.user.delete({
      where: { id: currentUser.id },
    })

    return NextResponse.json({ success: true, message: 'Account deleted successfully' })
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
