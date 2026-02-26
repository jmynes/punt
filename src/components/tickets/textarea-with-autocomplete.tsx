'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TicketWithRelations, UserSummary } from '@/types'
import {
  AutocompleteSuggestion,
  type MentionSuggestion,
  type Suggestion,
  type TicketSuggestion,
} from './autocomplete-suggestion'

interface AutocompleteState {
  isOpen: boolean
  triggerType: 'ticket' | 'mention' | null
  searchText: string
  triggerIndex: number
  position: { top: number; left: number } | null
}

export interface TextareaWithAutocompleteProps
  extends Omit<React.ComponentProps<'textarea'>, 'onChange'> {
  /** Current value of the textarea */
  value: string
  /** Called when value changes */
  onChange: (value: string) => void
  /** Tickets for #reference autocomplete */
  tickets?: TicketWithRelations[]
  /** Members for @mention autocomplete */
  members?: UserSummary[]
  /** Project key for ticket references (e.g., "PUNT") */
  projectKey?: string
}

export interface TextareaWithAutocompleteRef {
  focus: () => void
  blur: () => void
  setSelectionRange: (start: number, end: number) => void
}

/**
 * A textarea component with @mention and #ticket autocomplete support.
 * Detects trigger characters and shows a floating suggestion dropdown.
 */
export const TextareaWithAutocomplete = forwardRef<
  TextareaWithAutocompleteRef,
  TextareaWithAutocompleteProps
>(function TextareaWithAutocomplete(
  {
    value,
    onChange,
    tickets = [],
    members = [],
    projectKey = '',
    className,
    onKeyDown: externalOnKeyDown,
    ...props
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [state, setState] = useState<AutocompleteState>({
    isOpen: false,
    triggerType: null,
    searchText: '',
    triggerIndex: 0,
    position: null,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const pendingTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Clean up pending timers on unmount
  useEffect(() => {
    const timers = pendingTimers.current
    return () => {
      for (const id of timers) clearTimeout(id)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    setSelectionRange: (start: number, end: number) =>
      textareaRef.current?.setSelectionRange(start, end),
  }))

  // Calculate filtered suggestions
  const suggestions = useMemo((): Suggestion[] => {
    if (!state.isOpen || !state.triggerType) return []

    const searchLower = state.searchText.toLowerCase()

    if (state.triggerType === 'ticket') {
      // Filter tickets by number or title
      return tickets
        .filter((ticket) => {
          const ticketKey = `${projectKey}-${ticket.number}`.toLowerCase()
          const ticketNumber = ticket.number.toString()
          const title = ticket.title.toLowerCase()

          // Match by number, key, or title
          return (
            ticketNumber.includes(searchLower) ||
            ticketKey.includes(searchLower) ||
            title.includes(searchLower)
          )
        })
        .slice(0, 10)
        .map(
          (ticket): TicketSuggestion => ({
            type: 'ticket',
            ticket,
            projectKey,
          }),
        )
    } else {
      // Filter members by name or username
      return members
        .filter((member) => {
          const name = (member.name ?? '').toLowerCase()
          const username = (member.username ?? '').toLowerCase()
          return name.includes(searchLower) || username.includes(searchLower)
        })
        .slice(0, 10)
        .map(
          (user): MentionSuggestion => ({
            type: 'mention',
            user,
          }),
        )
    }
  }, [state.isOpen, state.triggerType, state.searchText, tickets, members, projectKey])

  // Reset selected index when suggestions change
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally reset on suggestion changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions])

  // Get caret position in the textarea using a mirror element
  const getCaretPosition = useCallback((): { top: number; left: number } | null => {
    const textarea = textareaRef.current
    if (!textarea) return null

    // Create a mirror div to measure text position
    const mirror = document.createElement('div')
    const computed = window.getComputedStyle(textarea)

    // Copy textarea styles to mirror
    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: hidden;
      width: ${computed.width};
      height: ${computed.height};
      font-family: ${computed.fontFamily};
      font-size: ${computed.fontSize};
      font-weight: ${computed.fontWeight};
      line-height: ${computed.lineHeight};
      letter-spacing: ${computed.letterSpacing};
      padding: ${computed.padding};
      border: ${computed.border};
      box-sizing: ${computed.boxSizing};
    `

    // Get text up to cursor position as a proper text node so the
    // marker span flows inline and wraps correctly with the text
    const textBeforeCursor = value.substring(0, textarea.selectionStart)
    mirror.appendChild(document.createTextNode(textBeforeCursor))

    // Add a span to mark the cursor position
    const marker = document.createElement('span')
    marker.textContent = '|'
    mirror.appendChild(marker)

    document.body.appendChild(mirror)

    // Get marker position relative to the mirror
    const markerRect = marker.getBoundingClientRect()
    const mirrorRect = mirror.getBoundingClientRect()
    const textareaRect = textarea.getBoundingClientRect()

    // Calculate position relative to textarea, accounting for scroll
    const scrollTop = textarea.scrollTop
    const relativeTop = markerRect.top - mirrorRect.top
    const relativeLeft = markerRect.left - mirrorRect.left
    const lineHeight = Number.parseInt(computed.lineHeight, 10) || 20

    document.body.removeChild(mirror)

    // Position dropdown just below the current line.
    // Use viewport coordinates only (no window.scrollY/X) since the
    // dropdown renders with position: fixed.
    return {
      top: textareaRect.top + relativeTop - scrollTop + lineHeight,
      left: textareaRect.left + relativeLeft,
    }
  }, [value])

  // Check for trigger characters when text changes or cursor moves
  const checkForTrigger = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = value.substring(0, cursorPosition)

    // Look backwards for trigger character
    let triggerIndex = -1
    let triggerType: 'ticket' | 'mention' | null = null

    for (let i = cursorPosition - 1; i >= 0; i--) {
      const char = textBeforeCursor[i]

      // Stop at whitespace or start of text
      if (char === ' ' || char === '\n' || char === '\t') {
        break
      }

      if (char === '#') {
        triggerType = 'ticket'
        triggerIndex = i
        break
      }

      if (char === '@') {
        triggerType = 'mention'
        triggerIndex = i
        break
      }
    }

    if (triggerIndex >= 0 && triggerType) {
      // Extract search text after trigger
      const searchText = textBeforeCursor.slice(triggerIndex + 1)

      // Don't show for very long search texts
      if (searchText.length > 50) {
        setState((prev) => ({ ...prev, isOpen: false, triggerType: null }))
        return
      }

      const position = getCaretPosition()

      setState({
        isOpen: true,
        triggerType,
        searchText,
        triggerIndex,
        position,
      })
    } else {
      // No trigger found
      setState((prev) => ({ ...prev, isOpen: false, triggerType: null }))
    }
  }, [value, getCaretPosition])

  // Handle suggestion selection
  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      const textarea = textareaRef.current
      if (!textarea) return

      // Generate replacement text
      let replacement: string
      if (suggestion.type === 'ticket') {
        replacement = `#${suggestion.projectKey}-${suggestion.ticket.number}`
      } else {
        // Insert as @username - will be linkified by markdown viewer
        replacement = `@${suggestion.user.username || suggestion.user.name}`
      }

      // Replace text from trigger to cursor
      const beforeTrigger = value.slice(0, state.triggerIndex)
      const afterCursor = value.slice(textarea.selectionStart)
      const newValue = `${beforeTrigger}${replacement} ${afterCursor}`

      onChange(newValue)

      // Close dropdown
      setState({
        isOpen: false,
        triggerType: null,
        searchText: '',
        triggerIndex: 0,
        position: null,
      })

      // Move cursor after the inserted text
      const newCursorPosition = beforeTrigger.length + replacement.length + 1
      const id = setTimeout(() => {
        pendingTimers.current.delete(id)
        textarea.focus()
        textarea.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
      pendingTimers.current.add(id)
    },
    [value, state.triggerIndex, onChange],
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!state.isOpen) {
        // Pass through to parent onKeyDown if not handling autocomplete
        externalOnKeyDown?.(e)
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break

        case 'Tab':
          if (suggestions.length > 0) {
            e.preventDefault()
            handleSelect(suggestions[selectedIndex])
          }
          break

        case 'Enter':
          // Ctrl+Enter should pass through to parent (e.g., submit comment)
          if (e.ctrlKey || e.metaKey) {
            externalOnKeyDown?.(e)
            break
          }
          if (suggestions.length > 0) {
            e.preventDefault()
            handleSelect(suggestions[selectedIndex])
          }
          break

        case 'Escape':
          e.preventDefault()
          setState({
            isOpen: false,
            triggerType: null,
            searchText: '',
            triggerIndex: 0,
            position: null,
          })
          break

        default:
          // For other keys, also trigger parent onKeyDown
          externalOnKeyDown?.(e)
      }
    },
    [state.isOpen, suggestions, selectedIndex, handleSelect, externalOnKeyDown],
  )

  // Handle text change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  // Check for triggers on input and selection changes
  useEffect(() => {
    checkForTrigger()
  }, [checkForTrigger])

  // Handle click and selection changes
  const handleSelectionChange = useCallback(() => {
    // Delay slightly to ensure selection state is updated
    const id = setTimeout(() => {
      pendingTimers.current.delete(id)
      checkForTrigger()
    }, 0)
    pendingTimers.current.add(id)
  }, [checkForTrigger])

  return (
    <>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelectionChange}
        onClick={handleSelectionChange}
        className={cn(className)}
        {...props}
      />
      {isMounted &&
        state.isOpen &&
        state.position &&
        suggestions.length > 0 &&
        createPortal(
          <AutocompleteSuggestion
            suggestions={suggestions}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            position={state.position}
            isVisible={state.isOpen}
            searchText={state.searchText}
          />,
          document.body,
        )}
    </>
  )
})
