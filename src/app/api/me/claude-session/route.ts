/**
 * Claude Session Management API
 * Allows users to upload/manage their Claude CLI session credentials
 */

import { z } from 'zod/v4'
import { requireAuth } from '@/lib/auth-helpers'
import {
  decryptSession,
  encryptSession,
  extractMcpServerNames,
  validateSessionCredentials,
} from '@/lib/chat/encryption'
import { db } from '@/lib/db'

const sessionUploadSchema = z.object({
  credentials: z.string().min(1, 'Credentials are required'),
})

/**
 * Parse the user's enabled MCP servers JSON, returning an empty array on failure
 */
function parseEnabledMcpServers(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    // Invalid JSON, return empty
  }
  return []
}

/**
 * Extract available MCP server names from encrypted credentials
 */
function getAvailableMcpServers(encryptedCredentials: string | null | undefined): string[] {
  if (!encryptedCredentials) return []
  try {
    const decrypted = decryptSession(encryptedCredentials)
    const credentials = JSON.parse(decrypted)
    if (validateSessionCredentials(credentials)) {
      return extractMcpServerNames(credentials)
    }
  } catch {
    // Decryption or parse failed
  }
  return []
}

/**
 * GET /api/me/claude-session
 * Check if user has a session configured, including available and enabled MCPs
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: {
        claudeSessionEncrypted: true,
        chatProvider: true,
        enabledMcpServers: true,
      },
    })

    const hasSession = !!user?.claudeSessionEncrypted
    const availableMcpServers = getAvailableMcpServers(user?.claudeSessionEncrypted)
    const enabledMcpServers = parseEnabledMcpServers(user?.enabledMcpServers)

    return Response.json({
      hasSession,
      provider: user?.chatProvider ?? 'anthropic',
      availableMcpServers,
      enabledMcpServers,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/me/claude-session
 * Upload Claude session credentials
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const result = sessionUploadSchema.safeParse(body)

    if (!result.success) {
      return Response.json(
        { error: 'Invalid request', details: result.error.flatten() },
        { status: 400 },
      )
    }

    // Parse and validate credentials
    let credentials: unknown
    try {
      credentials = JSON.parse(result.data.credentials)
    } catch {
      return Response.json(
        { error: 'Invalid JSON format. Please paste the contents of your .credentials.json file.' },
        { status: 400 },
      )
    }

    if (!validateSessionCredentials(credentials)) {
      return Response.json(
        {
          error:
            'Invalid credentials format. Ensure you are uploading the contents of ~/.claude/.credentials.json',
        },
        { status: 400 },
      )
    }

    // Check for encryption secret
    if (!process.env.SESSION_ENCRYPTION_SECRET) {
      return Response.json(
        {
          error:
            'Server is not configured for session storage. Contact your administrator to set SESSION_ENCRYPTION_SECRET.',
        },
        { status: 500 },
      )
    }

    // Extract available MCP servers before encrypting
    const availableMcpServers = extractMcpServerNames(credentials)

    // Encrypt and store
    const encrypted = encryptSession(result.data.credentials)

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        claudeSessionEncrypted: encrypted,
        chatProvider: 'claude-cli',
        // Reset enabled MCPs when new credentials are uploaded
        // (available servers may have changed)
        enabledMcpServers: null,
      },
    })

    return Response.json({
      success: true,
      message: 'Claude session configured successfully',
      availableMcpServers,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.error('Error uploading Claude session:', error)
    return Response.json({ error: 'Failed to save session' }, { status: 500 })
  }
}

/**
 * DELETE /api/me/claude-session
 * Remove Claude session credentials
 */
export async function DELETE() {
  try {
    const currentUser = await requireAuth()

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        claudeSessionEncrypted: null,
        chatProvider: 'anthropic', // Fall back to API
        enabledMcpServers: null, // Clear MCP preferences
      },
    })

    return Response.json({
      success: true,
      message: 'Claude session removed',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/me/claude-session
 * Update provider preference or enabled MCP servers
 */
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const { provider, enabledMcpServers } = body

    // Build update data
    const updateData: Record<string, unknown> = {}

    // Handle provider change
    if (provider !== undefined) {
      if (provider !== 'anthropic' && provider !== 'claude-cli') {
        return Response.json({ error: 'Invalid provider' }, { status: 400 })
      }

      // If switching to claude-cli, verify session exists
      if (provider === 'claude-cli') {
        const user = await db.user.findUnique({
          where: { id: currentUser.id },
          select: { claudeSessionEncrypted: true },
        })

        if (!user?.claudeSessionEncrypted) {
          return Response.json(
            { error: 'Cannot switch to Claude CLI without uploading session credentials first' },
            { status: 400 },
          )
        }
      }

      updateData.chatProvider = provider
    }

    // Handle enabled MCP servers update
    if (enabledMcpServers !== undefined) {
      if (!Array.isArray(enabledMcpServers)) {
        return Response.json({ error: 'enabledMcpServers must be an array' }, { status: 400 })
      }

      // Validate that all entries are strings
      const valid = enabledMcpServers.every((s: unknown) => typeof s === 'string')
      if (!valid) {
        return Response.json(
          { error: 'enabledMcpServers must be an array of strings' },
          { status: 400 },
        )
      }

      // Validate that enabled MCPs are actually available in credentials
      const user = await db.user.findUnique({
        where: { id: currentUser.id },
        select: { claudeSessionEncrypted: true },
      })

      const available = getAvailableMcpServers(user?.claudeSessionEncrypted)
      const invalid = enabledMcpServers.filter((s: string) => !available.includes(s))
      if (invalid.length > 0) {
        return Response.json(
          {
            error: `MCP servers not found in credentials: ${invalid.join(', ')}`,
          },
          { status: 400 },
        )
      }

      updateData.enabledMcpServers = JSON.stringify(enabledMcpServers)
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await db.user.update({
      where: { id: currentUser.id },
      data: updateData,
    })

    return Response.json({
      success: true,
      provider: provider ?? undefined,
      enabledMcpServers: enabledMcpServers ?? undefined,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
