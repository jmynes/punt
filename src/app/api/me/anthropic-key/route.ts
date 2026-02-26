import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import {
  decryptTotpSecret,
  markRecoveryCodeUsed,
  verifyRecoveryCode,
  verifyTotpToken,
} from '@/lib/totp'

const storeKeySchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .regex(/^sk-ant-/, 'Invalid Anthropic API key format (should start with sk-ant-)'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
  isRecoveryCode: z.boolean().optional(),
})

const deleteKeySchema = z.object({
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
 * GET /api/me/anthropic-key - Get Anthropic API key status
 * Returns whether user has a key and a hint (last 4 chars) for identification
 */
export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { anthropicApiKey: true },
    })

    return NextResponse.json({
      hasKey: !!user?.anthropicApiKey,
      keyHint: user?.anthropicApiKey ? user.anthropicApiKey.slice(-4) : null,
    })
  } catch (error) {
    return handleApiError(error, 'get Anthropic key status')
  }
}

/**
 * POST /api/me/anthropic-key - Store user's Anthropic API key
 * User provides their own key (not generated)
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()
    const body = await request.json()

    const result = storeKeySchema.safeParse(body)
    if (!result.success) {
      return validationError(result)
    }

    const { apiKey, password, totpCode, isRecoveryCode } = result.data

    // Validate the key format more thoroughly
    if (!apiKey.startsWith('sk-ant-')) {
      return badRequestError('Invalid Anthropic API key format')
    }

    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    await db.user.update({
      where: { id: currentUser.id },
      data: { anthropicApiKey: apiKey },
    })

    return NextResponse.json({
      success: true,
      message: 'Anthropic API key saved',
      keyHint: apiKey.slice(-4),
    })
  } catch (error) {
    return handleApiError(error, 'store Anthropic key')
  }
}

/**
 * DELETE /api/me/anthropic-key - Remove Anthropic API key
 */
export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const result = deleteKeySchema.safeParse(body)
    if (!result.success) {
      return validationError(result)
    }

    const { password, totpCode, isRecoveryCode } = result.data

    const authError = await verifyReauth(currentUser.id, password, totpCode, isRecoveryCode)
    if (authError) return authError

    await db.user.update({
      where: { id: currentUser.id },
      data: { anthropicApiKey: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'remove Anthropic key')
  }
}
