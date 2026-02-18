'use client'

import { GripHorizontalIcon, SendIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SlashCommandMenu } from '@/components/chat/slash-command-menu'
import { Button } from '@/components/ui/button'
import { filterCommands, parseSlashCommand, type SlashCommand } from '@/lib/chat/commands'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  onCommand: (command: SlashCommand, args?: string) => void
  disabled?: boolean
  placeholder?: string
}

// Height constants: 22px content + 16px padding (8px x 2) + 2px border (1px x 2) = 40px
const MIN_HEIGHT = 40
const MAX_HEIGHT = 300

export function ChatInput({
  onSend,
  onCommand,
  disabled,
  placeholder = 'Ask me about your tickets...',
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
    if (trimmed && !disabled) {
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
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

      <div className="relative flex items-center gap-2 px-4 pb-4">
        <SlashCommandMenu
          open={showCommandMenu}
          filter={commandFilter}
          onSelect={handleCommandSelect}
          onClose={() => setShowCommandMenu(false)}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
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
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          size="icon"
          className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
