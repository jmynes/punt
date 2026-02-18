/**
 * Chat provider types and interfaces
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatContext {
  projectId?: string
  ticketKey?: string
}

export interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'done' | 'error'
  content?: string
  name?: string
  input?: Record<string, unknown>
  result?: string
  success?: boolean
  error?: string
}

export interface ChatProviderParams {
  messages: ChatMessage[]
  context?: ChatContext
  userId: string
  systemPrompt: string
  onEvent: (event: StreamEvent) => void
}

export interface ChatProvider {
  /**
   * Provider identifier
   */
  readonly id: 'anthropic' | 'claude-cli'

  /**
   * Human-readable provider name
   */
  readonly name: string

  /**
   * Whether this provider is experimental
   */
  readonly experimental: boolean

  /**
   * Send a message and stream the response
   */
  sendMessage(params: ChatProviderParams): Promise<void>

  /**
   * Check if this provider is configured for a user
   */
  isConfigured(userId: string): Promise<boolean>
}

export type ChatProviderId = ChatProvider['id']
