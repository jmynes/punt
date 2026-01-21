import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/password'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().optional(),
  isSystemAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/admin/users/[userId] - Get a specific user
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireSystemAdmin()

    const { userId } = await params

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { projects: true },
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
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users/[userId] - Update a user
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const currentUser = await requireSystemAdmin()
    const { userId } = await params

    // Prevent self-demotion
    if (userId === currentUser.id) {
      const body = await request.json()
      if (body.isSystemAdmin === false || body.isActive === false) {
        return NextResponse.json(
          { error: 'Cannot remove your own admin privileges or disable your own account' },
          { status: 400 },
        )
      }
    }

    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Admin user update validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const updates = parsed.data

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check email uniqueness if being updated
    if (updates.email && updates.email !== existingUser.email) {
      const emailExists = await db.user.findUnique({
        where: { email: updates.email },
      })
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    // Validate and hash password if being updated
    let passwordHash: string | undefined
    if (updates.password) {
      const passwordValidation = validatePasswordStrength(updates.password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: 'Password does not meet requirements', details: passwordValidation.errors },
          { status: 400 },
        )
      }
      passwordHash = await hashPassword(updates.password)
    }

    // Update user
    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.email && { email: updates.email }),
        ...(passwordHash && { passwordHash }),
        ...(updates.isSystemAdmin !== undefined && { isSystemAdmin: updates.isSystemAdmin }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to update user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[userId] - Delete or disable a user
 * Query params:
 *   - permanent=true: Hard delete (permanently remove from database)
 *   - permanent=false or omitted: Soft delete (disable the account)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const currentUser = await requireSystemAdmin()
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (permanent) {
      // Hard delete: remove all sessions first, then delete user
      await db.session.deleteMany({
        where: { userId },
      })
      await db.user.delete({
        where: { id: userId },
      })
      return NextResponse.json({ success: true, action: 'deleted' })
    } else {
      // Soft delete: deactivate the user
      await db.user.update({
        where: { id: userId },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true, action: 'disabled' })
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
