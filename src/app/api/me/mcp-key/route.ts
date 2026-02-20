import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { encryptSession } from '@/lib/chat/encryption'
import { db } from '@/lib/db'
import { clearMcpKeyFile, writeMcpKeyFile } from '@/lib/mcp-key-file'

/**
 * Hash an MCP API key using SHA-256
 * SHA-256 is appropriate for high-entropy API keys (256 bits of randomness)
 * Unlike passwords, these keys can't be brute-forced due to their entropy
 */
function hashMcpKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
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
 */
export async function POST() {
  try {
    const currentUser = await requireAuth()

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

    // Write key to .mcp-key file for hot-reload by MCP server
    writeMcpKeyFile(apiKey)

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
 */
export async function DELETE() {
  try {
    const currentUser = await requireAuth()

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        mcpApiKey: null,
        mcpApiKeyEncrypted: null,
      },
    })

    // Remove .mcp-key file so MCP server stops using the revoked key
    clearMcpKeyFile()

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'revoke MCP key')
  }
}
