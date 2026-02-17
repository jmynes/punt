/**
 * POST /api/chat - Streaming chat endpoint with Claude
 * Routes to the appropriate provider based on user preference
 */

import { z } from 'zod/v4'
import { requireAuth } from '@/lib/auth-helpers'
import { buildSystemPrompt } from '@/lib/chat/context'
import { getUserProvider, type StreamEvent } from '@/lib/chat/providers'

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
})

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

    const { messages, context } = result.data

    // Get user's preferred provider
    const provider = await getUserProvider(currentUser.id)

    // Check if provider is configured
    const isConfigured = await provider.isConfigured(currentUser.id)
    if (!isConfigured) {
      const providerName = provider.name
      return new Response(
        JSON.stringify({
          error: `${providerName} is not configured. Set it up in Profile > Integrations.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Build system prompt with context
    const systemPrompt = await buildSystemPrompt(context ?? {})

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    let controllerClosed = false

    const stream = new ReadableStream({
      async start(controller) {
        const onEvent = (event: StreamEvent) => {
          if (controllerClosed) return
          try {
            const data = JSON.stringify(event)
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
