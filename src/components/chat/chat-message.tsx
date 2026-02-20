'use client'

import { BotIcon, CheckCircleIcon, TimerIcon, WrenchIcon, XCircleIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import type { UserSummary } from '@/types'

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function useElapsedSeconds(startTime: Date | undefined, isActive: boolean): number {
  const [elapsed, setElapsed] = useState(() => {
    if (!startTime) return 0
    return Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
  })

  useEffect(() => {
    if (!isActive || !startTime) return

    // Update immediately in case component re-renders
    setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime, isActive])

  return elapsed
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  sentAt?: Date // When message was sent/initiated
  completedAt?: Date // When assistant response finished
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  result?: string
  success?: boolean
  status: 'pending' | 'running' | 'completed'
}

interface ChatMessageProps {
  message: ChatMessage
  user?: UserSummary | null
}

export function ChatMessageComponent({ message, user }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isThinking = !isUser && !!message.sentAt && !message.completedAt
  const elapsedSeconds = useElapsedSeconds(message.sentAt, isThinking)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {isUser && user ? (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={user.avatar || undefined} alt={user.name} />
          <AvatarFallback
            className="text-xs text-white font-medium"
            style={{
              backgroundColor: user.avatarColor || getAvatarColor(user.id || user.name),
            }}
          >
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600">
          <BotIcon className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-2 rounded-lg px-4 py-2',
          isUser ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-100',
        )}
      >
        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {message.toolCalls.map((tool, index) => (
              <ToolCallBadge key={index} tool={tool} />
            ))}
          </div>
        )}

        {/* Text content with basic markdown */}
        {message.content && (
          <div className="whitespace-pre-wrap text-sm">
            <FormattedText text={message.content} />
          </div>
        )}

        {/* Timestamps */}
        {(message.sentAt || message.completedAt) && (
          <div
            className={cn(
              'flex gap-2 text-[10px] mt-1',
              isUser ? 'text-blue-200' : 'text-zinc-500',
            )}
          >
            {isUser ? (
              message.sentAt && <span>{formatTime(new Date(message.sentAt))}</span>
            ) : isThinking ? (
              <span className="inline-flex items-center gap-1 text-yellow-400">
                <TimerIcon className="h-3 w-3" />
                {elapsedSeconds}s
              </span>
            ) : (
              message.completedAt && (
                <span className="inline-flex items-center">
                  {formatTime(new Date(message.completedAt))}
                  {message.sentAt && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-yellow-400">
                      <TimerIcon className="h-3 w-3" />
                      {Math.round(
                        (new Date(message.completedAt).getTime() -
                          new Date(message.sentAt).getTime()) /
                          1000,
                      )}
                      s
                    </span>
                  )}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallBadge({ tool }: { tool: ToolCall }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-zinc-900/50 px-2 py-1.5 text-xs">
      <WrenchIcon className="h-3 w-3 text-zinc-400" />
      <span className="font-medium text-zinc-300">{formatToolName(tool.name)}</span>
      {tool.status === 'running' && (
        <span className="ml-auto animate-pulse text-yellow-400">Running...</span>
      )}
      {tool.status === 'completed' &&
        (tool.success ? (
          <CheckCircleIcon className="ml-auto h-3 w-3 text-green-400" />
        ) : (
          <XCircleIcon className="ml-auto h-3 w-3 text-red-400" />
        ))}
    </div>
  )
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Simple markdown parser that renders bold, italic, inline code, and bullet lists.
 * Uses React elements instead of dangerouslySetInnerHTML for safety.
 *
 * Supported syntax:
 * - **bold** or __bold__ text (standard markdown)
 * - *italic* or _italic_ text
 * - `inline code`
 * - Bullet lists: lines starting with `- ` or `* ` (at line start)
 * - Nested inline formatting: **bold _italic_** works correctly
 */
function FormattedText({ text }: { text: string }) {
  let key = 0

  // Process inline patterns: **bold**, __bold__, *italic*, _italic_, `code`
  // Order matters: ** before *, __ before _
  // Recursively processes inner content for bold/italic (but not code spans)
  const processInline = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = []
    let lastIndex = 0

    // Combined regex for all inline patterns
    // Order: **bold** | __bold__ | `code` | *italic* | _italic_
    const combinedRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g
    const matches = Array.from(input.matchAll(combinedRegex))

    for (const match of matches) {
      // Add text before match
      if (match.index !== undefined && match.index > lastIndex) {
        result.push(input.slice(lastIndex, match.index))
      }

      const matched = match[0]
      if (matched.startsWith('**') && matched.endsWith('**')) {
        result.push(
          <strong key={key++} className="font-semibold">
            {processInline(matched.slice(2, -2))}
          </strong>,
        )
      } else if (matched.startsWith('__') && matched.endsWith('__')) {
        result.push(
          <strong key={key++} className="font-semibold">
            {processInline(matched.slice(2, -2))}
          </strong>,
        )
      } else if (matched.startsWith('`') && matched.endsWith('`')) {
        // Code spans: render literally, no recursive parsing
        result.push(
          <code key={key++} className="bg-zinc-900 px-1 rounded text-xs text-amber-400">
            {matched.slice(1, -1)}
          </code>,
        )
      } else if (matched.startsWith('*') && matched.endsWith('*')) {
        result.push(<em key={key++}>{processInline(matched.slice(1, -1))}</em>)
      } else if (matched.startsWith('_') && matched.endsWith('_')) {
        result.push(<em key={key++}>{processInline(matched.slice(1, -1))}</em>)
      }

      if (match.index !== undefined) {
        lastIndex = match.index + matched.length
      }
    }

    // Add remaining text
    if (lastIndex < input.length) {
      result.push(input.slice(lastIndex))
    }

    return result.length > 0 ? result : [input]
  }

  // Split text into lines and group bullet points into lists
  const renderWithBullets = (input: string): React.ReactNode[] => {
    const lines = input.split('\n')
    const result: React.ReactNode[] = []
    let bulletItems: React.ReactNode[][] = []

    const flushBullets = () => {
      if (bulletItems.length > 0) {
        result.push(
          <ul key={key++} className="list-disc ml-4 space-y-0.5">
            {bulletItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>,
        )
        bulletItems = []
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Match bullet points: lines starting with optional whitespace then "- " or "* "
      const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)/)

      if (bulletMatch) {
        bulletItems.push(processInline(bulletMatch[2]))
      } else {
        flushBullets()
        // Wrap each non-bullet line in a <div> so block elements stack naturally
        // without literal '\n' characters causing whitespace-pre-wrap artifacts
        if (line === '') {
          result.push(<div key={key++} className="h-2" />)
        } else {
          result.push(<div key={key++}>{processInline(line)}</div>)
        }
      }
    }

    // Flush any remaining bullet items
    flushBullets()

    return result
  }

  return <>{renderWithBullets(text)}</>
}
