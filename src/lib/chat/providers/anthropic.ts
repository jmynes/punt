/**
 * Anthropic API chat provider
 * Uses user's Anthropic API key to call Claude directly
 */

import Anthropic from '@anthropic-ai/sdk'
import { executeTool } from '@/lib/chat/executor'
import { type ChatToolName, chatTools } from '@/lib/chat/tools'
import { db } from '@/lib/db'
import type { ChatProvider, ChatProviderParams } from './types'

export class AnthropicProvider implements ChatProvider {
  readonly id = 'anthropic' as const
  readonly name = 'Anthropic API'
  readonly experimental = false

  async isConfigured(userId: string): Promise<boolean> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { anthropicApiKey: true },
    })
    return !!user?.anthropicApiKey
  }

  async sendMessage(params: ChatProviderParams): Promise<void> {
    const { messages, userId, systemPrompt, onEvent } = params

    // Get user's API key
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { anthropicApiKey: true },
    })

    if (!user?.anthropicApiKey) {
      onEvent({
        type: 'error',
        error: 'No Anthropic API key configured. Add your key in Profile > Integrations.',
      })
      return
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: user.anthropicApiKey,
    })

    try {
      // Convert messages to Anthropic format
      let currentMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
        role: m.role,
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
            onEvent({ type: 'text', content: block.text })
          } else if (block.type === 'tool_use') {
            hasToolUse = true

            // Notify about tool execution start
            onEvent({
              type: 'tool_start',
              name: block.name,
              input: block.input as Record<string, unknown>,
            })

            // Execute the tool
            const toolResult = await executeTool(
              block.name as ChatToolName,
              block.input as Record<string, unknown>,
              userId,
            )

            // Notify about tool result
            onEvent({
              type: 'tool_end',
              name: block.name,
              result: toolResult.result,
              success: toolResult.success,
            })

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: toolResult.result,
            })
          }
        }

        // If there were tool calls, continue the conversation
        if (hasToolUse && response.stop_reason === 'tool_use') {
          currentMessages = [
            ...currentMessages,
            { role: 'assistant' as const, content: response.content },
            { role: 'user' as const, content: toolResults },
          ]
        } else {
          continueLoop = false
        }
      }

      onEvent({ type: 'done' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'

      // Map specific errors to user-friendly messages
      let userMessage = errorMessage
      if (errorMessage.includes('Invalid API Key')) {
        userMessage = 'Invalid Anthropic API key. Please check your key in Profile > Integrations.'
      } else if (errorMessage.includes('rate_limit')) {
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
      }

      onEvent({ type: 'error', error: userMessage })
    }
  }
}
