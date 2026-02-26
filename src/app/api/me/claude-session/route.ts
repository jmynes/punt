/**
 * Claude Session Management API
 * Allows users to upload/manage their Claude CLI session credentials
 */

import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { requireAuth } from '@/lib/auth-helpers'
import {
  decryptSession,
  encryptSession,
  extractMcpServerNames,
  validateSessionCredentials,
} from '@/lib/chat/encryption'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const sessionUploadSchema = z.object({
  credentials: z.string().min(1, 'Credentials are required'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

const deleteSessionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
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

  return null
}

/**
 * GET /api/me/claude-session
 * Check if user has a session configured and get available MCP servers
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

    // Extract available MCP servers from credentials if present
    let availableMcpServers: string[] = []
    if (user?.claudeSessionEncrypted) {
      try {
        const decrypted = decryptSession(user.claudeSessionEncrypted)
        const credentials = JSON.parse(decrypted)
        availableMcpServers = extractMcpServerNames(credentials)
      } catch {
        // Ignore decryption errors - credentials may be corrupted
      }
    }

    // Parse enabled servers from JSON string
    let enabledMcpServers: string[] = []
    if (user?.enabledMcpServers) {
      try {
        enabledMcpServers = JSON.parse(user.enabledMcpServers)
      } catch {
        // Ignore parse errors
      }
    }

    return Response.json({
      hasSession: !!user?.claudeSessionEncrypted,
      provider: user?.chatProvider || 'anthropic',
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

    const { password, totpCode, isRecoveryCode } = result.data

    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

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

    // Extract available MCP servers and enable all by default
    const availableMcpServers = extractMcpServerNames(credentials as Record<string, unknown>)

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        claudeSessionEncrypted: encrypted,
        chatProvider: 'claude-cli',
        enabledMcpServers: JSON.stringify(availableMcpServers),
      },
    })

    return Response.json({
      success: true,
      message: 'Claude session configured successfully',
      availableMcpServers,
      enabledMcpServers: availableMcpServers,
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
export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const result = deleteSessionSchema.safeParse(body)
    if (!result.success) {
      return Response.json(
        { error: 'Invalid request', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const { password, totpCode, isRecoveryCode } = result.data

    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        claudeSessionEncrypted: null,
        chatProvider: 'anthropic', // Fall back to API
        enabledMcpServers: null,
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

    const updateData: { chatProvider?: string; enabledMcpServers?: string } = {}

    // Handle provider update
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
      ...(provider !== undefined && { provider }),
      ...(enabledMcpServers !== undefined && { enabledMcpServers }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
