/**
 * POST /api/chat - Streaming chat endpoint with Claude
 * Proxies requests to Anthropic API using user's API key
 */

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod/v4'
import { requireAuth } from '@/lib/auth-helpers'
import { buildSystemPrompt } from '@/lib/chat/context'
import { executeTool } from '@/lib/chat/executor'
import { type ChatToolName, chatTools } from '@/lib/chat/tools'
import { db } from '@/lib/db'

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

    // Get user's Anthropic API key
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { anthropicApiKey: true },
    })

    if (!user?.anthropicApiKey) {
      return new Response(
        JSON.stringify({
          error: 'No Anthropic API key configured. Add your key in Profile > Integrations.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const body = await request.json()
    const result = chatRequestSchema.safeParse(body)

    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { messages, context } = result.data

    // Build system prompt with context
    const systemPrompt = await buildSystemPrompt(context ?? {})

    // Initialize Anthropic client with user's API key
    const anthropic = new Anthropic({
      apiKey: user.anthropicApiKey,
    })

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Convert messages to Anthropic format
          // Use Anthropic.Messages.MessageParam type to allow both text and tool results
          let currentMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))

          // Run conversation loop (handles tool calls)
          let continueLoop = true

          while (continueLoop) {
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools: chatTools,
              messages: currentMessages,
            })

            // Process response content
            let hasToolUse = false
            const toolResults: Array<{
              type: 'tool_result'
              tool_use_id: string
              content: string
            }> = []

            for (const block of response.content) {
              if (block.type === 'text') {
                // Stream text to client
                const data = JSON.stringify({ type: 'text', content: block.text })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              } else if (block.type === 'tool_use') {
                hasToolUse = true

                // Notify client about tool execution
                const toolStart = JSON.stringify({
                  type: 'tool_start',
                  name: block.name,
                  input: block.input,
                })
                controller.enqueue(encoder.encode(`data: ${toolStart}\n\n`))

                // Execute the tool
                const toolResult = await executeTool(
                  block.name as ChatToolName,
                  block.input as Record<string, unknown>,
                  currentUser.id,
                )

                // Notify client about tool result
                const toolEnd = JSON.stringify({
                  type: 'tool_end',
                  name: block.name,
                  result: toolResult.result,
                  success: toolResult.success,
                })
                controller.enqueue(encoder.encode(`data: ${toolEnd}\n\n`))

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: toolResult.result,
                })
              }
            }

            // If there were tool calls, continue the conversation
            if (hasToolUse && response.stop_reason === 'tool_use') {
              // Add assistant response and tool results to messages
              currentMessages = [
                ...currentMessages,
                { role: 'assistant' as const, content: response.content },
                { role: 'user' as const, content: toolResults },
              ]
            } else {
              continueLoop = false
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
          controller.close()
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An error occurred'

          // Check for specific Anthropic errors
          let userMessage = errorMessage
          if (errorMessage.includes('Invalid API Key')) {
            userMessage =
              'Invalid Anthropic API key. Please check your key in Profile > Integrations.'
          } else if (errorMessage.includes('rate_limit')) {
            userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
          }

          const errorData = JSON.stringify({ type: 'error', error: userMessage })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
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
