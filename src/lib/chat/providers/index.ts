/**
 * Chat provider factory
 */

export { AnthropicProvider } from './anthropic'
export { ClaudeCliProvider } from './claude-cli'
export * from './types'

import { db } from '@/lib/db'
import { AnthropicProvider } from './anthropic'
import { ClaudeCliProvider } from './claude-cli'
import type { ChatProvider, ChatProviderId } from './types'

// Provider registry
const providers: Record<ChatProviderId, ChatProvider> = {
  anthropic: new AnthropicProvider(),
  'claude-cli': new ClaudeCliProvider(),
}

/**
 * Get a chat provider by ID
 */
export function getProvider(id: ChatProviderId): ChatProvider {
  const provider = providers[id]
  if (!provider) {
    throw new Error(`Unknown chat provider: ${id}`)
  }
  return provider
}

/**
 * Get the configured provider for a user
 * Falls back to anthropic if no preference set
 */
export async function getUserProvider(userId: string): Promise<ChatProvider> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { chatProvider: true },
  })

  const providerId = (user?.chatProvider as ChatProviderId) || 'anthropic'
  return getProvider(providerId)
}

/**
 * Get all available providers
 */
export function getAllProviders(): ChatProvider[] {
  return Object.values(providers)
}
