import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { badRequestError, handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

const storeKeySchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .regex(/^sk-ant-/, 'Invalid Anthropic API key format (should start with sk-ant-)'),
})

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

    const { apiKey } = result.data

    // Validate the key format more thoroughly
    if (!apiKey.startsWith('sk-ant-')) {
      return badRequestError('Invalid Anthropic API key format')
    }

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
export async function DELETE() {
  try {
    const currentUser = await requireAuth()

    await db.user.update({
      where: { id: currentUser.id },
      data: { anthropicApiKey: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'remove Anthropic key')
  }
}
