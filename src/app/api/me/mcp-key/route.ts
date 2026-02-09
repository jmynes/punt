import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/me/mcp-key - Get current MCP API key status
 * Returns whether user has an MCP key and a hint (last 4 chars) for identification
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
      keyHint: user?.mcpApiKey ? user.mcpApiKey.slice(-4) : null,
    })
  } catch (error) {
    return handleApiError(error, 'get MCP key status')
  }
}

/**
 * POST /api/me/mcp-key - Generate a new MCP API key
 * Format: mcp_ + 64 hex chars (from crypto.randomBytes(32))
 * Replaces any existing key
 */
export async function POST() {
  try {
    const currentUser = await requireAuth()

    // Generate a secure random API key: mcp_ prefix + 64 hex chars
    const apiKey = `mcp_${randomBytes(32).toString('hex')}`

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
