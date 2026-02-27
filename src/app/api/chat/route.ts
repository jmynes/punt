/**
 * POST /api/chat - Streaming chat endpoint with Claude
 * Routes to the appropriate provider based on user preference
 * Optionally persists messages to a chat session
 */

import { z } from 'zod/v4'
import { Prisma } from '@/generated/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { buildSystemPrompt } from '@/lib/chat/context'
import { getUserProvider, type StreamEvent } from '@/lib/chat/providers'
import { db } from '@/lib/db'
import type { ChatToolCall } from '@/types'

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ),
  context: z
    .object({
      projectId: z.string().optional(),
      ticketKey: z.string().optional(),
    })
    .optional(),
  sessionId: z.string().nullish(), // Allow null, undefined, or string
})

/**
 * Generate a session name from the first message
 */
function generateSessionName(firstMessage: string): string {
  let name = firstMessage.slice(0, 50).trim()
  if (firstMessage.length > 50) {
    const lastSpace = name.lastIndexOf(' ')
    if (lastSpace > 20) {
      name = `${name.slice(0, lastSpace)}...`
    } else {
      name = `${name}...`
    }
  }
  return name || 'New conversation'
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const result = chatRequestSchema.safeParse(body)

    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { messages, context, sessionId: providedSessionId } = result.data

    // Get user's preferred provider
    const provider = await getUserProvider(currentUser.id)

    // Check if provider is configured
    const isConfigured = await provider.isConfigured(currentUser.id)
    if (!isConfigured) {
      const providerName = provider.name
      return new Response(
        JSON.stringify({
          error: `${providerName} is not configured. Set it up in Profile > Claude Chat.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Handle session creation/validation
    let sessionId: string = providedSessionId ?? ''
    if (sessionId) {
      // Verify ownership of existing session
      const session = await db.chatSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      })
      if (!session || session.userId !== currentUser.id) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Create new session - get the last user message for the name
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop()
      const sessionName = generateSessionName(lastUserMessage?.content || 'New conversation')

      const session = await db.chatSession.create({
        data: {
          name: sessionName,
          userId: currentUser.id,
          projectId: context?.projectId || null,
        },
      })
      sessionId = session.id
    }

    // Persist the user message (the last one in messages array)
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage && lastUserMessage.role === 'user') {
      await db.chatMessage.create({
        data: {
          role: 'user',
          content: lastUserMessage.content,
          sessionId,
        },
      })
    }

    // Build system prompt with context
    const systemPrompt = await buildSystemPrompt(context ?? {})

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    let controllerClosed = false

    // Collect assistant response for persistence
    let assistantContent = ''
    const toolCalls: ChatToolCall[] = []

    const stream = new ReadableStream({
      async start(controller) {
        const onEvent = (event: StreamEvent) => {
          if (controllerClosed) return

          // Collect content and tool calls for persistence
          if (event.type === 'text' && event.content) {
            assistantContent += event.content
          } else if (event.type === 'tool_start' && event.name) {
            toolCalls.push({
              name: event.name,
              input: event.input || {},
              status: 'running',
            })
          } else if (event.type === 'tool_end' && event.name) {
            const tool = toolCalls.find((t) => t.name === event.name && t.status === 'running')
            if (tool) {
              tool.status = 'completed'
              tool.result = event.result
              tool.success = event.success
            }
          }

          // Also include sessionId in the response for the client
          const eventWithSession = { ...event, sessionId }

          try {
            const data = JSON.stringify(eventWithSession)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } catch {
            // Controller may have been closed
          }
        }

        try {
          await provider.sendMessage({
            messages,
            context,
            userId: currentUser.id,
            systemPrompt,
            onEvent,
          })

          // Persist assistant message after completion
          if (assistantContent || toolCalls.length > 0) {
            await db.chatMessage.create({
              data: {
                role: 'assistant',
                content: assistantContent,
                metadata:
                  toolCalls.length > 0
                    ? ({ toolCalls } as unknown as Prisma.InputJsonValue)
                    : Prisma.DbNull,
                sessionId: sessionId,
              },
            })

            // Update session timestamp
            await db.chatSession.update({
              where: { id: sessionId },
              data: { updatedAt: new Date() },
            })
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An error occurred'
          onEvent({ type: 'error', error: errorMessage })
        }

        controllerClosed = true
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    // Handle auth errors
    if (error instanceof Error && error.message === 'Not authenticated') {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
