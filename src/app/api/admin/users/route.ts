import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  badRequestError,
  handleApiError,
  passwordValidationError,
  rateLimitExceeded,
  validationError,
} from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/password'
import { USER_SELECT_ADMIN_LIST, USER_SELECT_CREATED } from '@/lib/prisma-selects'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens',
    ),
  email: z.string().email().optional().or(z.literal('')),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(1, 'Password is required'),
  isSystemAdmin: z.boolean().optional().default(false),
  confirmPassword: z.string().min(1, 'Your password is required to confirm this action'),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

async function verifyReauth(
  userId: string,
  password: string,
  totpCode?: string,
  isRecoveryCode?: boolean,
): Promise<NextResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      totpRecoveryCodes: true,
    },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash)
  if (!isValidPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null // Authentication successful
}

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
      select: USER_SELECT_ADMIN_LIST,
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

    // Map raw key fields to boolean flags (never expose actual keys)
    const safeUsers = filteredUsers.map(
      ({ mcpApiKey, anthropicApiKey, claudeSessionEncrypted, ...user }) => ({
        ...user,
        hasMcpApiKey: Boolean(mcpApiKey),
        hasClaudeChat: Boolean(anthropicApiKey || claudeSessionEncrypted),
      }),
    )

    return NextResponse.json(safeUsers)
  } catch (error) {
    return handleApiError(error, 'list users')
  }
}

/**
 * POST /api/admin/users - Create a new user
 */
export async function POST(request: Request) {
  try {
    const admin = await requireSystemAdmin()

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, 'admin/users')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const {
      username,
      email,
      name,
      password,
      isSystemAdmin,
      confirmPassword,
      totpCode,
      isRecoveryCode,
    } = parsed.data

    // Verify the admin's password (and 2FA if enabled)
    const authError = await verifyReauth(admin.id, confirmPassword, totpCode, isRecoveryCode)
    if (authError) return authError

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return passwordValidationError(passwordValidation.errors)
    }

    // Check if username already exists (case-insensitive)
    const existingUsername = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    })

    if (existingUsername) {
      return badRequestError('Username already exists')
    }

    // Check if email already exists (only if provided)
    if (email) {
      const existingEmail = await db.user.findUnique({
        where: { email },
      })

      if (existingEmail) {
        return badRequestError('Email already exists')
      }
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)

    const user = await db.user.create({
      data: {
        username,
        email: email || null,
        name,
        passwordHash,
        isSystemAdmin,
        isActive: true,
      },
      select: USER_SELECT_CREATED,
    })

    // If user is a system admin, add them to all existing projects
    if (isSystemAdmin) {
      const projects = await db.project.findMany({
        select: {
          id: true,
          roles: {
            where: { name: 'Admin', isDefault: true },
            select: { id: true },
            take: 1,
          },
        },
      })

      for (const project of projects) {
        const adminRole = project.roles[0]
        if (adminRole) {
          await db.projectMember.create({
            data: {
              userId: user.id,
              projectId: project.id,
              roleId: adminRole.id,
            },
          })
        }
      }
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create user')
  }
}
