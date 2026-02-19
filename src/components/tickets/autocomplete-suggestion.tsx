'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import type { TicketWithRelations, UserSummary } from '@/types'
import { TypeBadge } from '../common/type-badge'

export type SuggestionType = 'ticket' | 'mention'

export interface TicketSuggestion {
  type: 'ticket'
  ticket: TicketWithRelations
  projectKey: string
}

export interface MentionSuggestion {
  type: 'mention'
  user: UserSummary
}

export type Suggestion = TicketSuggestion | MentionSuggestion

interface AutocompleteSuggestionProps {
  suggestions: Suggestion[]
  selectedIndex: number
  onSelect: (suggestion: Suggestion) => void
  position: { top: number; left: number } | null
  isVisible: boolean
  searchText: string
}

/**
 * Autocomplete suggestion dropdown for #ticket references and @mentions
 */
export function AutocompleteSuggestion({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  isVisible,
  searchText,
}: AutocompleteSuggestionProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  // Sync external selected index with internal state
  useEffect(() => {
    setActiveIndex(selectedIndex)
  }, [selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && activeIndex >= 0) {
      const selectedElement = listRef.current.children[activeIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  if (!isVisible || !position || suggestions.length === 0) {
    return null
  }

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] w-72 max-h-60 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
      // Prevent editor from losing focus when interacting with the dropdown
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="py-1">
        {suggestions.length === 0 && (
          <div className="px-3 py-2 text-sm text-zinc-500">
            No results for &quot;{searchText}&quot;
          </div>
        )}
        {suggestions.map((suggestion, index) => (
          <button
            key={
              suggestion.type === 'ticket'
                ? `ticket-${suggestion.ticket.id}`
                : `user-${suggestion.user.id}`
            }
            type="button"
            className={cn(
              'w-full px-3 py-2 text-left text-sm cursor-pointer flex items-center gap-2',
              'hover:bg-zinc-800',
              index === activeIndex && 'bg-zinc-800',
            )}
            onMouseDown={(e) => {
              // Prevent editor from losing focus when clicking suggestions
              e.preventDefault()
              onSelect(suggestion)
            }}
            onMouseEnter={() => setActiveIndex(index)}
          >
            {suggestion.type === 'ticket' ? (
              <TicketSuggestionItem ticket={suggestion.ticket} projectKey={suggestion.projectKey} />
            ) : (
              <MentionSuggestionItem user={suggestion.user} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function TicketSuggestionItem({
  ticket,
  projectKey,
}: {
  ticket: TicketWithRelations
  projectKey: string
}) {
  return (
    <>
      <TypeBadge type={ticket.type} size="sm" />
      <span className="font-mono text-zinc-500 text-xs shrink-0">
        {projectKey}-{ticket.number}
      </span>
      <span className="text-zinc-300 truncate">{ticket.title}</span>
    </>
  )
}

function MentionSuggestionItem({ user }: { user: UserSummary }) {
  return (
    <>
      <Avatar className="h-5 w-5">
        <AvatarImage src={user.avatar || undefined} />
        <AvatarFallback
          className="text-[10px] text-white font-medium"
          style={{
            backgroundColor: user.avatarColor || getAvatarColor(user.id || user.name),
          }}
        >
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-zinc-300">{user.name}</span>
      {user.username && <span className="text-zinc-500 text-xs">@{user.username}</span>}
    </>
  )
}
