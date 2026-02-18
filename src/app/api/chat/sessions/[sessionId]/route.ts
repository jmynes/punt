import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, notFoundError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import type { ChatMessageData, ChatMessageMetadata, ChatSessionWithMessages } from '@/types'

const updateSessionSchema = z.object({
  name: z.string().min(1).max(100),
})

/**
 * GET /api/chat/sessions/[sessionId] - Get session with messages
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireAuth()
    const { sessionId } = await params

    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { messages: true },
        },
      },
    })

    if (!session) {
      return notFoundError('Chat session')
    }

    // Verify ownership
    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to access this session' }, { status: 403 })
    }

    const messages: ChatMessageData[] = session.messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      metadata: msg.metadata ? (JSON.parse(msg.metadata) as ChatMessageMetadata) : null,
      createdAt: msg.createdAt,
    }))

    const result: ChatSessionWithMessages = {
      id: session.id,
      name: session.name,
      projectId: session.projectId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session._count.messages,
      lastMessage: messages[messages.length - 1]?.content?.slice(0, 100),
      messages,
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'fetch chat session')
  }
}

/**
 * PATCH /api/chat/sessions/[sessionId] - Rename session
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireAuth()
    const { sessionId } = await params
    const body = await request.json()

    const validationResult = updateSessionSchema.safeParse(body)
    if (!validationResult.success) {
      return validationError(validationResult)
    }

    // Verify ownership
    const existing = await db.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!existing) {
      return notFoundError('Chat session')
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to modify this session' }, { status: 403 })
    }

    const session = await db.chatSession.update({
      where: { id: sessionId },
      data: { name: validationResult.data.name },
    })

    return NextResponse.json({
      id: session.id,
      name: session.name,
      updatedAt: session.updatedAt,
    })
  } catch (error) {
    return handleApiError(error, 'update chat session')
  }
}

/**
 * DELETE /api/chat/sessions/[sessionId] - Delete session
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireAuth()
    const { sessionId } = await params

    // Verify ownership
    const existing = await db.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!existing) {
      return notFoundError('Chat session')
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this session' }, { status: 403 })
    }

    await db.chatSession.delete({
      where: { id: sessionId },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error, 'delete chat session')
  }
}
