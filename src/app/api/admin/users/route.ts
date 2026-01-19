import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens',
    ),
  email: z.string().email(),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(1, 'Password is required'),
  isSystemAdmin: z.boolean().optional().default(false),
})

/**
 * GET /api/admin/users - List all users
 * Query params:
 *   - search: filter by name or email
 *   - sort: 'name' | 'lastLoginAt' | 'createdAt' (default: 'name')
 *   - sortDir: 'asc' | 'desc' (default: 'asc')
 *   - role: 'all' | 'admin' | 'standard' (default: 'all')
 *   - minProjects: minimum number of projects
 *   - maxProjects: maximum number of projects
 */
export async function GET(request: Request) {
  try {
    await requireSystemAdmin()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'name'
    const sortDir = searchParams.get('sortDir') || 'asc'
    const role = searchParams.get('role') || 'all'
    const minProjects = searchParams.get('minProjects')
    const maxProjects = searchParams.get('maxProjects')

    // Build where clause
    type WhereClause = {
      OR?: Array<{ name: { contains: string } } | { email: { contains: string } }>
      isSystemAdmin?: boolean
    }
    const where: WhereClause = {}

    if (search) {
      where.OR = [{ name: { contains: search } }, { email: { contains: search } }]
    }

    if (role === 'admin') {
      where.isSystemAdmin = true
    } else if (role === 'standard') {
      where.isSystemAdmin = false
    }

    // Build orderBy clause
    type OrderByField = 'name' | 'lastLoginAt' | 'createdAt'
    const validSortFields: OrderByField[] = ['name', 'lastLoginAt', 'createdAt']
    const sortField: OrderByField = validSortFields.includes(sort as OrderByField)
      ? (sort as OrderByField)
      : 'name'
    const sortDirection = sortDir === 'desc' ? 'desc' : 'asc'

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { [sortField]: sortDirection },
    })

    // Filter by project count (done in JS since Prisma doesn't support _count filtering)
    let filteredUsers = users
    if (minProjects !== null && minProjects !== '') {
      const min = parseInt(minProjects, 10)
      if (!Number.isNaN(min)) {
        filteredUsers = filteredUsers.filter((u) => u._count.projects >= min)
      }
    }
    if (maxProjects !== null && maxProjects !== '') {
      const max = parseInt(maxProjects, 10)
      if (!Number.isNaN(max)) {
        filteredUsers = filteredUsers.filter((u) => u._count.projects <= max)
      }
    }

    return NextResponse.json(filteredUsers)
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
 * POST /api/admin/users - Create a new user
 */
export async function POST(request: Request) {
  try {
    await requireSystemAdmin()

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'admin/users')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
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
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { username, email, name, password, isSystemAdmin } = parsed.data

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 },
      )
    }

    // Check if username already exists
    const existingUsername = await db.user.findUnique({
      where: { username },
    })

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Check if email already exists
    const existingEmail = await db.user.findUnique({
      where: { email },
    })

    if (existingEmail) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)

    const user = await db.user.create({
      data: {
        username,
        email,
        name,
        passwordHash,
        isSystemAdmin,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSystemAdmin: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to create user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
