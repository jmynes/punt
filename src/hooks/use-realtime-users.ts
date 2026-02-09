'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { brandingKeys } from '@/hooks/queries/use-branding'
import { getTabId } from '@/hooks/use-realtime'
import { isDemoMode } from '@/lib/demo'
import type { BrandingEvent, MemberEvent, SettingsEvent, UserEvent } from '@/lib/events'

// Reconnection config
const INITIAL_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface ConnectedEvent {
  type: 'connected'
  listenerId: string
}

type SSEEvent = UserEvent | BrandingEvent | SettingsEvent | MemberEvent | ConnectedEvent

/**
 * Hook for real-time user profile synchronization via Server-Sent Events
 *
 * Connects to the SSE endpoint for user events and updates the session
 * when profile changes are received from other tabs/browsers.
 *
 * In demo mode, returns 'connected' without establishing a real connection.
 *
 * @param enabled - Whether to enable the connection (default: true)
 * @returns Connection status for optional UI feedback
 */
export function useRealtimeUsers(enabled = true): RealtimeStatus {
  // Demo mode: skip SSE connection, data is local only
  if (isDemoMode()) {
    return 'connected'
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const queryClient = useQueryClient()
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const { update: updateSession } = useSession()
  const tabId = getTabId()

  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const eventSourceRef = useRef<EventSource | null>(null)
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const mountedRef = useRef(true)
  // Track if we should stop reconnecting (e.g., on 401)
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
  const shouldStopRef = useRef(false)

  // Stable cleanup function
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
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
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
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
          // Only refresh session if the update is for the current user
          // (Admin status changes for other users don't need session refresh)
          // Note: We don't have access to current user ID here, so we only
          // refresh session for profile changes (name, avatar) not admin status
          if (data.changes?.name !== undefined || data.changes?.avatar !== undefined) {
            updateSession()
          }

          // Update the admin users list cache directly instead of refetching
          queryClient.setQueriesData<
            Array<{ id: string; isSystemAdmin?: boolean; isActive?: boolean; name?: string }>
          >({ queryKey: ['admin', 'users'], exact: true }, (oldData) => {
            if (!oldData || !Array.isArray(oldData)) return oldData
            return oldData.map((user) => {
              if (user.id === data.userId && data.changes) {
                return {
                  ...user,
                  ...(data.changes.isSystemAdmin !== undefined && {
                    isSystemAdmin: data.changes.isSystemAdmin,
                  }),
                  ...(data.changes.isActive !== undefined && { isActive: data.changes.isActive }),
                  ...(data.changes.name !== undefined && { name: data.changes.name }),
                }
              }
              return user
            })
          })

          // Update individual user profile cache
          queryClient.setQueryData<{
            id: string
            isSystemAdmin?: boolean
            isActive?: boolean
            name?: string
          }>(['admin', 'users', data.userId], (oldData) => {
            if (!oldData || !data.changes) return oldData
            return {
              ...oldData,
              ...(data.changes.isSystemAdmin !== undefined && {
                isSystemAdmin: data.changes.isSystemAdmin,
              }),
              ...(data.changes.isActive !== undefined && { isActive: data.changes.isActive }),
              ...(data.changes.name !== undefined && { name: data.changes.name }),
            }
          })
        }

        // Handle branding updates
        if (data.type === 'branding.updated') {
          // Invalidate branding query to fetch new branding settings
          queryClient.invalidateQueries({ queryKey: brandingKeys.all })
        }

        // Handle settings updates
        if (data.type === 'settings.roles.updated') {
          // Invalidate role permissions query to fetch new settings
          queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'roles'] })
        }

        // Handle member events (added, removed, role updated)
        if (
          data.type === 'member.added' ||
          data.type === 'member.removed' ||
          data.type === 'member.role.updated'
        ) {
          // Invalidate the user details query if viewing that user's profile
          queryClient.invalidateQueries({ queryKey: ['admin', 'users', data.targetUserId] })
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
  // biome-ignore lint/correctness/useHookAtTopLevel: isDemoMode is build-time constant
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
