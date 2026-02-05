'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'

/**
 * Hook to synchronize ticket URL query parameter with drawer state
 *
 * - Reads `?ticket=PUNT-1` from URL on mount and opens the drawer
 * - Updates URL when `activeTicketId` changes (for shareable links)
 * - Handles sync without infinite loops via ref flag
 *
 * @param projectKey - The project key (e.g., "PUNT"), not the internal ID
 */
export function useTicketUrlSync(projectKey: string) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { activeTicketId, setActiveTicketId } = useUIStore()
  const { getColumns, _hasHydrated } = useBoardStore()
  const { getProjectByKey } = useProjectsStore()

  // Flag to prevent infinite loops during URL ↔ state sync
  const isSyncingRef = useRef(false)
  // Track if we've processed the initial URL param
  const hasProcessedUrlRef = useRef(false)

  // Get project by key to get internal ID for store lookups
  const project = getProjectByKey(projectKey)
  const projectId = project?.id

  // Get all tickets for this project
  const columns = projectId ? getColumns(projectId) : []
  const allTickets = columns.flatMap((col) => col.tickets)

  /**
   * Parse ticket key from URL param and find matching ticket
   * Format: PUNT-1 → find ticket with number 1 in project PUNT
   */
  const findTicketByKey = useCallback(
    (ticketKey: string) => {
      const match = ticketKey.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/i)
      if (!match) return null

      const [, keyPart, numberStr] = match
      const ticketNumber = Number.parseInt(numberStr, 10)

      // Verify key matches project (case-insensitive)
      if (keyPart.toUpperCase() !== projectKey.toUpperCase()) {
        return null
      }

      return allTickets.find((t) => t.number === ticketNumber) || null
    },
    [allTickets, projectKey],
  )

  /**
   * Get ticket key for a given ticket ID
   */
  const getTicketKey = useCallback(
    (ticketId: string) => {
      const ticket = allTickets.find((t) => t.id === ticketId)
      if (!ticket) return null
      return `${projectKey}-${ticket.number}`
    },
    [allTickets, projectKey],
  )

  // Effect 1: Read URL param on mount and open drawer
  useEffect(() => {
    // Wait for store hydration and tickets to load
    if (!_hasHydrated || allTickets.length === 0) return
    // Only process URL once per mount
    if (hasProcessedUrlRef.current) return

    const ticketParam = searchParams.get('ticket')
    if (!ticketParam) {
      hasProcessedUrlRef.current = true
      return
    }

    const ticket = findTicketByKey(ticketParam)
    if (ticket) {
      isSyncingRef.current = true
      setActiveTicketId(ticket.id)
      // Reset flag after state update settles
      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }
    hasProcessedUrlRef.current = true
  }, [_hasHydrated, allTickets.length, searchParams, findTicketByKey, setActiveTicketId])

  // Effect 2: Update URL when activeTicketId changes
  useEffect(() => {
    // Skip if we're syncing from URL → state (prevents loop)
    if (isSyncingRef.current) return
    // Wait for store hydration
    if (!_hasHydrated) return
    // Wait for initial URL processing
    if (!hasProcessedUrlRef.current) return

    const currentTicketParam = searchParams.get('ticket')

    if (activeTicketId) {
      // Drawer opened - add/update ticket param
      const ticketKey = getTicketKey(activeTicketId)
      if (ticketKey && ticketKey !== currentTicketParam) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('ticket', ticketKey)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }
    } else if (currentTicketParam) {
      // Drawer closed - remove ticket param
      const params = new URLSearchParams(searchParams.toString())
      params.delete('ticket')
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.replace(newUrl, { scroll: false })
    }
  }, [activeTicketId, _hasHydrated, pathname, router, searchParams, getTicketKey])

  /**
   * Check if URL has a ticket param that should prevent clearing activeTicketId
   */
  const hasTicketParam = useCallback(() => {
    return searchParams.has('ticket')
  }, [searchParams])

  return { hasTicketParam }
}
