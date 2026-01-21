import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const registerSchema = z.object({
  username: z
    .string()
    .transform((s) => s.normalize('NFC')) // Normalize Unicode to prevent lookalike character attacks
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

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'auth/register')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        },
      )
    }

    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Registration validation error:', parsed.error.flatten())
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { username, name, email, password } = parsed.data

    // Check if username already exists
    const existingUsername = await db.user.findUnique({
      where: { username },
    })

    if (existingUsername) {
      return NextResponse.json({ error: 'This username is already taken' }, { status: 400 })
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.user.findUnique({
        where: { email },
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 400 },
        )
      }
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 },
      )
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)

    try {
      const user = await db.user.create({
        data: {
          username,
          name,
          email: email || null,
          passwordHash,
          isActive: true,
          isSystemAdmin: false,
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
        message: 'Account created successfully',
        user,
      })
    } catch (dbError) {
      // Handle Prisma unique constraint violation (race condition on duplicate username/email)
      if (dbError && typeof dbError === 'object' && 'code' in dbError && dbError.code === 'P2002') {
        return NextResponse.json(
          { error: 'This username or email is already taken' },
          { status: 400 },
        )
      }
      throw dbError
    }
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
