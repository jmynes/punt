'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/lib/toast'
import type { ChatSessionSummary, ChatSessionWithMessages } from '@/types'

// Query keys for chat sessions
export const chatKeys = {
  all: ['chat-sessions'] as const,
  list: (projectId?: string) => ['chat-sessions', 'list', projectId] as const,
  detail: (sessionId: string) => ['chat-sessions', 'detail', sessionId] as const,
}

/**
 * Fetch user's chat sessions
 */
export function useChatSessions(projectId?: string) {
  return useQuery<ChatSessionSummary[]>({
    queryKey: chatKeys.list(projectId),
    queryFn: async () => {
      const params = projectId ? `?projectId=${projectId}` : ''
      const res = await fetch(`/api/chat/sessions${params}`)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      return res.json()
    },
    staleTime: 1000 * 30, // 30 seconds
  })
}

/**
 * Fetch a specific chat session with messages
 */
export function useChatSession(sessionId: string | null) {
  return useQuery<ChatSessionWithMessages>({
    queryKey: chatKeys.detail(sessionId || ''),
    queryFn: async () => {
      const res = await fetch(`/api/chat/sessions/${sessionId}`)
      if (!res.ok) throw new Error('Failed to fetch session')
      return res.json()
    },
    enabled: !!sessionId,
    staleTime: 1000 * 10, // 10 seconds
  })
}

/**
 * Create a new chat session
 */
export function useCreateChatSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name?: string; projectId?: string }) => {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create session')
      return res.json() as Promise<ChatSessionSummary>
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list(variables.projectId) })
    },
  })
}

/**
 * Rename a chat session
 */
export function useRenameChatSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, name }: { sessionId: string; name: string }) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to rename session')
      return res.json()
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all })
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(sessionId) })
      showToast.success('Conversation renamed')
    },
    onError: () => {
      showToast.error('Failed to rename conversation')
    },
  })
}

/**
 * Delete a chat session
 */
export function useDeleteChatSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete session')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all })
      showToast.success('Conversation deleted')
    },
    onError: () => {
      showToast.error('Failed to delete conversation')
    },
  })
}
