import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import type { ChatMessageData, ChatMessageMetadata } from '@/types'

const addMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  metadata: z
    .object({
      toolCalls: z
        .array(
          z.object({
            name: z.string(),
            input: z.record(z.string(), z.unknown()),
            result: z.string().optional(),
            success: z.boolean().optional(),
            status: z.enum(['pending', 'running', 'completed']),
          }),
        )
        .optional(),
      error: z.string().optional(),
    })
    .optional(),
})

/**
 * POST /api/chat/sessions/[sessionId]/messages - Add message to session
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireAuth()
    const { sessionId } = await params
    const body = await request.json()

    const validationResult = addMessageSchema.safeParse(body)
    if (!validationResult.success) {
      return validationError(validationResult)
    }

    // Verify ownership
    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      return notFoundError('Chat session')
    }

    if (session.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to add messages to this session' },
        { status: 403 },
      )
    }

    const { role, content, metadata } = validationResult.data

    const message = await db.chatMessage.create({
      data: {
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
        sessionId,
      },
    })

    // Update session's updatedAt timestamp
    await db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    })

    const result: ChatMessageData = {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: message.content,
      metadata: metadata as ChatMessageMetadata | null,
      createdAt: message.createdAt,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'add chat message')
  }
}
