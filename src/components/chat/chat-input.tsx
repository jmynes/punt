'use client'

import { GripHorizontalIcon, SendIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

// Height constants: 22px content + 16px padding (8px x 2) + 2px border (1px x 2) = 40px
const MIN_HEIGHT = 40
const MAX_HEIGHT = 300

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Ask me about your tickets...',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [height, setHeight] = useState(MIN_HEIGHT)
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

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
      setHeight(MIN_HEIGHT) // Reset to default after sending
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

      <div className="flex items-center gap-2 px-4 pb-4">
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
