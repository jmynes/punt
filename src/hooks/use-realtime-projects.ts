'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { projectKeys } from '@/hooks/queries/use-projects'
import type { ProjectEvent } from '@/lib/events'
import { getTabId } from './use-realtime'

// Reconnection config
const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

export type RealtimeProjectsStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface ConnectedEvent {
  type: 'connected'
  userId: string
}

type SSEEvent = ProjectEvent | ConnectedEvent

/**
 * Hook for real-time synchronization of project list via Server-Sent Events
 *
 * Connects to the SSE endpoint for global project events and invalidates
 * React Query cache when project events are received from other users.
 *
 * @param enabled - Whether to enable the connection (default: true)
 * @returns Connection status for optional UI feedback
 */
export function useRealtimeProjects(enabled = true): RealtimeProjectsStatus {
  const queryClient = useQueryClient()
  const tabId = getTabId()

  const [status, setStatus] = useState<RealtimeProjectsStatus>('disconnected')
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

    cleanup()
    setStatus('connecting')

    const eventSource = new EventSource('/api/projects/events')
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

        // Invalidate React Query cache to trigger refetch of projects list
        queryClient.invalidateQueries({ queryKey: projectKeys.all })
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
  }, [tabId, queryClient, cleanup])

  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      connect()
    }

    return () => {
      mountedRef.current = false
      cleanup()
      setStatus('disconnected')
    }
  }, [enabled, connect, cleanup])

  return status
}
