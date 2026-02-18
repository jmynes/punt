/**
 * Claude Session Management API
 * Allows users to upload/manage their Claude CLI session credentials
 */

import { z } from 'zod/v4'
import { requireAuth } from '@/lib/auth-helpers'
import { encryptSession, validateSessionCredentials } from '@/lib/chat/encryption'
import { db } from '@/lib/db'

const sessionUploadSchema = z.object({
  credentials: z.string().min(1, 'Credentials are required'),
})

/**
 * GET /api/me/claude-session
 * Check if user has a session configured
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { claudeSessionEncrypted: true, chatProvider: true },
    })

    return Response.json({
      hasSession: !!user?.claudeSessionEncrypted,
      provider: user?.chatProvider || 'anthropic',
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

    // Encrypt and store
    const encrypted = encryptSession(result.data.credentials)

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        claudeSessionEncrypted: encrypted,
        chatProvider: 'claude-cli',
      },
    })

    return Response.json({
      success: true,
      message: 'Claude session configured successfully',
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
 * Update provider preference without changing credentials
 */
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const provider = body.provider

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

    await db.user.update({
      where: { id: currentUser.id },
      data: { chatProvider: provider },
    })

    return Response.json({
      success: true,
      provider,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
