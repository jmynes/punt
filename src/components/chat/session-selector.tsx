'use client'

import { ChevronDownIcon, MessageSquareIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useChatSessions, useDeleteChatSession } from '@/hooks/queries/use-chat-sessions'
import { formatRelativeTime } from '@/lib/utils'
import type { ChatSessionSummary } from '@/types'

interface SessionSelectorProps {
  currentSessionId: string | null
  onSelect: (sessionId: string | null) => void
  projectId?: string
}

export function SessionSelector({ currentSessionId, onSelect, projectId }: SessionSelectorProps) {
  const [open, setOpen] = useState(false)
  const { data: sessions, isLoading } = useChatSessions(projectId)
  const deleteSession = useDeleteChatSession()

  const currentSession = sessions?.find((s) => s.id === currentSessionId)

  const handleSelect = (sessionId: string | null) => {
    onSelect(sessionId)
    setOpen(false)
  }

  const handleDelete = (e: React.MouseEvent, session: ChatSessionSummary) => {
    e.stopPropagation()
    if (confirm(`Delete "${session.name}"?`)) {
      deleteSession.mutate(session.id)
      if (currentSessionId === session.id) {
        onSelect(null)
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 max-w-[200px]"
        >
          <MessageSquareIcon className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{currentSession?.name ?? 'New conversation'}</span>
          <ChevronDownIcon className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search conversations..." />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading...' : 'No conversations found'}</CommandEmpty>
            {sessions && sessions.length > 0 && (
              <CommandGroup heading="Recent">
                {sessions.map((session) => (
                  <CommandItem
                    key={session.id}
                    value={session.name}
                    onSelect={() => handleSelect(session.id)}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate">{session.name}</span>
                      <span className="text-xs text-zinc-500 group-data-[selected=true]:text-zinc-300">
                        {formatRelativeTime(session.updatedAt)} · {session.messageCount} messages
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                      onClick={(e) => handleDelete(e, session)}
                    >
                      <Trash2Icon className="h-3 w-3 text-red-400" />
                    </Button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => handleSelect(null)} className="text-purple-400">
                <PlusIcon className="h-4 w-4 mr-2" />
                New conversation
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
