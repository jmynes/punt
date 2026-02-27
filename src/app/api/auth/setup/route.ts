import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/password'

/**
 * GET /api/auth/setup
 *
 * Public endpoint that returns whether any users exist in the database.
 * Used by /setup and /login pages to redirect appropriately.
 */
export async function GET() {
  try {
    const userCount = await db.user.count()
    return NextResponse.json({ hasUsers: userCount > 0 })
  } catch (error) {
    console.error('Setup check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const setupSchema = z.object({
  username: z
    .string()
    .transform((s) => s.normalize('NFC'))
    .pipe(
      z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          'Username can only contain letters, numbers, underscores, and hyphens',
        ),
    ),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(1, 'Password is required'),
})

/**
 * POST /api/auth/setup
 *
 * Creates the first admin user. Only works when the database has zero users.
 * This is the browser-based path for first-run setup.
 */
export async function POST(request: Request) {
  try {
    // Race condition guard: only allow when 0 users exist
    const userCount = await db.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. Users already exist.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const parsed = setupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { username, name, email, password } = parsed.data

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 },
      )
    }

    // Hash password and create admin user
    const passwordHash = await hashPassword(password)

    const user = await db.user.create({
      data: {
        username,
        name,
        email: email || null,
        passwordHash,
        isActive: true,
        isSystemAdmin: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
      user,
    })
  } catch (error) {
    // Handle Prisma unique constraint violation (race condition)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This username or email is already taken' },
        { status: 400 },
      )
    }
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
