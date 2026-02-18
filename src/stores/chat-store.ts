import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessageMetadata, ChatToolCall } from '@/types'

// Local chat message type (matches the UI component's needs)
export interface LocalChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ChatToolCall[]
  sentAt?: Date // When message was sent/initiated
  completedAt?: Date // When assistant response finished
}

interface ChatState {
  // Current session ID (persisted to localStorage)
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void

  // Local message cache for the current session
  messages: LocalChatMessage[]
  setMessages: (messages: LocalChatMessage[]) => void
  addMessage: (message: LocalChatMessage) => void
  updateMessage: (id: string, updates: Partial<LocalChatMessage>) => void
  clearMessages: () => void

  // Hydration flag
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Session management
      currentSessionId: null,
      setCurrentSessionId: (id) =>
        set({
          currentSessionId: id,
          // Don't clear messages here - let the useEffect in chat-panel handle it
          // This prevents a flash of empty state when switching to cached sessions
        }),

      // Message management
      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      clearMessages: () => set({ messages: [] }),

      // Hydration
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'punt-chat',
      // Only persist the session ID, not messages (they come from DB)
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

/**
 * Transform database message metadata to local tool calls format
 */
export function transformMetadataToToolCalls(
  metadata: ChatMessageMetadata | null,
): ChatToolCall[] | undefined {
  if (!metadata?.toolCalls) return undefined
  return metadata.toolCalls.map((tc) => ({
    ...tc,
    status: tc.status || 'completed',
  }))
}
