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

const revokeSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

/**
 * Verify user re-authentication (password + optional 2FA/recovery code)
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
 * DELETE /api/me/mcp-keys/[keyId] - Revoke a specific MCP API key
 * Requires password + 2FA (if enabled) for security
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const currentUser = await requireAuth()
    const { keyId } = await params

    // Verify the key belongs to the current user
    const key = await db.mcpApiKey.findUnique({
      where: { id: keyId },
      select: { userId: true },
    })

    if (!key || key.userId !== currentUser.id) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = revokeSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { password, totpCode, isRecoveryCode } = parsed.data

    // Verify re-authentication
    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    // Delete the key
    await db.mcpApiKey.delete({
      where: { id: keyId },
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
