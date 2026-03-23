import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

/**
 * Hash an MCP API key using SHA-256
 * SHA-256 is appropriate for high-entropy API keys (256 bits of randomness)
 */
function hashMcpKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

const createKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Key name is required')
    .max(100, 'Key name must be 100 characters or less')
    .trim(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

/**
 * Verify user re-authentication (password + optional 2FA/recovery code)
 * Returns error response if verification fails, null if successful
 */
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

  return null
}

/**
 * GET /api/me/mcp-keys - List all MCP API keys for the current user
 * Returns prefix, name, dates only - never the full key or hash
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const keys = await db.mcpApiKey.findMany({
      where: { userId: currentUser.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(keys)
  } catch (error) {
    return handleApiError(error, 'list MCP keys')
  }
}

/**
 * POST /api/me/mcp-keys - Create a new named MCP API key
 * Returns the full key ONCE on creation - user must save it
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const parsed = createKeySchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { name, password, totpCode, isRecoveryCode } = parsed.data

    // Verify re-authentication
    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    // Limit number of keys per user (reasonable cap)
    const existingCount = await db.mcpApiKey.count({
      where: { userId: currentUser.id },
    })
    if (existingCount >= 25) {
      return NextResponse.json(
        { error: 'Maximum of 25 API keys per user. Please revoke unused keys.' },
        { status: 400 },
      )
    }

    // Generate a secure random API key: mcp_ prefix + 64 hex chars
    const apiKey = `mcp_${randomBytes(32).toString('hex')}`
    const keyHash = hashMcpKey(apiKey)
    const keyPrefix = apiKey.slice(0, 12) // "mcp_" + first 8 hex chars

    const newKey = await db.mcpApiKey.create({
      data: {
        name,
        keyHash,
        keyPrefix,
        userId: currentUser.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    })

    // Notify other tabs/browsers via SSE
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId: request.headers.get('x-tab-id') || undefined,
      timestamp: Date.now(),
      changes: { mcpKeyUpdated: true },
    })

    // Return the full key only on creation
    return NextResponse.json({
      ...newKey,
      apiKey,
      message: 'Save this key - it will not be shown again',
    })
  } catch (error) {
    return handleApiError(error, 'create MCP key')
  }
}
