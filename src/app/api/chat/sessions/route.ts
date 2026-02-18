import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import type { ChatSessionSummary } from '@/types'

const createSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  projectId: z.string().optional(),
})

/**
 * GET /api/chat/sessions - List user's chat sessions
 * Query params: ?projectId=xxx (optional filter)
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const sessions = await db.chatSession.findMany({
      where: {
        userId: user.id,
        ...(projectId && { projectId }),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
      take: 50, // Limit to 50 most recent sessions
    })

    const result: ChatSessionSummary[] = sessions.map((session) => ({
      id: session.id,
      name: session.name,
      projectId: session.projectId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session._count.messages,
      lastMessage: session.messages[0]?.content?.slice(0, 100),
    }))

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'fetch chat sessions')
  }
}

/**
 * POST /api/chat/sessions - Create new session
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const result = createSessionSchema.safeParse(body)

    if (!result.success) {
      return validationError(result)
    }

    const { name, projectId } = result.data

    // If projectId provided, verify user has access
    if (projectId) {
      const membership = await db.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId,
          },
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
      }
    }

    const session = await db.chatSession.create({
      data: {
        name: name || 'New conversation',
        userId: user.id,
        projectId: projectId || null,
      },
    })

    const response: ChatSessionSummary = {
      id: session.id,
      name: session.name,
      projectId: session.projectId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: 0,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create chat session')
  }
}
