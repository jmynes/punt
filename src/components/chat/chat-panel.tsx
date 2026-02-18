'use client'

import { BotIcon, KeyIcon, Loader2Icon } from 'lucide-react'
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
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/stores/ui-store'
import { ChatInput } from './chat-input'
import { type ChatMessage, ChatMessageComponent } from './chat-message'

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentUser = useCurrentUser()

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

  // Scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStreamEvent = useCallback((messageId: string, event: StreamEvent) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m

        switch (event.type) {
          case 'text':
            return { ...m, content: m.content + (event.content || '') }

          case 'tool_start':
            return {
              ...m,
              toolCalls: [
                ...(m.toolCalls || []),
                {
                  name: event.name || 'unknown',
                  input: event.input || {},
                  status: 'running' as const,
                },
              ],
            }

          case 'tool_end':
            return {
              ...m,
              toolCalls: m.toolCalls?.map((t) =>
                t.name === event.name && t.status === 'running'
                  ? {
                      ...t,
                      status: 'completed' as const,
                      result: event.result,
                      success: event.success,
                    }
                  : t,
              ),
            }

          case 'error':
            return { ...m, content: `${m.content}\n\nError: ${event.error}` }

          default:
            return m
        }
      }),
    )
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      // Create assistant message placeholder
      const assistantId = crypto.randomUUID()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [],
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        // Build message history for API
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
                const event: StreamEvent = JSON.parse(data)
                handleStreamEvent(assistantId, event)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        // Ignore abort errors (user cancelled)
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        const errorMessage = error instanceof Error ? error.message : 'An error occurred'
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${errorMessage}` } : m)),
        )
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [messages, chatContext, isLoading, handleStreamEvent],
  )

  const clearChat = () => {
    // Abort any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setMessages([])
    setIsLoading(false)
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
              <SheetTitle className="text-base">Claude Chat</SheetTitle>
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
          </div>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isConfigured === false ? (
            <NotConfiguredMessage onNavigate={() => setChatPanelOpen(false)} />
          ) : messages.length === 0 ? (
            <EmptyState />
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
          <ChatInput onSend={sendMessage} disabled={isLoading || isConfigured === null} />
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
    router.push('/profile?tab=integrations')
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

function EmptyState() {
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
          <span key={suggestion} className="rounded-full bg-zinc-800 px-3 py-1.5 text-zinc-300">
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  )
}
