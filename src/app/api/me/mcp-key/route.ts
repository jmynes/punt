import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/me/mcp-key - Get current MCP API key status
 * Returns whether user has an MCP key (not the key itself for security)
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { mcpApiKey: true },
    })

    return NextResponse.json({
      hasKey: !!user?.mcpApiKey,
      // Only show partial key for identification (first 8 chars)
      keyPreview: user?.mcpApiKey ? `${user.mcpApiKey.slice(0, 8)}...` : null,
    })
  } catch (error) {
    return handleApiError(error, 'get MCP key status')
  }
}

/**
 * POST /api/me/mcp-key - Generate a new MCP API key
 * Replaces any existing key
 */
export async function POST() {
  try {
    const currentUser = await requireAuth()

    // Generate a secure random API key (32 bytes = 44 chars base64)
    const apiKey = randomBytes(32).toString('base64url')

    await db.user.update({
      where: { id: currentUser.id },
      data: { mcpApiKey: apiKey },
    })

    // Return the full key only on creation - user must save it
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
      data: { mcpApiKey: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'revoke MCP key')
  }
}
