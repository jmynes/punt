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

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Ask me about your tickets...',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [height, setHeight] = useState(40) // Default single row height
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
      const newHeight = Math.min(300, Math.max(40, startHeightRef.current + deltaY))
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

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
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
