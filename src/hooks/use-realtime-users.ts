'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getTabId } from '@/hooks/use-realtime'
import type { UserEvent } from '@/lib/events'

// Reconnection config
const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface ConnectedEvent {
  type: 'connected'
  listenerId: string
}

type SSEEvent = UserEvent | ConnectedEvent

/**
 * Hook for real-time user profile synchronization via Server-Sent Events
 *
 * Connects to the SSE endpoint for user events and updates the session
 * when profile changes are received from other tabs/browsers.
 *
 * @param enabled - Whether to enable the connection (default: true)
 * @returns Connection status for optional UI feedback
 */
export function useRealtimeUsers(enabled = true): RealtimeStatus {
  const queryClient = useQueryClient()
  const { update: updateSession } = useSession()
  const tabId = getTabId()

  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const mountedRef = useRef(true)
  // Track if we should stop reconnecting (e.g., on 401)
  const shouldStopRef = useRef(false)

  // Stable cleanup function
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

  // Connect function - only depends on stable refs and cleanup
  const connect = useCallback(() => {
    if (!mountedRef.current || shouldStopRef.current) return

    cleanup()
    setStatus('connecting')

    const eventSource = new EventSource('/api/users/events')
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
        if (data.tabId && data.tabId === tabId) return

        // Handle user profile updates
        if (data.type === 'user.updated') {
          // Refresh the NextAuth session to get updated user data
          // The profile page will handle this through stableUser state
          updateSession()

          // Also invalidate any admin user queries
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
        }
      } catch {
        // Ignore parse errors (could be keepalive comments)
      }
    }

    eventSource.onerror = (errorEvent) => {
      if (!mountedRef.current) return

      eventSource.close()
      eventSourceRef.current = null
      setStatus('disconnected')

      // Check if this might be an auth error (EventSource doesn't expose status codes directly)
      // We'll use a heuristic: if we fail immediately after connecting, it's likely auth
      // For a proper solution, the server could send an error event before closing
      const target = errorEvent.target as EventSource
      if (target.readyState === EventSource.CLOSED) {
        // Connection was closed by server - might be 401
        // We'll still try to reconnect but with longer delay
      }

      // Schedule reconnection with exponential backoff
      const delay = reconnectDelayRef.current
      reconnectDelayRef.current = Math.min(
        delay * RECONNECT_BACKOFF_MULTIPLIER,
        MAX_RECONNECT_DELAY,
      )

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && !shouldStopRef.current) {
          connect()
        }
      }, delay)
    }
  }, [tabId, queryClient, updateSession, cleanup])

  // Effect to manage connection lifecycle
  useEffect(() => {
    mountedRef.current = true
    shouldStopRef.current = false

    if (enabled) {
      connect()
    } else {
      cleanup()
      setStatus('disconnected')
    }

    return () => {
      mountedRef.current = false
      cleanup()
      setStatus('disconnected')
    }
  }, [enabled, connect, cleanup])

  return status
}
