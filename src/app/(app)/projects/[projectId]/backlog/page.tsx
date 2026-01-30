'use client'

import {
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
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { List, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BacklogTable, ColumnConfig } from '@/components/backlog'
import { SprintSection } from '@/components/sprints'
import { SprintTableRow } from '@/components/sprints/sprint-table-row'
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
 * Custom collision detection that handles both cross-section drops and internal reordering.
 * Priority: ticket/row items (for reordering) > sprint-sections (for cross-section moves)
 */
const customCollisionDetection: CollisionDetection = (args) => {
  // Get all collisions using rect intersection (most reliable for sortable items)
  const rectCollisions = rectIntersection(args)

  // Find ticket/row collisions for internal reordering
  const ticketCollision = rectCollisions.find((collision) => {
    const type = collision.data?.droppableContainer?.data?.current?.type
    return type === 'ticket' || type === 'backlog-ticket'
  })

  if (ticketCollision) {
    return [ticketCollision]
  }

  // Find sprint-section collision for cross-section moves
  const sprintCollision = rectCollisions.find(
    (collision) => collision.data?.droppableContainer?.data?.current?.type === 'sprint-section',
  )

  if (sprintCollision) {
    return [sprintCollision]
  }

  // Fallback to all rect collisions
  return rectCollisions
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
  const { clearSelection, selectedTicketIds, isSelected } = useSelectionStore()
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
  const [backlogDropTargetId, setBacklogDropTargetId] = useState<string | null>(null)
  const [sprintDropPosition, setSprintDropPosition] = useState<{
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
        setBacklogDropTargetId(null)
        setSprintDropPosition(null)
        return
      }

      const overId = over.id as string
      const overType = over.data.current?.type
      const draggedIds = draggedIdsRef.current

      // Track drop target for backlog tickets
      if (overType === 'backlog-ticket') {
        setSprintDropPosition(null)
        if (draggedIds.includes(overId)) {
          setBacklogDropTargetId(null)
          return
        }
        setBacklogDropTargetId(overId)
        return
      }

      // Track drop position for sprint tickets
      if (overType === 'ticket') {
        setBacklogDropTargetId(null)
        if (draggedIds.includes(overId)) {
          setSprintDropPosition(null)
          return
        }

        // Find which sprint contains this ticket
        for (const [sectionId, sectionTickets] of Object.entries(ticketsBySprint)) {
          const ticketIndex = sectionTickets.findIndex((t) => t.id === overId)
          if (ticketIndex !== -1) {
            setSprintDropPosition({ sectionId, insertIndex: ticketIndex })
            return
          }
        }
      }

      // Hovering over sprint section (empty area)
      if (overType === 'sprint-section') {
        setBacklogDropTargetId(null)
        const sectionId = (over.data.current?.sprintId as string | null) ?? 'backlog'
        const sectionTickets = ticketsBySprint[sectionId] ?? []
        setSprintDropPosition({ sectionId, insertIndex: sectionTickets.length })
        return
      }

      setBacklogDropTargetId(null)
      setSprintDropPosition(null)
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
      setBacklogDropTargetId(null)
      setSprintDropPosition(null)
      draggedIdsRef.current = []

      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string
      // Use captured drag data from ref (active.data.current may be empty if sortable was filtered out)
      const activeType = activeDragDataRef.current.type || active.data.current?.type
      // Normalize null/undefined sprint IDs to null for comparison
      const activeSprintId =
        activeDragDataRef.current.sprintId ?? active.data.current?.sprintId ?? null
      const overType = over.data.current?.type
      const overSprintId = over.data.current?.sprintId ?? null

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

      // Case 2: Row reordering within backlog (backlog-ticket to backlog-ticket)
      // Manual reordering clears the active sort via hasManualOrder in BacklogTable
      if (
        activeType === 'backlog-ticket' &&
        overType === 'backlog-ticket' &&
        activeSprintId === overSprintId
      ) {
        const rawBacklogTickets = ticketsBySprint.backlog ?? []
        const selectedIds = Array.from(selectedTicketIds)

        // Apply existing backlog order to maintain current view order
        const existingOrder = backlogOrder[projectId] || []
        const orderSet = new Set(existingOrder)
        const orderedTickets = existingOrder
          .map((id) => rawBacklogTickets.find((t) => t.id === id))
          .filter(Boolean) as typeof rawBacklogTickets
        const remainingTickets = rawBacklogTickets.filter((t) => !orderSet.has(t.id))
        const backlogTickets = [...orderedTickets, ...remainingTickets]

        let newOrderedTickets: typeof backlogTickets = []

        // Multi-drag reordering
        if (selectedIds.length > 1 && isSelected(activeId)) {
          const selectedSet = new Set(selectedIds)
          const remaining = backlogTickets.filter((t) => !selectedSet.has(t.id))
          const selectedInOrder = backlogTickets.filter((t) => selectedSet.has(t.id))

          let insertIndex = remaining.findIndex((t) => t.id === overId)
          if (insertIndex === -1) insertIndex = remaining.length
          if (selectedSet.has(overId)) insertIndex = remaining.length

          newOrderedTickets = [
            ...remaining.slice(0, insertIndex),
            ...selectedInOrder,
            ...remaining.slice(insertIndex),
          ]

          setBacklogOrder(
            projectId,
            newOrderedTickets.map((t) => t.id),
          )
          clearSelection()
        } else {
          // Single drag reordering
          const oldIndex = backlogTickets.findIndex((t) => t.id === activeId)
          const newIndex = backlogTickets.findIndex((t) => t.id === overId)

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            newOrderedTickets = arrayMove(backlogTickets, oldIndex, newIndex)
            setBacklogOrder(
              projectId,
              newOrderedTickets.map((t) => t.id),
            )
          }
        }

        // Persist order changes to API (triggers SSE for other clients)
        if (newOrderedTickets.length > 0) {
          const ticketsToUpdate: { id: string; order: number }[] = []
          newOrderedTickets.forEach((ticket, index) => {
            if (ticket.order !== index) {
              updateTicket(projectId, ticket.id, { order: index })
              ticketsToUpdate.push({ id: ticket.id, order: index })
            }
          })

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
        }
        return
      }

      // Case 2b: Row reordering within sprint (ticket to ticket, same sprint)
      if (activeType === 'ticket' && overType === 'ticket' && activeSprintId === overSprintId) {
        const sectionKey = activeSprintId ?? 'backlog'
        const sectionTickets = ticketsBySprint[sectionKey] ?? []

        // Skip if dropped on self
        if (activeId === overId) return

        // Find indices
        const oldIndex = sectionTickets.findIndex((t) => t.id === activeId)
        const newIndex = sectionTickets.findIndex((t) => t.id === overId)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Calculate new order values
          const reordered = [...sectionTickets]
          const [moved] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, moved)

          // Update order for each ticket based on new position
          const ticketsToUpdate: { id: string; order: number }[] = []
          reordered.forEach((ticket, index) => {
            if (ticket.order !== index) {
              updateTicket(projectId, ticket.id, { order: index })
              ticketsToUpdate.push({ id: ticket.id, order: index })
            }
          })

          // Persist to API (triggers SSE for other clients)
          ;(async () => {
            try {
              for (const { id, order } of ticketsToUpdate) {
                await updateTicketAPI(projectId, id, { order })
              }
            } catch (err) {
              console.error('Failed to persist ticket reorder:', err)
            }
          })()
        }
        return
      }

      // Case 3: Cross-section sprint assignment (ticket to sprint-section, or ticket to different sprint's ticket)
      if (draggedIds.length === 0) return

      let targetSprintId: string | null = null

      if (overType === 'sprint-section') {
        targetSprintId = over.data.current?.sprintId as string | null
      } else if (overType === 'ticket') {
        const ticket = over.data.current?.ticket as TicketWithRelations
        targetSprintId = ticket.sprintId
      } else if (overType === 'backlog-ticket') {
        // Dropped on a backlog ticket from a different section - move to backlog
        targetSprintId = null
      } else {
        return
      }

      const ticketsToMove = allTickets.filter((t) => draggedIds.includes(t.id))
      if (ticketsToMove.length === 0) return

      const ticketsChangingSprint = ticketsToMove.filter((t) => t.sprintId !== targetSprintId)
      if (ticketsChangingSprint.length === 0) return

      // Calculate starting order for tickets in target section
      const targetSectionKey = targetSprintId ?? 'backlog'
      const targetSectionTickets = ticketsBySprint[targetSectionKey] ?? []
      const maxOrderInTarget =
        targetSectionTickets.length > 0 ? Math.max(...targetSectionTickets.map((t) => t.order)) : -1
      const startingOrder = maxOrderInTarget + 1

      // Capture original sprint IDs and orders for undo
      const originalSprintIds = ticketsChangingSprint.map((t, index) => ({
        ticketId: t.id,
        sprintId: t.sprintId,
        order: t.order,
        newOrder: startingOrder + index,
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

      // Optimistic update (sprintId and order)
      for (const item of originalSprintIds) {
        updateTicket(projectId, item.ticketId, { sprintId: targetSprintId, order: item.newOrder })
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
          // Revert to original sprint IDs and orders
          for (const { ticketId, sprintId, order } of originalSprintIds) {
            updateTicket(projectId, ticketId, { sprintId, order })
          }
          // Persist undo to database
          Promise.all(
            originalSprintIds.map(({ ticketId, sprintId, order }) =>
              updateTicketSprintMutation.mutateAsync({ ticketId, sprintId, order }),
            ),
          ).catch(() => {
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
          // Persist redo to database
          Promise.all(
            originalSprintIds.map(({ ticketId, newOrder }) =>
              updateTicketSprintMutation.mutateAsync({
                ticketId,
                sprintId: targetSprintId,
                order: newOrder,
              }),
            ),
          ).catch(() => {
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

      // Persist to database
      Promise.all(
        originalSprintIds.map(({ ticketId, newOrder }) =>
          updateTicketSprintMutation.mutateAsync({
            ticketId,
            sprintId: targetSprintId,
            order: newOrder,
          }),
        ),
      ).catch((error) => {
        // Revert on error
        for (const { ticketId, sprintId, order } of originalSprintIds) {
          updateTicket(projectId, ticketId, { sprintId, order })
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
      selectedTicketIds,
      isSelected,
      setBacklogOrder,
      clearSelection,
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
        collisionDetection={customCollisionDetection}
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
                  sprintDropPosition?.sectionId === sprint.id
                    ? sprintDropPosition.insertIndex
                    : null
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
                  sprintDropPosition?.sectionId === sprint.id
                    ? sprintDropPosition.insertIndex
                    : null
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
            externalDropTargetId={backlogDropTargetId}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTicket && (
            <div className="w-full max-w-4xl">
              {draggingTicketIds.length > 1 ? (
                <div className="relative">
                  <SprintTableRow
                    ticket={activeTicket}
                    projectKey={projectKey}
                    statusColumns={columns}
                    columns={backlogColumns.filter((c) => c.visible)}
                    allTicketIds={[]}
                    isOverlay
                  />
                  <div className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg">
                    {draggingTicketIds.length}
                  </div>
                </div>
              ) : (
                <SprintTableRow
                  ticket={activeTicket}
                  projectKey={projectKey}
                  statusColumns={columns}
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
