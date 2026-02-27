'use client'

import { useQueryClient } from '@tanstack/react-query'
import { BotIcon, EyeOffIcon, KeyIcon, Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  chatKeys,
  useChatSession,
  useDeleteChatSession,
  useRenameChatSession,
} from '@/hooks/queries/use-chat-sessions'
import { useCurrentUser } from '@/hooks/use-current-user'
import { getHelpText, type SlashCommand } from '@/lib/chat/commands'
import { showToast } from '@/lib/toast'
import { transformMetadataToToolCalls, useChatStore } from '@/stores/chat-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { ChatInput } from './chat-input'
import { type ChatMessage, ChatMessageComponent } from './chat-message'
import { SessionSelector } from './session-selector'

interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'done' | 'error'
  content?: string
  name?: string
  input?: Record<string, unknown>
  result?: string
  success?: boolean
  error?: string
}

export function ChatPanel() {
  const { chatPanelOpen, setChatPanelOpen, chatContext } = useUIStore()
  const showChatPanel = useSettingsStore((s) => s.showChatPanel)
  const setShowChatPanel = useSettingsStore((s) => s.setShowChatPanel)
  const {
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    addMessage,
    updateMessage,
    clearMessages,
    _hasHydrated,
  } = useChatStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const prevSessionIdRef = useRef<string | null>(null)
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()

  // React Query hooks for session operations
  const { data: sessionData } = useChatSession(currentSessionId)
  const renameSession = useRenameChatSession()
  const deleteSession = useDeleteChatSession()

  // Check if user has configured their chat provider
  useEffect(() => {
    if (chatPanelOpen && isConfigured === null) {
      // First check provider and session status
      fetch('/api/me/claude-session')
        .then((res) => res.json())
        .then((data) => {
          const userProvider = data.provider || 'anthropic'

          if (userProvider === 'claude-cli') {
            // Claude CLI just needs session
            setIsConfigured(data.hasSession)
          } else {
            // Anthropic needs API key - check that endpoint
            return fetch('/api/me/anthropic-key')
              .then((res) => res.json())
              .then((keyData) => setIsConfigured(keyData.hasKey))
          }
        })
        .catch(() => setIsConfigured(false))
    }
  }, [chatPanelOpen, isConfigured])

  // Load messages when switching to a different session
  useEffect(() => {
    // Only load from DB when actually switching sessions, not on data refresh
    const sessionChanged = currentSessionId !== prevSessionIdRef.current
    prevSessionIdRef.current = currentSessionId

    if (sessionChanged) {
      if (currentSessionId && sessionData?.messages) {
        const loadedMessages: ChatMessage[] = sessionData.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolCalls: transformMetadataToToolCalls(m.metadata),
          sentAt: new Date(m.createdAt),
          // Messages loaded from DB are already completed
          completedAt: m.role === 'assistant' ? new Date(m.createdAt) : undefined,
        }))
        setMessages(loadedMessages)
      } else if (!currentSessionId) {
        // New conversation - clear messages
        clearMessages()
      }
    }
  }, [currentSessionId, sessionData, setMessages, clearMessages])

  // Scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStreamEvent = useCallback(
    (messageId: string, event: StreamEvent) => {
      switch (event.type) {
        case 'text':
          // Use appendContent to avoid stale closure issues
          updateMessage(messageId, { appendContent: event.content || '' } as Partial<ChatMessage>)
          break

        case 'tool_start': {
          // For tool calls, we need to read current state - use the store directly
          const currentMessages = useChatStore.getState().messages
          const message = currentMessages.find((m) => m.id === messageId)
          if (message) {
            updateMessage(messageId, {
              toolCalls: [
                ...(message.toolCalls || []),
                {
                  name: event.name || 'unknown',
                  input: event.input || {},
                  status: 'running' as const,
                },
              ],
            })
          }
          break
        }

        case 'tool_end': {
          const msgs = useChatStore.getState().messages
          const msg = msgs.find((m) => m.id === messageId)
          if (msg) {
            updateMessage(messageId, {
              toolCalls: msg.toolCalls?.map((t) =>
                t.name === event.name && t.status === 'running'
                  ? {
                      ...t,
                      status: 'completed' as const,
                      result: event.result,
                      success: event.success,
                    }
                  : t,
              ),
            })
          }
          break
        }

        case 'error':
          updateMessage(messageId, {
            appendContent: `\n\nError: ${event.error}`,
          } as Partial<ChatMessage>)
          break
      }
    },
    [updateMessage],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      // Add user message with timestamp
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        sentAt: new Date(),
      }
      addMessage(userMessage)
      setIsLoading(true)

      // Create assistant message placeholder with start timestamp
      const assistantId = crypto.randomUUID()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        sentAt: new Date(),
      }
      addMessage(assistantMessage)

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        // Build message history for API (include user message we just added)
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            context: chatContext,
            sessionId: currentSessionId,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to send message')
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Process SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let newSessionId: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              try {
                const event: StreamEvent & { sessionId?: string } = JSON.parse(data)
                if (event.sessionId && !currentSessionId) {
                  newSessionId = event.sessionId
                }
                handleStreamEvent(assistantId, event)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        // Mark assistant message as completed
        updateMessage(assistantId, { completedAt: new Date() })

        // If a new session was created, update the store
        if (newSessionId) {
          setCurrentSessionId(newSessionId)
          queryClient.invalidateQueries({ queryKey: chatKeys.all })
        }
      } catch (error) {
        // Ignore abort errors (user cancelled)
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        const errorMessage = error instanceof Error ? error.message : 'An error occurred'
        updateMessage(assistantId, { content: `Error: ${errorMessage}`, completedAt: new Date() })
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [
      messages,
      chatContext,
      isLoading,
      handleStreamEvent,
      addMessage,
      updateMessage,
      currentSessionId,
      setCurrentSessionId,
      queryClient,
    ],
  )

  const clearChat = useCallback(() => {
    // Abort any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    clearMessages()
    setIsLoading(false)
  }, [clearMessages])

  const handleDismiss = useCallback(() => {
    setChatPanelOpen(false)
    setShowChatPanel(false)
    showToast.info('Chat panel hidden. Re-enable in Preferences > Appearance.')
  }, [setChatPanelOpen, setShowChatPanel])

  // Handle slash commands
  const handleCommand = useCallback(
    (command: SlashCommand, args?: string) => {
      switch (command.name) {
        case 'new':
          clearChat()
          setCurrentSessionId(null)
          showToast.success('Started new conversation')
          break

        case 'clear':
          clearChat()
          showToast.success('Conversation cleared')
          break

        case 'rename':
          if (!currentSessionId) {
            showToast.error('No conversation to rename')
            return
          }
          if (!args?.trim()) {
            showToast.error('Please provide a name: /rename <name>')
            return
          }
          renameSession.mutate({ sessionId: currentSessionId, name: args.trim() })
          break

        case 'delete':
          if (!currentSessionId) {
            showToast.error('No conversation to delete')
            return
          }
          if (confirm('Delete this conversation?')) {
            deleteSession.mutate(currentSessionId)
            setCurrentSessionId(null)
            clearMessages()
          }
          break

        case 'help':
          // Add a local help message
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: getHelpText(),
          })
          break
      }
    },
    [
      currentSessionId,
      setCurrentSessionId,
      clearChat,
      clearMessages,
      renameSession,
      deleteSession,
      addMessage,
    ],
  )

  if (!showChatPanel) {
    return null
  }

  return (
    <Sheet open={chatPanelOpen} onOpenChange={setChatPanelOpen}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-800 px-4 py-3 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600">
              <BotIcon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base sr-only">Claude Chat</SheetTitle>
              <SessionSelector currentSessionId={currentSessionId} onSelect={setCurrentSessionId} />
              <SheetDescription className="text-xs">
                Manage tickets with natural language
              </SheetDescription>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-xs text-zinc-400 hover:text-zinc-100 shrink-0"
              >
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100 shrink-0"
              title="Hide chat panel"
            >
              <EyeOffIcon className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isConfigured === false ? (
            <NotConfiguredMessage onNavigate={() => setChatPanelOpen(false)} />
          ) : messages.length === 0 ? (
            <EmptyState onSuggestionClick={sendMessage} />
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <ChatMessageComponent key={message.id} message={message} user={currentUser} />
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {isConfigured !== false && (
          <ChatInput
            onSend={sendMessage}
            onCommand={handleCommand}
            disabled={isLoading || isConfigured === null}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function NotConfiguredMessage({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter()
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Autofocus the button when shown
  useEffect(() => {
    // Small delay to ensure the sheet animation has completed
    const timer = setTimeout(() => {
      buttonRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleClick = () => {
    onNavigate()
    router.push('/profile?tab=claude-chat')
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
        <KeyIcon className="h-6 w-6 text-yellow-400" />
      </div>
      <div>
        <p className="font-medium text-zinc-100">Configuration Required</p>
        <p className="mt-1 text-sm text-zinc-400">
          Configure your chat provider in settings to use Claude Chat
        </p>
      </div>
      <Button ref={buttonRef} onClick={handleClick} className="bg-purple-600 hover:bg-purple-700">
        Go to Settings
      </Button>
    </div>
  )
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (message: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20">
        <BotIcon className="h-6 w-6 text-purple-400" />
      </div>
      <div>
        <p className="font-medium text-zinc-100">How can I help?</p>
        <p className="mt-1 text-sm text-zinc-400">
          Ask me to list tickets, create issues, or check on sprints
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        {[
          'List my open tickets',
          'Create a bug for login issue',
          'Show sprint status',
          'What tickets are high priority?',
        ].map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-full bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
