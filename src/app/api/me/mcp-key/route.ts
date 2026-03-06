import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { encryptSession } from '@/lib/chat/encryption'
import { db } from '@/lib/db'
import { projectEvents } from '@/lib/events'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const reauthSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

/**
 * Hash an MCP API key using SHA-256
 * SHA-256 is appropriate for high-entropy API keys (256 bits of randomness)
 * Unlike passwords, these keys can't be brute-forced due to their entropy
 */
function hashMcpKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

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

  // If 2FA is enabled, require TOTP code or recovery code
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2fa: true }, { status: 401 })
    }

    if (isRecoveryCode) {
      // Verify recovery code
      if (!user.totpRecoveryCodes) {
        return NextResponse.json({ error: 'No recovery codes available' }, { status: 401 })
      }

      const codeIndex = await verifyRecoveryCode(totpCode, user.totpRecoveryCodes)
      if (codeIndex === -1) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 })
      }

      // Mark recovery code as used
      const updatedCodes = markRecoveryCodeUsed(user.totpRecoveryCodes, codeIndex)
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: updatedCodes },
      })
    } else {
      // Verify TOTP code
      const secret = decryptTotpSecret(user.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 })
      }
    }
  }

  return null // Success
}

/**
 * GET /api/me/mcp-key - Get current MCP API key status
 * Returns whether user has an MCP key (we can only check if hash exists,
 * not show a hint since we no longer store the plaintext key)
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { mcpApiKey: true, mcpApiKeyHint: true },
    })

    return NextResponse.json({
      hasKey: !!user?.mcpApiKey,
      keyHint: user?.mcpApiKeyHint ?? null,
    })
  } catch (error) {
    return handleApiError(error, 'get MCP key status')
  }
}

/**
 * POST /api/me/mcp-key - Generate a new MCP API key
 * Format: mcp_ + 64 hex chars (from crypto.randomBytes(32))
 * Stores SHA-256 hash of the key (not plaintext)
 * Replaces any existing key
 * Requires password + 2FA (if enabled) for security
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    // Parse and validate request body
    const body = await request.json()
    const parsed = reauthSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { password, totpCode, isRecoveryCode } = parsed.data

    // Verify re-authentication
    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    // Generate a secure random API key: mcp_ prefix + 64 hex chars
    const apiKey = `mcp_${randomBytes(32).toString('hex')}`

    // Store the SHA-256 hash for API authentication
    // This protects against database breaches for validation
    const keyHash = hashMcpKey(apiKey)

    // Also store encrypted version for Claude CLI chat feature
    // This allows the chat provider to retrieve the raw key
    let encryptedKey: string | null = null
    if (process.env.SESSION_ENCRYPTION_SECRET) {
      encryptedKey = encryptSession(apiKey)
    }

    await db.$transaction(async (tx) => {
      // Clear agent attribution on tickets before deleting old agents
      await tx.ticket.updateMany({
        where: { createdByAgentId: { not: null }, createdByAgent: { ownerId: currentUser.id } },
        data: { createdByAgentId: null },
      })

      // Delete any existing Agent records for this user
      await tx.agent.deleteMany({
        where: { ownerId: currentUser.id },
      })

      // Update the user's MCP key
      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          mcpApiKey: keyHash,
          mcpApiKeyEncrypted: encryptedKey,
          mcpApiKeyHint: apiKey.slice(-4),
        },
      })

      // Count existing agents for this user (including just-deleted ones won't count
      // since they were deleted above, so this effectively counts from prior sessions)
      // We use the ticket count as a proxy for historical agent count
      const existingAgentCount = await tx.agent.count({
        where: { ownerId: currentUser.id },
      })

      // Generate a default name: "{username}'s agent #N"
      const agentNumber = existingAgentCount + 1
      const defaultName = `${currentUser.username}'s agent #${agentNumber}`

      // Create a new Agent record linked to this key
      await tx.agent.create({
        data: {
          name: defaultName,
          apiKeyHash: keyHash,
          ownerId: currentUser.id,
          isActive: true,
        },
      })
    })

    // Notify other tabs/browsers via SSE
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId: request.headers.get('x-tab-id') || undefined,
      timestamp: Date.now(),
      changes: { mcpKeyUpdated: true },
    })

    // Return the full key only on creation - user must save it
    // This is the only time the plaintext key is available
    return NextResponse.json({
      apiKey,
      message: 'Save this key - it will not be shown again',
    })
  } catch (error) {
    return handleApiError(error, 'generate MCP key')
  }
}

/**
 * DELETE /api/me/mcp-key - Revoke MCP API key
 * Requires password + 2FA (if enabled) for security
 */
export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAuth()

    // Parse and validate request body
    const body = await request.json()
    const parsed = reauthSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { password, totpCode, isRecoveryCode } = parsed.data

    // Verify re-authentication
    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    await db.$transaction(async (tx) => {
      // Clear agent attribution on tickets before deleting agents
      await tx.ticket.updateMany({
        where: { createdByAgentId: { not: null }, createdByAgent: { ownerId: currentUser.id } },
        data: { createdByAgentId: null },
      })

      // Delete all agent records for this user
      await tx.agent.deleteMany({
        where: { ownerId: currentUser.id },
      })

      // Clear the user's MCP key
      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          mcpApiKey: null,
          mcpApiKeyEncrypted: null,
          mcpApiKeyHint: null,
        },
      })
    })

    // Notify other tabs/browsers via SSE
    projectEvents.emitUserEvent({
      type: 'user.updated',
      userId: currentUser.id,
      tabId: request.headers.get('x-tab-id') || undefined,
      timestamp: Date.now(),
      changes: { mcpKeyUpdated: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'revoke MCP key')
  }
}
