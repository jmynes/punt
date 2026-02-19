'use client'

import { activeEditor$, addComposerChild$, realmPlugin, useCellValue } from '@mdxeditor/editor'
import { Cell } from '@mdxeditor/gurx'
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
} from 'lexical'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TicketWithRelations, UserSummary } from '@/types'
import {
  AutocompleteSuggestion,
  type MentionSuggestion,
  type Suggestion,
  type TicketSuggestion,
} from './autocomplete-suggestion'

// Create cells for autocomplete state
export const autocompleteTickets$ = Cell<TicketWithRelations[]>([])
export const autocompleteMembers$ = Cell<UserSummary[]>([])
export const autocompleteProjectKey$ = Cell<string>('')

interface AutocompleteState {
  isOpen: boolean
  triggerType: 'ticket' | 'mention' | null
  searchText: string
  startOffset: number
  position: { top: number; left: number } | null
}

interface AutocompletePluginParams {
  tickets?: TicketWithRelations[]
  members?: UserSummary[]
  projectKey?: string
}

/**
 * MDXEditor plugin for autocomplete suggestions.
 * Supports:
 * - #123 or #KEY-123 for ticket references
 * - @username for mentions
 */
export const autocompletePlugin = realmPlugin<AutocompletePluginParams>({
  init: (realm, params) => {
    realm.pub(autocompleteTickets$, params?.tickets ?? [])
    realm.pub(autocompleteMembers$, params?.members ?? [])
    realm.pub(autocompleteProjectKey$, params?.projectKey ?? '')
    // Add the autocomplete UI component as a child of the editor
    realm.pub(addComposerChild$, AutocompleteUI)
  },
  update: (realm, params) => {
    if (params?.tickets) {
      realm.pub(autocompleteTickets$, params.tickets)
    }
    if (params?.members) {
      realm.pub(autocompleteMembers$, params.members)
    }
    if (params?.projectKey !== undefined) {
      realm.pub(autocompleteProjectKey$, params.projectKey)
    }
  },
})

/**
 * Component that renders the autocomplete UI.
 * Must be used as a child of MDXEditor with autocompletePlugin enabled.
 */
export function AutocompleteUI() {
  const activeEditor = useCellValue(activeEditor$)
  const tickets = useCellValue(autocompleteTickets$)
  const members = useCellValue(autocompleteMembers$)
  const projectKey = useCellValue(autocompleteProjectKey$)

  const [state, setState] = useState<AutocompleteState>({
    isOpen: false,
    triggerType: null,
    searchText: '',
    startOffset: 0,
    position: null,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state
  // Track when user is interacting with dropdown to prevent premature closing
  const isInteractingRef = useRef(false)

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
          const name = member.name.toLowerCase()
          const username = (member.username || '').toLowerCase()
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

  // Get caret position in the editor
  const getCaretPosition = useCallback(
    (_editor: LexicalEditor): { top: number; left: number } | null => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return null

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      // Position dropdown below the caret
      return {
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      }
    },
    [],
  )

  // Handle text input to detect triggers
  const checkForTrigger = useCallback(
    (editor: LexicalEditor) => {
      // Don't close dropdown while user is interacting with it
      if (isInteractingRef.current) {
        return
      }

      editor.getEditorState().read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setState((prev) => ({ ...prev, isOpen: false, triggerType: null }))
          return
        }

        const anchor = selection.anchor
        const anchorNode = anchor.getNode()

        if (!$isTextNode(anchorNode)) {
          setState((prev) => ({ ...prev, isOpen: false, triggerType: null }))
          return
        }

        const textContent = anchorNode.getTextContent()
        const offset = anchor.offset

        // Look backwards for trigger character
        let triggerIndex = -1
        let triggerType: 'ticket' | 'mention' | null = null

        for (let i = offset - 1; i >= 0; i--) {
          const char = textContent[i]

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
          const searchText = textContent.slice(triggerIndex + 1, offset)

          // Don't show for very long search texts
          if (searchText.length > 50) {
            setState((prev) => ({ ...prev, isOpen: false, triggerType: null }))
            return
          }

          const position = getCaretPosition(editor)

          setState({
            isOpen: true,
            triggerType,
            searchText,
            startOffset: triggerIndex,
            position,
          })
        } else {
          setState((prev) => ({ ...prev, isOpen: false, triggerType: null }))
        }
      })
    },
    [getCaretPosition],
  )

  // Handle suggestion selection
  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      if (!activeEditor) return

      activeEditor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return

        const anchor = selection.anchor
        const anchorNode = anchor.getNode()

        if (!$isTextNode(anchorNode)) return

        const textContent = anchorNode.getTextContent()
        const currentState = stateRef.current

        // Calculate text to replace (from trigger to current position)
        const beforeTrigger = textContent.slice(0, currentState.startOffset)
        const afterCursor = textContent.slice(anchor.offset)

        // Generate replacement text
        let replacement: string
        if (suggestion.type === 'ticket') {
          replacement = `${suggestion.projectKey}-${suggestion.ticket.number}`
        } else {
          replacement = `@${suggestion.user.username || suggestion.user.name}`
        }

        // Replace the text
        const newText = `${beforeTrigger}${replacement} ${afterCursor}`
        anchorNode.setTextContent(newText)

        // Move cursor after the inserted text
        const newOffset = beforeTrigger.length + replacement.length + 1
        selection.anchor.set(anchorNode.getKey(), newOffset, 'text')
        selection.focus.set(anchorNode.getKey(), newOffset, 'text')
      })

      setState({
        isOpen: false,
        triggerType: null,
        searchText: '',
        startOffset: 0,
        position: null,
      })
    },
    [activeEditor],
  )

  // Track when user is interacting with dropdown
  const handleInteractionChange = useCallback((isInteracting: boolean) => {
    isInteractingRef.current = isInteracting
  }, [])

  // Set up editor listeners
  useEffect(() => {
    if (!activeEditor) return

    // Listen for text changes
    const removeTextListener = activeEditor.registerTextContentListener(() => {
      checkForTrigger(activeEditor)
    })

    // Listen for selection changes
    const removeSelectionListener = activeEditor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          checkForTrigger(activeEditor)
        }
      })
    })

    // Handle keyboard events for navigation
    const removeKeyDownListener = activeEditor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const currentState = stateRef.current
        if (!currentState.isOpen) return false

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
            return true

          case 'ArrowUp':
            event.preventDefault()
            setSelectedIndex((prev) => Math.max(prev - 1, 0))
            return true

          case 'Tab':
          case 'Enter':
            if (suggestions.length > 0) {
              event.preventDefault()
              handleSelect(suggestions[selectedIndex])
              return true
            }
            return false

          case 'Escape':
            setState({
              isOpen: false,
              triggerType: null,
              searchText: '',
              startOffset: 0,
              position: null,
            })
            return true

          default:
            return false
        }
      },
      COMMAND_PRIORITY_HIGH,
    )

    return () => {
      removeTextListener()
      removeSelectionListener()
      removeKeyDownListener()
    }
  }, [activeEditor, checkForTrigger, handleSelect, suggestions, selectedIndex])

  // Render dropdown using portal
  if (!state.isOpen || typeof window === 'undefined') {
    return null
  }

  return createPortal(
    <AutocompleteSuggestion
      suggestions={suggestions}
      selectedIndex={selectedIndex}
      onSelect={handleSelect}
      position={state.position}
      isVisible={state.isOpen}
      searchText={state.searchText}
      onInteractionChange={handleInteractionChange}
    />,
    document.body,
  )
}
