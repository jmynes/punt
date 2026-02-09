import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { DEMO_USER, isDemoMode } from '@/lib/demo/demo-config'
import { projectEvents } from '@/lib/events'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

// GET /api/me - Get current user's profile
export async function GET() {
  try {
    // Handle demo mode - return demo user data
    if (isDemoMode()) {
      return NextResponse.json({
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        name: DEMO_USER.name,
        avatar: DEMO_USER.avatar,
        isSystemAdmin: DEMO_USER.isSystemAdmin,
        createdAt: DEMO_USER.createdAt,
        updatedAt: DEMO_USER.updatedAt,
        _count: {
          projects: 1,
          assignedTickets: 0,
          createdTickets: 0,
        },
      })
    }

    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projects: true,
            assignedTickets: true,
            createdTickets: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
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

// PATCH /api/me - Update profile (name, email)
export async function PATCH(request: Request) {
  try {
    // Handle demo mode - return success without persisting
    if (isDemoMode()) {
      const body = await request.json()
      const parsed = updateProfileSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
      }

      return NextResponse.json({
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        name: parsed.data.name,
        avatar: DEMO_USER.avatar,
        isSystemAdmin: DEMO_USER.isSystemAdmin,
        createdAt: DEMO_USER.createdAt,
        updatedAt: new Date(),
      })
    }

    const currentUser = await requireAuth()

    const body = await request.json()
    const parsed = updateProfileSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Profile update validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { name } = parsed.data

    const user = await db.user.update({
      where: { id: currentUser.id },
      data: { name },
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

    // Emit SSE event for profile update
    const tabId = request.headers.get('x-tab-id') || undefined
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId,
      timestamp: Date.now(),
      changes: { name },
    })

    return NextResponse.json(user)
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
