'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sprintKeys } from '@/hooks/queries/use-sprints'
import { labelKeys, ticketKeys } from '@/hooks/queries/use-tickets'
import type { LabelEvent, SprintEvent, TicketEvent } from '@/lib/events'

// Reconnection config
const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

// Generate a unique tab/connection ID that persists for this browser tab session
const TAB_ID =
  typeof window !== 'undefined' ? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : ''

// Store the tab ID in sessionStorage so it persists across hot reloads but not across tabs
if (typeof window !== 'undefined' && !sessionStorage.getItem('punt-tab-id')) {
  sessionStorage.setItem('punt-tab-id', TAB_ID)
}

// Export the tab ID so mutations can include it
export function getTabId(): string {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('punt-tab-id') || TAB_ID
  }
  return ''
}

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface ConnectedEvent {
  type: 'connected'
  userId: string
}

type SSEEvent = TicketEvent | LabelEvent | SprintEvent | ConnectedEvent

/**
 * Hook for real-time synchronization via Server-Sent Events
 *
 * Connects to the SSE endpoint for the given project and invalidates
 * React Query cache when ticket events are received from other users.
 *
 * @param projectId - The project to subscribe to
 * @param enabled - Whether to enable the connection (default: true)
 * @returns Connection status for optional UI feedback
 */
export function useRealtime(projectId: string, enabled = true): RealtimeStatus {
  const queryClient = useQueryClient()
  const tabId = getTabId()

  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const mountedRef = useRef(true)

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (!projectId) return

    cleanup()
    setStatus('connecting')

    const eventSource = new EventSource(`/api/projects/${projectId}/events`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      if (!mountedRef.current) return
      // Reset reconnect delay on successful connection
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
    }

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return

      try {
        const data: SSEEvent = JSON.parse(event.data)

        // Handle connection confirmation
        if (data.type === 'connected') {
          setStatus('connected')
          return
        }

        // Skip events from this tab (already handled optimistically)
        // Use tabId instead of userId to allow same user to sync across tabs
        if (data.tabId && data.tabId === tabId) return

        // Invalidate React Query cache to trigger refetch based on event type
        if (data.type.startsWith('ticket.')) {
          queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
        } else if (data.type.startsWith('label.')) {
          queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
        } else if (data.type.startsWith('sprint.')) {
          queryClient.invalidateQueries({ queryKey: sprintKeys.byProject(projectId) })
          queryClient.invalidateQueries({ queryKey: sprintKeys.active(projectId) })
        }
      } catch {
        // Ignore parse errors (could be keepalive comments)
      }
    }

    eventSource.onerror = () => {
      if (!mountedRef.current) return

      eventSource.close()
      eventSourceRef.current = null
      setStatus('disconnected')

      // Schedule reconnection with exponential backoff
      const delay = reconnectDelayRef.current
      reconnectDelayRef.current = Math.min(
        delay * RECONNECT_BACKOFF_MULTIPLIER,
        MAX_RECONNECT_DELAY,
      )

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect()
        }
      }, delay)
    }
  }, [projectId, tabId, queryClient, cleanup])

  useEffect(() => {
    mountedRef.current = true

    if (enabled && projectId) {
      connect()
    }

    return () => {
      mountedRef.current = false
      cleanup()
      setStatus('disconnected')
    }
  }, [enabled, projectId, connect, cleanup])

  return status
}
