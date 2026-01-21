import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'

const updateEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// PATCH /api/me/email - Update email address (requires password confirmation)
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const parsed = updateEmailSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { email, password } = parsed.data

    // Get current user with password hash
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true, email: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Check if email is the same
    if (email === user.email) {
      return NextResponse.json({ error: 'Email is the same as current email' }, { status: 400 })
    }

    // Check email uniqueness
    const emailExists = await db.user.findUnique({
      where: { email },
    })
    if (emailExists) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    // Update email
    const updatedUser = await db.user.update({
      where: { id: currentUser.id },
      data: { email },
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
