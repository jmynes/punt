'use client'

import {
  type Collision,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { List, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BacklogTable, ColumnConfig } from '@/components/backlog'
import { SprintSection } from '@/components/sprints'
import { type TableContext, TicketTableRow } from '@/components/table'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useProjectSprints, useUpdateTicketSprint } from '@/hooks/queries/use-sprints'
import {
  updateTicketAPI,
  useColumnsByProject,
  useTicketsByProject,
} from '@/hooks/queries/use-tickets'
import { useHasPermission } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { useTicketUrlSync } from '@/hooks/use-ticket-url-sync'
import { PERMISSIONS } from '@/lib/permissions'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'

/**
 * Pointer-based collision detection for intuitive drag-and-drop.
 * Uses cursor Y position to determine drop target, allowing drops below the last item.
 *
 * Algorithm:
 * 1. Collect all ticket/row droppables sorted by Y position
 * 2. Find where cursor Y falls relative to row midpoints
 * 3. Return collision with insertIndex metadata for precise positioning
 */
const createPointerCollisionDetection = (
  ticketsBySprint: Record<string, { id: string }[]>,
): CollisionDetection => {
  return (args) => {
    const { pointerCoordinates, droppableRects, droppableContainers } = args

    // Fallback to rect intersection for keyboard navigation
    if (!pointerCoordinates) {
      return rectIntersection(args)
    }

    const cursorY = pointerCoordinates.y
    const cursorX = pointerCoordinates.x

    // Collect all ticket droppables with their rects and section info
    type DroppableInfo = {
      id: string
      rect: { top: number; bottom: number; left: number; right: number }
      sectionId: string
      type: 'ticket' | 'backlog-ticket'
      index: number
    }

    const ticketDroppables: DroppableInfo[] = []
    const sectionDroppables: {
      id: string
      rect: { top: number; bottom: number; left: number; right: number }
      sectionId: string
    }[] = []

    for (const container of droppableContainers) {
      const rect = droppableRects.get(container.id)
      if (!rect) continue

      const type = container.data.current?.type as string | undefined
      const sectionId = (container.data.current?.sprintId as string | null) ?? 'backlog'

      if (type === 'ticket' || type === 'backlog-ticket') {
        // Find the index of this ticket in its section
        const sectionTickets = ticketsBySprint[sectionId] ?? []
        const ticketId = container.id as string
        const index = sectionTickets.findIndex((t) => t.id === ticketId)

        ticketDroppables.push({
          id: ticketId,
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
          sectionId,
          type: type as 'ticket' | 'backlog-ticket',
          index: index >= 0 ? index : sectionTickets.length,
        })
      } else if (type === 'sprint-section') {
        sectionDroppables.push({
          id: container.id as string,
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
          sectionId,
        })
      }
    }

    // Sort tickets by Y position (top to bottom)
    ticketDroppables.sort((a, b) => a.rect.top - b.rect.top)

    // Group tickets by section for within-section calculations
    const ticketsBySection: Record<string, DroppableInfo[]> = {}
    for (const t of ticketDroppables) {
      if (!ticketsBySection[t.sectionId]) ticketsBySection[t.sectionId] = []
      ticketsBySection[t.sectionId].push(t)
    }

    // First, check if cursor is within any section's ticket area
    for (const [sectionId, sectionTickets] of Object.entries(ticketsBySection)) {
      if (sectionTickets.length === 0) continue

      // Sort by Y position within section - this gives us the VISUAL order
      sectionTickets.sort((a, b) => a.rect.top - b.rect.top)

      const firstTicket = sectionTickets[0]
      const lastTicket = sectionTickets[sectionTickets.length - 1]

      // Check if cursor X is within the ticket area (with some padding)
      const isWithinXBounds =
        cursorX >= firstTicket.rect.left - 50 && cursorX <= firstTicket.rect.right + 50

      if (!isWithinXBounds) continue

      // Check if cursor is within the vertical bounds of this section's tickets
      // (from top of first ticket to bottom of last ticket, plus some padding below)
      const sectionTop = firstTicket.rect.top
      const sectionBottom = lastTicket.rect.bottom + 100 // Extra padding below last item

      // Check if cursor is ABOVE the first ticket (e.g., over column headers)
      // This should target index 0 (top of list), not end of list
      const sectionContainer = sectionDroppables.find((s) => s.sectionId === sectionId)
      if (sectionContainer && cursorY < sectionTop && cursorY >= sectionContainer.rect.top) {
        // Cursor is above tickets but within section container (header area)
        // Target the start of the list
        const collision: Collision = {
          id: firstTicket.id,
          data: {
            droppableContainer: {
              id: firstTicket.id,
              data: {
                current: {
                  type: firstTicket.type,
                  sectionId,
                  insertIndex: 0, // Insert at start
                },
              },
            },
          },
        }
        return [collision]
      }

      if (cursorY >= sectionTop && cursorY <= sectionBottom) {
        // Find insertion point based on cursor Y vs row midpoints
        // IMPORTANT: Use loop index 'i' as insertIndex (visual position), not ticket.index (data position)
        for (let i = 0; i < sectionTickets.length; i++) {
          const ticket = sectionTickets[i]
          const midpoint = (ticket.rect.top + ticket.rect.bottom) / 2

          if (cursorY < midpoint) {
            // Insert BEFORE this ticket at visual position i
            const collision: Collision = {
              id: ticket.id,
              data: {
                droppableContainer: {
                  id: ticket.id,
                  data: {
                    current: {
                      type: ticket.type,
                      sectionId,
                      insertIndex: i, // Visual position, not data index
                    },
                  },
                },
              },
            }
            return [collision]
          }
        }

        // Cursor is below all tickets in this section - insert at end
        const lastTicketInSection = sectionTickets[sectionTickets.length - 1]
        // Use visual count (Y-sorted array length), not data array length
        const visualTicketCount = sectionTickets.length

        // Return the section container as target with insert at end
        const sectionContainer = sectionDroppables.find((s) => s.sectionId === sectionId)
        if (sectionContainer) {
          const collision: Collision = {
            id: sectionContainer.id,
            data: {
              droppableContainer: {
                id: sectionContainer.id,
                data: {
                  current: {
                    type: 'sprint-section',
                    sprintId: sectionId === 'backlog' ? null : sectionId,
                    sectionId,
                    insertIndex: visualTicketCount,
                  },
                },
              },
            },
          }
          return [collision]
        }

        // Fallback: return last ticket with index pointing to end
        const collision: Collision = {
          id: lastTicketInSection.id,
          data: {
            droppableContainer: {
              id: lastTicketInSection.id,
              data: {
                current: {
                  type: lastTicketInSection.type,
                  sectionId,
                  insertIndex: visualTicketCount,
                },
              },
            },
          },
        }
        return [collision]
      }
    }

    // If not over any ticket area, check if over a section container (for empty sections)
    for (const section of sectionDroppables) {
      if (
        cursorY >= section.rect.top &&
        cursorY <= section.rect.bottom &&
        cursorX >= section.rect.left &&
        cursorX <= section.rect.right
      ) {
        // Use visual count from ticketsBySection (droppables found), not data array
        const visualTicketCount = ticketsBySection[section.sectionId]?.length ?? 0
        const collision: Collision = {
          id: section.id,
          data: {
            droppableContainer: {
              id: section.id,
              data: {
                current: {
                  type: 'sprint-section',
                  sprintId: section.sectionId === 'backlog' ? null : section.sectionId,
                  sectionId: section.sectionId,
                  insertIndex: visualTicketCount,
                },
              },
            },
          },
        }
        return [collision]
      }
    }

    // Fallback to rect intersection
    return rectIntersection(args)
  }
}

export default function BacklogPage() {
  const params = useParams()
  const router = useRouter()
  const projectKey = params.projectId as string // URL now uses project key
  const { getProjectByKey, isLoading: projectsLoading } = useProjectsStore()
  const project = getProjectByKey(projectKey)
  const projectId = project?.id || projectKey // Use ID if found, fallback to key for API calls

  const { getColumns, updateTicket, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection, selectedTicketIds } = useSelectionStore()
  const {
    columns: backlogColumns,
    setBacklogOrder,
    reorderColumns,
    backlogOrder,
  } = useBacklogStore()

  // API mutations
  const updateTicketSprintMutation = useUpdateTicketSprint(projectId)

  // Drag state for sprint sections and backlog table
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  // Unified drop position: sectionId + insertIndex for all sections (sprints and backlog)
  const [dropPosition, setDropPosition] = useState<{
    sectionId: string
    insertIndex: number
  } | null>(null)
  const draggedIdsRef = useRef<string[]>([])
  // Store active drag data because sortable item gets filtered out during drag
  const activeDragDataRef = useRef<{
    type: string | undefined
    sprintId: string | null | undefined
  }>({ type: undefined, sprintId: undefined })

  // URL ↔ drawer sync for shareable ticket links
  const { hasTicketParam } = useTicketUrlSync(projectId)

  // DnD sensors - shared across sprint sections and backlog table
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Fetch columns from API
  const { isLoading: columnsLoading, isSuccess: columnsLoaded } = useColumnsByProject(projectId, {
    enabled: _hasHydrated,
  })

  // Fetch tickets from API (only after columns are loaded)
  const { isLoading: ticketsLoading } = useTicketsByProject(projectId, {
    enabled: _hasHydrated && columnsLoaded,
  })

  // Connect to real-time updates (after initial load)
  useRealtime(projectId, _hasHydrated && columnsLoaded && !ticketsLoading)

  // Fetch all sprints
  const { data: sprints } = useProjectSprints(projectId)

  // Check permission to create tickets
  const canCreateTickets = useHasPermission(projectId, PERMISSIONS.TICKETS_CREATE)

  // Get active and planning sprints (exclude completed)
  const activeSprints = useMemo(
    () => sprints?.filter((s) => s.status === 'active') ?? [],
    [sprints],
  )
  const planningSprints = useMemo(
    () => sprints?.filter((s) => s.status === 'planning') ?? [],
    [sprints],
  )

  // Get columns for this project
  const columns = getColumns(projectId)

  // Track which projects have been initialized to prevent re-running
  const initializedProjectsRef = useRef<Set<string>>(new Set())

  // Clear selection and active ticket when entering this page
  // (unless URL has a ticket param that should open the drawer)
  useEffect(() => {
    clearSelection()
    if (!hasTicketParam()) {
      setActiveTicketId(null)
    }
  }, [clearSelection, setActiveTicketId, hasTicketParam])

  // Set active project after hydration
  useEffect(() => {
    if (!_hasHydrated) return
    if (initializedProjectsRef.current.has(projectId)) {
      setActiveProjectId(projectId)
      return
    }
    initializedProjectsRef.current.add(projectId)
    setActiveProjectId(projectId)
  }, [_hasHydrated, projectId, setActiveProjectId])

  // Extract all tickets from columns (flattened for backlog view)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

  // Group tickets by sprint
  const ticketsBySprint = useMemo(() => {
    const groups: Record<string, typeof allTickets> = { backlog: [] }

    // Initialize groups for each sprint
    sprints?.forEach((sprint) => {
      groups[sprint.id] = []
    })

    // Sort tickets into groups
    allTickets.forEach((ticket) => {
      const sprintId = ticket.sprintId ?? 'backlog'
      if (groups[sprintId]) {
        groups[sprintId].push(ticket)
      } else {
        groups.backlog.push(ticket)
      }
    })

    // Sort tickets within each group by order
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.order - b.order)
    })

    return groups
  }, [allTickets, sprints])

  // Find the selected ticket
  const selectedTicket = useMemo(
    () => allTickets.find((t) => t.id === activeTicketId) || null,
    [activeTicketId, allTickets],
  )

  // Sprint completion detection (handles expired sprint prompts)
  useSprintCompletion({
    projectId,
    tickets: allTickets,
    columns,
  })

  // Drag handlers - unified for sprint sections and backlog table
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const dataType = active.data.current?.type

      // Handle both 'ticket' (from sprint) and 'backlog-ticket' (from backlog table)
      if (dataType !== 'ticket' && dataType !== 'backlog-ticket') return

      const ticket = active.data.current?.ticket as TicketWithRelations
      setActiveTicket(ticket)

      // Capture drag data in ref (needed because sortable item may be filtered out during drag)
      activeDragDataRef.current = {
        type: dataType,
        sprintId: active.data.current?.sprintId as string | null | undefined,
      }

      const selected = Array.from(selectedTicketIds)
      const activeId = active.id as string

      let ticketIds: string[]
      if (selected.length > 1 && selected.includes(activeId)) {
        ticketIds = selected
      } else {
        ticketIds = [activeId]
      }

      setDraggingTicketIds(ticketIds)
      draggedIdsRef.current = ticketIds
    },
    [selectedTicketIds],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event
      if (!over) {
        setDropPosition(null)
        return
      }

      const overId = over.id as string
      const overType = over.data.current?.type
      const draggedIds = draggedIdsRef.current

      // If hovering over a dragged ticket, don't show indicator
      if (draggedIds.includes(overId)) {
        setDropPosition(null)
        return
      }

      // Extract section and insert index from collision data
      // The pointer collision detection already calculated this
      const sectionId = (over.data.current?.sectionId as string) ?? 'backlog'
      const insertIndex = over.data.current?.insertIndex as number | undefined

      if (insertIndex !== undefined) {
        setDropPosition({ sectionId, insertIndex })
        return
      }

      // Fallback: calculate insert index from ticket position
      if (overType === 'ticket' || overType === 'backlog-ticket') {
        for (const [section, sectionTickets] of Object.entries(ticketsBySprint)) {
          const ticketIndex = sectionTickets.findIndex((t) => t.id === overId)
          if (ticketIndex !== -1) {
            setDropPosition({ sectionId: section, insertIndex: ticketIndex })
            return
          }
        }
      }

      // Hovering over sprint section (empty area or end of list)
      if (overType === 'sprint-section') {
        const sprintId = (over.data.current?.sprintId as string | null) ?? 'backlog'
        const sectionTickets = ticketsBySprint[sprintId] ?? []
        setDropPosition({ sectionId: sprintId, insertIndex: sectionTickets.length })
        return
      }

      setDropPosition(null)
    },
    [ticketsBySprint],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedIds = draggedIdsRef.current
      const { active, over } = event

      // Clean up all drag state
      setActiveTicket(null)
      setDraggingTicketIds([])
      setDropPosition(null)
      draggedIdsRef.current = []

      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string
      // Normalize null/undefined sprint IDs to null for comparison
      const activeSprintId =
        activeDragDataRef.current.sprintId ?? active.data.current?.sprintId ?? null
      const overType = over.data.current?.type

      // Clear the captured drag data
      activeDragDataRef.current = { type: undefined, sprintId: undefined }

      // Get visible backlog column IDs for column reordering detection
      const visibleColumnIds = backlogColumns.filter((c) => c.visible).map((c) => c.id)

      // Case 1: Column reordering in backlog table
      if (visibleColumnIds.includes(activeId as (typeof visibleColumnIds)[number])) {
        if (activeId !== overId) {
          const oldIndex = backlogColumns.findIndex((c) => c.id === activeId)
          const newIndex = backlogColumns.findIndex((c) => c.id === overId)
          if (oldIndex !== -1 && newIndex !== -1) {
            reorderColumns(oldIndex, newIndex)
          }
        }
        return
      }

      // Determine target section from over data
      let targetSprintId: string | null = null
      if (overType === 'sprint-section') {
        targetSprintId = over.data.current?.sprintId as string | null
      } else if (overType === 'ticket') {
        targetSprintId = over.data.current?.sprintId as string | null
      } else if (overType === 'backlog-ticket') {
        targetSprintId = null
      } else {
        return
      }

      // Get insertion index from collision data (calculated by pointer collision detection)
      const collisionInsertIndex = over.data.current?.insertIndex as number | undefined
      const insertAt = collisionInsertIndex ?? dropPosition?.insertIndex

      // Determine if this is same-section reorder or cross-section move
      const isSameSection = activeSprintId === targetSprintId
      const targetSectionKey = targetSprintId ?? 'backlog'

      // Helper to adjust insert index for removed items
      // The collision detection gives insertIndex in the ORIGINAL list (with dragged items)
      // We need to convert it to an index in the FILTERED list (without dragged items)
      const adjustInsertIndexForRemovedItems = (
        originalInsertAt: number,
        originalList: { id: string }[],
        draggedIdSet: Set<string>,
      ): number => {
        // Count how many dragged items are at positions BEFORE the insert index
        let adjustment = 0
        for (let i = 0; i < originalInsertAt && i < originalList.length; i++) {
          if (draggedIdSet.has(originalList[i].id)) {
            adjustment++
          }
        }
        return originalInsertAt - adjustment
      }

      const draggedIdSet = new Set(draggedIds)

      // Case A: Same-section reordering (within sprint or within backlog)
      if (isSameSection) {
        // Handle backlog reordering (uses local backlogOrder state)
        if (targetSectionKey === 'backlog') {
          const rawBacklogTickets = ticketsBySprint.backlog ?? []

          // Apply existing backlog order to maintain current view order
          const existingOrder = backlogOrder[projectId] || []
          const orderSet = new Set(existingOrder)
          const orderedTickets = existingOrder
            .map((id) => rawBacklogTickets.find((t) => t.id === id))
            .filter(Boolean) as typeof rawBacklogTickets
          const remainingTickets = rawBacklogTickets.filter((t) => !orderSet.has(t.id))
          const backlogTickets = [...orderedTickets, ...remainingTickets]

          // Remove dragged tickets and reinsert at target position
          const ticketsWithoutDragged = backlogTickets.filter((t) => !draggedIdSet.has(t.id))
          const draggedInOrder = backlogTickets.filter((t) => draggedIdSet.has(t.id))

          // Calculate insert position in the filtered list, adjusting for removed items
          const rawInsertAt = insertAt ?? backlogTickets.length
          const effectiveInsertAt = adjustInsertIndexForRemovedItems(
            rawInsertAt,
            backlogTickets,
            draggedIdSet,
          )

          const newOrderedTickets = [
            ...ticketsWithoutDragged.slice(0, effectiveInsertAt),
            ...draggedInOrder,
            ...ticketsWithoutDragged.slice(effectiveInsertAt),
          ]

          setBacklogOrder(
            projectId,
            newOrderedTickets.map((t) => t.id),
          )

          if (draggedIds.length > 1) {
            clearSelection()
          }

          // Persist order changes to API
          const ticketsToUpdate: { id: string; order: number }[] = []
          for (let i = 0; i < newOrderedTickets.length; i++) {
            const ticket = newOrderedTickets[i]
            if (ticket.order !== i) {
              updateTicket(projectId, ticket.id, { order: i })
              ticketsToUpdate.push({ id: ticket.id, order: i })
            }
          }

          if (ticketsToUpdate.length > 0) {
            ;(async () => {
              try {
                for (const { id, order } of ticketsToUpdate) {
                  await updateTicketAPI(projectId, id, { order })
                }
              } catch (err) {
                console.error('Failed to persist backlog reorder:', err)
              }
            })()
          }
          return
        }

        // Handle sprint reordering
        const sectionTickets = ticketsBySprint[targetSectionKey] ?? []

        // Remove dragged tickets and reinsert at target position
        const ticketsWithoutDragged = sectionTickets.filter((t) => !draggedIdSet.has(t.id))
        const draggedInOrder = sectionTickets.filter((t) => draggedIdSet.has(t.id))

        // Calculate insert position in the filtered list, adjusting for removed items
        const rawInsertAt = insertAt ?? sectionTickets.length
        const effectiveInsertAt = adjustInsertIndexForRemovedItems(
          rawInsertAt,
          sectionTickets,
          draggedIdSet,
        )

        const reordered = [
          ...ticketsWithoutDragged.slice(0, effectiveInsertAt),
          ...draggedInOrder,
          ...ticketsWithoutDragged.slice(effectiveInsertAt),
        ]

        // Update order for each ticket based on new position
        const ticketsToUpdate: { id: string; order: number }[] = []
        for (let i = 0; i < reordered.length; i++) {
          const ticket = reordered[i]
          if (ticket.order !== i) {
            updateTicket(projectId, ticket.id, { order: i })
            ticketsToUpdate.push({ id: ticket.id, order: i })
          }
        }
        // Persist to API
        ;(async () => {
          try {
            for (const { id, order } of ticketsToUpdate) {
              await updateTicketAPI(projectId, id, { order })
            }
          } catch (err) {
            console.error('Failed to persist ticket reorder:', err)
          }
        })()
        return
      }

      // Case B: Cross-section move (sprint to backlog, backlog to sprint, or sprint to sprint)
      if (draggedIds.length === 0) return

      const ticketsToMove = allTickets.filter((t) => draggedIds.includes(t.id))
      if (ticketsToMove.length === 0) return

      const ticketsChangingSprint = ticketsToMove.filter((t) => t.sprintId !== targetSprintId)
      if (ticketsChangingSprint.length === 0) return

      // Get target section tickets and calculate insertion
      // For cross-section moves, the dragged items aren't in the target section,
      // but we still need to adjust in case any are (shouldn't happen in normal flow)
      // IMPORTANT: For backlog, use visual order (backlogOrder) not data order (ticketsBySprint)
      // because the collision detection returns insertIndex based on visual position
      let targetSectionTickets: typeof allTickets
      if (targetSectionKey === 'backlog') {
        const rawBacklogTickets = ticketsBySprint.backlog ?? []
        const existingOrder = backlogOrder[projectId] || []
        const orderSet = new Set(existingOrder)
        const orderedTickets = existingOrder
          .map((id) => rawBacklogTickets.find((t) => t.id === id))
          .filter(Boolean) as typeof rawBacklogTickets
        const remainingTickets = rawBacklogTickets.filter((t) => !orderSet.has(t.id))
        targetSectionTickets = [...orderedTickets, ...remainingTickets]
      } else {
        targetSectionTickets = [...(ticketsBySprint[targetSectionKey] ?? [])]
      }
      const ticketsNotMoving = targetSectionTickets.filter((t) => !draggedIdSet.has(t.id))
      const rawInsertAt = insertAt ?? targetSectionTickets.length
      const effectiveInsertAt = adjustInsertIndexForRemovedItems(
        rawInsertAt,
        targetSectionTickets,
        draggedIdSet,
      )

      // Insert the moved tickets at the correct position
      const reorderedTarget = [
        ...ticketsNotMoving.slice(0, effectiveInsertAt),
        ...ticketsChangingSprint,
        ...ticketsNotMoving.slice(effectiveInsertAt),
      ]

      // Create a map of ticket ID to new order
      const newOrderMap = new Map<string, number>()
      for (let idx = 0; idx < reorderedTarget.length; idx++) {
        newOrderMap.set(reorderedTarget[idx].id, idx)
      }

      // Capture original sprint IDs and orders for undo
      const originalSprintIds = ticketsChangingSprint.map((t) => ({
        ticketId: t.id,
        sprintId: t.sprintId,
        order: t.order,
        newOrder: newOrderMap.get(t.id) ?? t.order,
      }))

      const fromSprints = new Set(ticketsChangingSprint.map((t) => t.sprintId ?? 'backlog'))
      const targetSprintName =
        targetSprintId === null
          ? 'Backlog'
          : (sprints?.find((s) => s.id === targetSprintId)?.name ?? 'Sprint')

      const count = ticketsChangingSprint.length
      const fromLabel =
        fromSprints.size === 1
          ? fromSprints.has('backlog')
            ? 'Backlog'
            : (sprints?.find((s) => s.id === Array.from(fromSprints)[0])?.name ?? 'Sprint')
          : 'multiple sprints'

      // Calculate which existing tickets in target section need order updates
      const existingTicketsToReorder: { id: string; oldOrder: number; newOrder: number }[] = []
      for (const ticket of ticketsNotMoving) {
        const newOrder = newOrderMap.get(ticket.id)
        if (newOrder !== undefined && newOrder !== ticket.order) {
          existingTicketsToReorder.push({ id: ticket.id, oldOrder: ticket.order, newOrder })
        }
      }

      // Optimistic update (sprintId and order for moved tickets)
      for (const item of originalSprintIds) {
        updateTicket(projectId, item.ticketId, { sprintId: targetSprintId, order: item.newOrder })
      }

      // Optimistic update for existing tickets that need reordering
      for (const item of existingTicketsToReorder) {
        updateTicket(projectId, item.id, { order: item.newOrder })
      }

      // When moving TO backlog, also update backlogOrder to preserve visual position
      // Capture original order for undo
      const originalBacklogOrder = backlogOrder[projectId] || []
      if (targetSectionKey === 'backlog') {
        const newBacklogOrder = reorderedTarget.map((t) => t.id)
        setBacklogOrder(projectId, newBacklogOrder)
      }

      // Show undo/redo toast
      const toastId = showUndoRedoToast('success', {
        title:
          count === 1
            ? `Ticket moved to ${targetSprintName}`
            : `${count} tickets moved to ${targetSprintName}`,
        description: `From ${fromLabel}`,
        showUndoButtons: true,
        onUndo: (id) => {
          // Move entry from undo to redo stack
          useUndoStore.getState().undoByToastId(id)
          // Revert to original sprint IDs and orders for moved tickets
          for (const { ticketId, sprintId, order } of originalSprintIds) {
            updateTicket(projectId, ticketId, { sprintId, order })
          }
          // Revert order changes for existing tickets in target section
          for (const { id: ticketId, oldOrder } of existingTicketsToReorder) {
            updateTicket(projectId, ticketId, { order: oldOrder })
          }
          // Restore original backlog order if we moved to backlog
          if (targetSectionKey === 'backlog') {
            setBacklogOrder(projectId, originalBacklogOrder)
          }
          // Persist undo to database
          Promise.all([
            ...originalSprintIds.map(({ ticketId, sprintId, order }) =>
              updateTicketSprintMutation.mutateAsync({ ticketId, sprintId, order }),
            ),
            ...existingTicketsToReorder.map(({ id: ticketId, oldOrder }) =>
              updateTicketAPI(projectId, ticketId, { order: oldOrder }),
            ),
          ]).catch(() => {
            // Refetch will handle sync
          })
        },
        onRedo: (id) => {
          // Move entry from redo to undo stack
          useUndoStore.getState().redoByToastId(id)
          // Re-apply move to target sprint with new orders
          for (const { ticketId, newOrder } of originalSprintIds) {
            updateTicket(projectId, ticketId, { sprintId: targetSprintId, order: newOrder })
          }
          // Re-apply order changes for existing tickets in target section
          for (const { id: ticketId, newOrder } of existingTicketsToReorder) {
            updateTicket(projectId, ticketId, { order: newOrder })
          }
          // Re-apply new backlog order if we moved to backlog
          if (targetSectionKey === 'backlog') {
            const newBacklogOrder = reorderedTarget.map((t) => t.id)
            setBacklogOrder(projectId, newBacklogOrder)
          }
          // Persist redo to database
          Promise.all([
            ...originalSprintIds.map(({ ticketId, newOrder }) =>
              updateTicketSprintMutation.mutateAsync({
                ticketId,
                sprintId: targetSprintId,
                order: newOrder,
              }),
            ),
            ...existingTicketsToReorder.map(({ id: ticketId, newOrder }) =>
              updateTicketAPI(projectId, ticketId, { order: newOrder }),
            ),
          ]).catch(() => {
            // Refetch will handle sync
          })
        },
        undoneTitle: 'Move undone',
        undoneDescription: `${count === 1 ? 'Ticket' : `${count} tickets`} returned to ${fromLabel}`,
        redoneTitle:
          count === 1
            ? `Ticket moved to ${targetSprintName}`
            : `${count} tickets moved to ${targetSprintName}`,
        redoneDescription: `From ${fromLabel}`,
      })

      // Register in undo store for keyboard shortcuts (Ctrl+Z/Y)
      useUndoStore.getState().pushSprintMove(
        projectId,
        originalSprintIds.map(({ ticketId, sprintId }) => ({
          ticketId,
          fromSprintId: sprintId,
          toSprintId: targetSprintId,
        })),
        fromLabel,
        targetSprintName,
        toastId,
      )

      // Persist to database (moved tickets + reordered existing tickets)
      Promise.all([
        ...originalSprintIds.map(({ ticketId, newOrder }) =>
          updateTicketSprintMutation.mutateAsync({
            ticketId,
            sprintId: targetSprintId,
            order: newOrder,
          }),
        ),
        ...existingTicketsToReorder.map(({ id: ticketId, newOrder }) =>
          updateTicketAPI(projectId, ticketId, { order: newOrder }),
        ),
      ]).catch((error) => {
        // Revert on error
        for (const { ticketId, sprintId, order } of originalSprintIds) {
          updateTicket(projectId, ticketId, { sprintId, order })
        }
        for (const { id: ticketId, oldOrder } of existingTicketsToReorder) {
          updateTicket(projectId, ticketId, { order: oldOrder })
        }
        showUndoRedoToast('error', {
          title: 'Failed to move tickets',
          description: error.message,
          showUndoButtons: false,
          onUndo: () => {},
        })
      })
    },
    [
      allTickets,
      sprints,
      projectId,
      updateTicket,
      updateTicketSprintMutation,
      backlogColumns,
      reorderColumns,
      ticketsBySprint,
      backlogOrder,
      setBacklogOrder,
      clearSelection,
      dropPosition,
    ],
  )

  // Redirect to dashboard if project doesn't exist after loading
  useEffect(() => {
    if (!projectsLoading && !project) {
      router.replace('/')
    }
  }, [projectsLoading, project, router])

  if (!projectsLoading && !project) {
    return null
  }

  if (!_hasHydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-zinc-500">Loading backlog...</div>
      </div>
    )
  }

  if (columnsLoading || ticketsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-zinc-500">
          {columnsLoading ? 'Loading columns...' : 'Loading tickets...'}
        </p>
      </div>
    )
  }

  const hasActiveSprints = activeSprints.length > 0 || planningSprints.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex-shrink-0 flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800">
            <List className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              {project?.key || projectKey} Backlog
            </h1>
            <p className="text-sm text-zinc-500">
              View and manage all tickets in a configurable list
            </p>
          </div>
        </div>

        {canCreateTickets && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => setCreateTicketOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">New Ticket</span>
            </Button>
          </div>
        )}
      </div>

      {/* Unified DnD context wrapping sprint sections AND backlog table */}
      <DndContext
        id="unified-backlog-dnd"
        sensors={sensors}
        collisionDetection={createPointerCollisionDetection(ticketsBySprint)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Sprint sections (if any sprints exist) */}
        {hasActiveSprints && (
          <div className="flex-shrink-0 p-4 lg:px-6 space-y-3 border-b border-zinc-800">
            {/* Active Sprints */}
            {activeSprints.map((sprint) => (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                tickets={ticketsBySprint[sprint.id] ?? []}
                projectKey={projectKey}
                projectId={projectId}
                statusColumns={columns}
                defaultExpanded={true}
                draggingTicketIds={draggingTicketIds}
                dropPosition={
                  dropPosition?.sectionId === sprint.id ? dropPosition.insertIndex : null
                }
              />
            ))}

            {/* Planning Sprints */}
            {planningSprints.map((sprint) => (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                tickets={ticketsBySprint[sprint.id] ?? []}
                projectKey={projectKey}
                projectId={projectId}
                statusColumns={columns}
                defaultExpanded={true}
                draggingTicketIds={draggingTicketIds}
                dropPosition={
                  dropPosition?.sectionId === sprint.id ? dropPosition.insertIndex : null
                }
              />
            ))}
          </div>
        )}

        {/* Backlog table with filters and columns */}
        <div className="flex-1 overflow-hidden min-h-0">
          <BacklogTable
            tickets={ticketsBySprint.backlog ?? []}
            columns={columns}
            projectKey={projectKey}
            projectId={projectId}
            useExternalDnd={true}
            externalDraggingIds={draggingTicketIds}
            dropPosition={dropPosition?.sectionId === 'backlog' ? dropPosition.insertIndex : null}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTicket && (
            <div className="w-full max-w-4xl">
              {draggingTicketIds.length > 1 ? (
                <div className="relative">
                  <TicketTableRow
                    ticket={activeTicket}
                    context={{
                      sectionId: activeTicket.sprintId ?? 'backlog',
                      sprintId: activeTicket.sprintId,
                      projectKey,
                      projectId,
                      statusColumns: columns,
                    }}
                    columns={backlogColumns.filter((c) => c.visible)}
                    allTicketIds={[]}
                    isOverlay
                  />
                  <div className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg">
                    {draggingTicketIds.length}
                  </div>
                </div>
              ) : (
                <TicketTableRow
                  ticket={activeTicket}
                  context={{
                    sectionId: activeTicket.sprintId ?? 'backlog',
                    sprintId: activeTicket.sprintId,
                    projectKey,
                    projectId,
                    statusColumns: columns,
                  }}
                  columns={backlogColumns.filter((c) => c.visible)}
                  allTicketIds={[]}
                  isOverlay
                />
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Column config sheet */}
      <ColumnConfig />

      {/* Ticket detail drawer */}
      <TicketDetailDrawer
        ticket={selectedTicket}
        projectKey={projectKey}
        onClose={() => setActiveTicketId(null)}
      />
    </div>
  )
}
