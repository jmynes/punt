import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { encryptSession } from '@/lib/chat/encryption'
import { db } from '@/lib/db'
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
      select: { mcpApiKey: true },
    })

    // Note: Since we now store hashes, we can't show a hint of the original key
    // We can only indicate whether a key exists
    return NextResponse.json({
      hasKey: !!user?.mcpApiKey,
      keyHint: null, // No longer available since keys are hashed
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

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        mcpApiKey: keyHash,
        mcpApiKeyEncrypted: encryptedKey,
      },
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

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        mcpApiKey: null,
        mcpApiKeyEncrypted: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'revoke MCP key')
  }
}
