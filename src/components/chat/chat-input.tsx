'use client'

import { AtSignIcon, GripHorizontalIcon, HashIcon, SendIcon, SquareIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type MentionItem, MentionMenu } from '@/components/chat/mention-menu'
import { SlashCommandMenu } from '@/components/chat/slash-command-menu'
import { Button } from '@/components/ui/button'
import { filterCommands, parseSlashCommand, type SlashCommand } from '@/lib/chat/commands'
import { cn } from '@/lib/utils'
import type { ProjectMemberWithRole, TicketWithRelations } from '@/types'

interface ChatInputProps {
  onSend: (message: string) => void
  onCommand: (command: SlashCommand, args?: string) => void
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  /** Project members for @mention autocomplete */
  members?: ProjectMemberWithRole[]
  /** Tickets for #ticket autocomplete */
  tickets?: TicketWithRelations[]
  /** Project key for building ticket keys (e.g., "PUNT") */
  projectKey?: string
}

// Height constants: 22px content + 16px padding (8px x 2) + 2px border (1px x 2) = 40px
const MIN_HEIGHT = 40
const MAX_HEIGHT = 300

/** Detect an active @mention or #ticket trigger at cursor position */
function detectTrigger(
  value: string,
  cursorPos: number,
): { type: 'user' | 'ticket'; query: string; start: number } | null {
  // Look backwards from cursor for a trigger character
  const textBeforeCursor = value.slice(0, cursorPos)

  // Find the last @ or # that could be a trigger
  for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
    const ch = textBeforeCursor[i]

    // Stop at whitespace or newline — trigger must be in the same "word"
    if (ch === ' ' || ch === '\n' || ch === '\t') break

    if (ch === '@' || ch === '#') {
      // Must be at start of input or preceded by whitespace
      if (i > 0 && textBeforeCursor[i - 1] !== ' ' && textBeforeCursor[i - 1] !== '\n') {
        break
      }
      const query = textBeforeCursor.slice(i + 1)
      return {
        type: ch === '@' ? 'user' : 'ticket',
        query,
        start: i,
      }
    }
  }
  return null
}

export function ChatInput({
  onSend,
  onCommand,
  onStop,
  isLoading,
  disabled,
  placeholder = 'Ask me about your tickets...',
  members,
  tickets,
  projectKey,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [height, setHeight] = useState(MIN_HEIGHT)
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  // Mention autocomplete state
  const [mentionTrigger, setMentionTrigger] = useState<{
    type: 'user' | 'ticket'
    query: string
    start: number
  } | null>(null)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)

  // Autofocus when component mounts
  useEffect(() => {
    if (!disabled) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100) // Small delay to ensure sheet animation completes
      return () => clearTimeout(timer)
    }
  }, [disabled])

  // Handle drag resize from top
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true
      startYRef.current = e.clientY
      startHeightRef.current = height
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    },
    [height],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      // Dragging up (negative deltaY) should increase height
      const deltaY = startYRef.current - e.clientY
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + deltaY))
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Auto-grow textarea to fit content (only grow, don't shrink below min)
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to measure when value changes
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // First, set to minimum height to get accurate scrollHeight measurement
    textarea.style.height = `${MIN_HEIGHT}px`

    // Only grow if content actually overflows (scrollHeight > clientHeight)
    // This prevents expanding for single-line text where browser reports larger scrollHeight
    if (textarea.scrollHeight > textarea.clientHeight) {
      const newHeight = Math.min(MAX_HEIGHT, textarea.scrollHeight)
      textarea.style.height = `${newHeight}px`
      setHeight(newHeight)
    } else {
      setHeight(MIN_HEIGHT)
    }
  }, [value])

  // Update command menu state based on input value
  useEffect(() => {
    if (value.startsWith('/')) {
      const parsed = parseSlashCommand(value)
      if (parsed.partial !== undefined) {
        setCommandFilter(parsed.partial)
        setShowCommandMenu(true)
      } else if (parsed.command) {
        // Full command typed, hide menu
        setShowCommandMenu(false)
      } else {
        // Just "/" typed
        setCommandFilter('')
        setShowCommandMenu(true)
      }
    } else {
      setShowCommandMenu(false)
      setCommandFilter('')
    }
  }, [value])

  // Detect mention trigger on value/cursor change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    const cursorPos = e.target.selectionStart
    const trigger = detectTrigger(newValue, cursorPos)
    if (trigger) {
      setMentionTrigger(trigger)
      setMentionSelectedIndex(0)
    } else {
      setMentionTrigger(null)
    }
  }, [])

  // Also detect trigger on cursor movement (click/arrow keys)
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursorPos = textarea.selectionStart
    const trigger = detectTrigger(value, cursorPos)
    if (trigger) {
      setMentionTrigger(trigger)
    } else {
      setMentionTrigger(null)
    }
  }, [value])

  // Build filtered mention items
  const mentionItems = useMemo((): MentionItem[] => {
    if (!mentionTrigger) return []
    const query = mentionTrigger.query.toLowerCase()

    if (mentionTrigger.type === 'user' && members) {
      return members
        .filter((m) => {
          const name = m.user.name?.toLowerCase() ?? ''
          const username = m.user.username?.toLowerCase() ?? ''
          const email = (m.user.email ?? '').toLowerCase()
          return name.includes(query) || username.includes(query) || email.includes(query)
        })
        .slice(0, 8)
        .map((m) => ({
          value: m.user.username ?? m.user.name,
          label: `@${m.user.username ?? m.user.name}`,
          description: m.user.name,
          type: 'user' as const,
        }))
    }

    if (mentionTrigger.type === 'ticket' && tickets && projectKey) {
      return tickets
        .filter((t) => {
          const key = `${projectKey}-${t.number}`.toLowerCase()
          const title = t.title.toLowerCase()
          return key.includes(query) || title.includes(query)
        })
        .slice(0, 8)
        .map((t) => ({
          value: `${projectKey}-${t.number}`,
          label: `#${projectKey}-${t.number}`,
          description: t.title,
          type: 'ticket' as const,
        }))
    }

    return []
  }, [mentionTrigger, members, tickets, projectKey])

  const showMentionMenu = mentionTrigger !== null && mentionItems.length > 0

  const handleMentionSelect = useCallback(
    (item: MentionItem) => {
      if (!mentionTrigger) return

      const textarea = textareaRef.current
      if (!textarea) return

      const cursorPos = textarea.selectionStart
      // Replace from trigger start to cursor position
      const before = value.slice(0, mentionTrigger.start)
      const after = value.slice(cursorPos)
      const insertion = item.type === 'user' ? `@${item.value} ` : `#${item.value} `
      const newValue = before + insertion + after
      setValue(newValue)
      setMentionTrigger(null)

      // Set cursor after the insertion
      const newCursorPos = before.length + insertion.length
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      })
    },
    [mentionTrigger, value],
  )

  const handleCommandSelect = useCallback(
    (command: SlashCommand) => {
      if (command.requiresArg) {
        // Insert command and wait for args
        setValue(`/${command.name} `)
        setShowCommandMenu(false)
        textareaRef.current?.focus()
      } else {
        // Execute command immediately
        onCommand(command)
        setValue('')
        setShowCommandMenu(false)
      }
    },
    [onCommand],
  )

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled && !isLoading) {
      // Check if it's a slash command
      const parsed = parseSlashCommand(trimmed)
      if (parsed.isCommand && parsed.command) {
        onCommand(parsed.command, parsed.args)
        setValue('')
        setHeight(MIN_HEIGHT)
        setShowCommandMenu(false)
        return
      }

      onSend(trimmed)
      setValue('')
      setHeight(MIN_HEIGHT) // Reset to default after sending
      setMentionTrigger(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Mention menu takes priority when visible
    if (showMentionMenu) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setMentionSelectedIndex((prev) => (prev > 0 ? prev - 1 : mentionItems.length - 1))
          return
        case 'ArrowDown':
          e.preventDefault()
          setMentionSelectedIndex((prev) => (prev < mentionItems.length - 1 ? prev + 1 : 0))
          return
        case 'Enter':
          e.preventDefault()
          handleMentionSelect(mentionItems[mentionSelectedIndex])
          return
        case 'Tab':
          e.preventDefault()
          handleMentionSelect(mentionItems[mentionSelectedIndex])
          return
        case 'Escape':
          e.preventDefault()
          setMentionTrigger(null)
          return
      }
    }

    const commands = filterCommands(commandFilter)

    if (showCommandMenu && commands.length > 0) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : commands.length - 1))
          return
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev < commands.length - 1 ? prev + 1 : 0))
          return
        case 'Enter':
          e.preventDefault()
          handleCommandSelect(commands[selectedIndex])
          return
        case 'Escape':
          e.preventDefault()
          setShowCommandMenu(false)
          return
        case 'Tab':
          e.preventDefault()
          handleCommandSelect(commands[selectedIndex])
          return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div ref={containerRef} className="border-t border-zinc-800 bg-zinc-900">
      {/* Drag handle at top */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-center h-4 cursor-ns-resize hover:bg-zinc-800 transition-colors"
      >
        <GripHorizontalIcon className="h-3 w-3 text-zinc-600" />
      </div>

      {/* Quick mention buttons */}
      {members?.length || tickets?.length ? (
        <div className="flex items-center gap-1.5 px-4 pb-1.5">
          {members && members.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const textarea = textareaRef.current
                if (!textarea) return
                const pos = textarea.selectionStart ?? value.length
                const before = value.slice(0, pos)
                const after = value.slice(pos)
                const newValue = `${before}@${after}`
                setValue(newValue)
                setTimeout(() => {
                  textarea.focus()
                  textarea.setSelectionRange(pos + 1, pos + 1)
                  setMentionTrigger({ type: 'user', query: '', startPos: pos })
                  setMentionSelectedIndex(0)
                }, 0)
              }}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-zinc-700/50 bg-zinc-800/30 text-zinc-400 hover:text-blue-300 hover:border-blue-500/30 hover:bg-blue-500/10 transition-all disabled:opacity-50"
            >
              <AtSignIcon className="h-3 w-3" />
              Mention
            </button>
          )}
          {tickets && tickets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const textarea = textareaRef.current
                if (!textarea) return
                const pos = textarea.selectionStart ?? value.length
                const before = value.slice(0, pos)
                const after = value.slice(pos)
                const newValue = `${before}#${after}`
                setValue(newValue)
                setTimeout(() => {
                  textarea.focus()
                  textarea.setSelectionRange(pos + 1, pos + 1)
                  setMentionTrigger({ type: 'ticket', query: '', startPos: pos })
                  setMentionSelectedIndex(0)
                }, 0)
              }}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-zinc-700/50 bg-zinc-800/30 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all disabled:opacity-50"
            >
              <HashIcon className="h-3 w-3" />
              Ticket
            </button>
          )}
        </div>
      ) : null}

      <div className="relative flex items-center gap-2 px-4 pb-4">
        <SlashCommandMenu
          open={showCommandMenu && !showMentionMenu}
          filter={commandFilter}
          onSelect={handleCommandSelect}
          onClose={() => setShowCommandMenu(false)}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
        />
        <MentionMenu
          open={showMentionMenu}
          items={mentionItems}
          selectedIndex={mentionSelectedIndex}
          onSelect={handleMentionSelect}
          onSelectedIndexChange={setMentionSelectedIndex}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          disabled={disabled}
          style={{ height: `${height}px` }}
          className={cn(
            'flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm',
            'text-zinc-100 placeholder:text-zinc-500',
            'focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        />
        {isLoading && (
          <Button
            onClick={onStop}
            size="icon"
            className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
            title="Stop generating"
          >
            <SquareIcon className="h-4 w-4" />
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || isLoading}
          size="icon"
          className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
