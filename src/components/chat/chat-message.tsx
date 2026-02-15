'use client'

import { BotIcon, CheckCircleIcon, UserIcon, WrenchIcon, XCircleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
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
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-600' : 'bg-purple-600',
        )}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-white" />
        ) : (
          <BotIcon className="h-4 w-4 text-white" />
        )}
      </div>

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

        {/* Text content */}
        {message.content && <div className="whitespace-pre-wrap text-sm">{message.content}</div>}
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
