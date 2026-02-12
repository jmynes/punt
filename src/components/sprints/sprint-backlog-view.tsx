'use client'

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Plus, Target } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  useDeleteSprint,
  useProjectSprints,
  useUpdateTicketSprint,
} from '@/hooks/queries/use-sprints'
import { updateTicketAPI } from '@/hooks/queries/use-tickets'
import { filterTickets } from '@/lib/filter-tickets'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn } from '@/lib/utils'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'
import { TicketTableRow } from '../table'
import { SprintSection } from './sprint-section'

interface SprintBacklogViewProps {
  projectId: string
  projectKey: string
  tickets: TicketWithRelations[]
  className?: string
  showHeader?: boolean
}

/**
 * Jira-style sprint planning backlog view.
 * Shows sprints as collapsible sections with drag-and-drop between them.
 */
export function SprintBacklogView({
  projectId,
  projectKey,
  tickets,
  className,
  showHeader = true,
}: SprintBacklogViewProps) {
  const { data: sprints, isLoading: sprintsLoading } = useProjectSprints(projectId)
  const updateTicketSprintMutation = useUpdateTicketSprint(projectId)
  const deleteSprint = useDeleteSprint(projectId)
  const { setSprintCreateOpen, openCreateTicketWithData } = useUIStore()
  const { updateTicket, getColumns } = useBoardStore()
  const statusColumns = getColumns(projectId)
  const { selectedTicketIds } = useSelectionStore()
  const {
    columns: backlogColumns,
    filterByType,
    filterByPriority,
    filterByStatus,
    filterByResolution,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
    searchQuery,
    showSubtasks,
  } = useBacklogStore()
  const visibleColumns = backlogColumns.filter((c) => c.visible)

  // Apply filters from the shared backlog store
  const filteredTickets = useMemo(() => {
    return filterTickets(tickets, {
      searchQuery,
      projectKey,
      filterByType,
      filterByPriority,
      filterByStatus,
      filterByResolution,
      filterByAssignee,
      filterByLabels,
      filterBySprint,
      filterByPoints,
      filterByDueDate,
      showSubtasks,
    })
  }, [
    tickets,
    searchQuery,
    projectKey,
    filterByType,
    filterByPriority,
    filterByStatus,
    filterByResolution,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
    showSubtasks,
  ])

  // Drag state
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  // Drop position tracks where the drop indicator should appear
  const [dropPosition, setDropPosition] = useState<{
    sectionId: string // sprint id or 'backlog'
    insertIndex: number // index where items will be inserted
  } | null>(null)

  // Refs for drag operation
  const draggedIdsRef = useRef<string[]>([])

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activating
      },
    }),
  )

  // Group tickets by sprint (uses filtered tickets so filters apply across all sections)
  const ticketsBySprint = useMemo(() => {
    const groups: Record<string, TicketWithRelations[]> = {
      backlog: [],
    }

    // Initialize groups for each sprint
    sprints?.forEach((sprint) => {
      groups[sprint.id] = []
    })

    // Sort filtered tickets into groups
    filteredTickets.forEach((ticket) => {
      const sprintId = ticket.sprintId ?? 'backlog'
      if (groups[sprintId]) {
        groups[sprintId].push(ticket)
      } else {
        // Sprint doesn't exist anymore, move to backlog
        groups.backlog.push(ticket)
      }
    })

    // Sort tickets within each group by order
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.order - b.order)
    })

    return groups
  }, [filteredTickets, sprints])

  // Calculate total (unfiltered) counts by sprint for filtered vs total display
  const totalsBySprint = useMemo(() => {
    const totals: Record<string, { count: number; points: number }> = {
      backlog: { count: 0, points: 0 },
    }

    // Initialize totals for each sprint
    sprints?.forEach((sprint) => {
      totals[sprint.id] = { count: 0, points: 0 }
    })

    // Count all tickets (unfiltered)
    tickets.forEach((ticket) => {
      const sprintId = ticket.sprintId ?? 'backlog'
      if (totals[sprintId]) {
        totals[sprintId].count++
        totals[sprintId].points += ticket.storyPoints ?? 0
      } else {
        totals.backlog.count++
        totals.backlog.points += ticket.storyPoints ?? 0
      }
    })

    return totals
  }, [tickets, sprints])

  // Separate sprints by status
  const activeSprints = useMemo(
    () => sprints?.filter((s) => s.status === 'active') ?? [],
    [sprints],
  )
  const planningSprints = useMemo(
    () => sprints?.filter((s) => s.status === 'planning') ?? [],
    [sprints],
  )
  const completedSprints = useMemo(
    () => sprints?.filter((s) => s.status === 'completed') ?? [],
    [sprints],
  )

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      if (active.data.current?.type !== 'ticket') return

      const ticket = active.data.current.ticket as TicketWithRelations
      setActiveTicket(ticket)

      // Determine which tickets are being dragged
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

  // Handle drag over (for visual feedback)
  // Tickets stay visible during drag, so we use their actual index
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event
      if (!over) {
        setDropPosition(null)
        return
      }

      const overId = over.id as string
      const overData = over.data.current
      const draggedIds = draggedIdsRef.current

      // Check if hovering over a sprint section (droppable container)
      const isOverSection = overData?.type === 'sprint-section'

      let targetSectionId: string | undefined
      let forceInsertAtEnd = false

      if (isOverSection) {
        // Hovering over an empty section or section container
        targetSectionId = (overData.sprintId as string | null) ?? 'backlog'
        forceInsertAtEnd = true
      } else {
        // Must be hovering over a ticket - find which section contains it
        for (const [sectionId, sectionTickets] of Object.entries(ticketsBySprint)) {
          const foundTicket = sectionTickets.find((t) => t.id === overId)
          if (foundTicket) {
            targetSectionId = sectionId
            break
          }
        }
      }

      if (!targetSectionId) {
        setDropPosition(null)
        return
      }

      const sectionTickets = ticketsBySprint[targetSectionId] ?? []

      let insertIndex: number
      if (forceInsertAtEnd) {
        // Insert at end of section
        insertIndex = sectionTickets.length
      } else {
        // Find the index of the ticket we're hovering over
        // This is where the drop indicator will appear (before this ticket)
        const overTicketIndex = sectionTickets.findIndex((t) => t.id === overId)

        // If hovering over a dragged ticket, don't show indicator there
        if (draggedIds.includes(overId)) {
          setDropPosition(null)
          return
        }

        insertIndex = overTicketIndex >= 0 ? overTicketIndex : sectionTickets.length
      }

      setDropPosition({
        sectionId: targetSectionId,
        insertIndex,
      })
    },
    [ticketsBySprint],
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedIds = draggedIdsRef.current
      const { active, over } = event

      // Clean up state first
      setActiveTicket(null)
      setDraggingTicketIds([])
      setDropPosition(null)
      draggedIdsRef.current = []

      if (!over || draggedIds.length === 0) return

      const activeId = active.id as string
      const overId = over.id as string
      const overData = over.data.current

      // Determine target sprint
      let targetSprintId: string | null = null

      if (overData?.type === 'sprint-section') {
        targetSprintId = overData.sprintId ?? null
      } else if (overData?.type === 'ticket') {
        const overTicket = overData.ticket as TicketWithRelations
        targetSprintId = overTicket.sprintId
      }

      // Get the tickets being moved
      const ticketsToMove = tickets.filter((t) => draggedIds.includes(t.id))
      if (ticketsToMove.length === 0) return

      // Check if any ticket actually changes sprint
      const ticketsChangingSprint = ticketsToMove.filter((t) => t.sprintId !== targetSprintId)

      // Case 1: Internal reordering within the same section
      if (ticketsChangingSprint.length === 0 && overData?.type === 'ticket') {
        const sourceSprintId = ticketsToMove[0]?.sprintId ?? null
        const sectionKey = sourceSprintId ?? 'backlog'
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

          // Persist order changes to API (triggers SSE for other clients)
          if (ticketsToUpdate.length > 0) {
            ;(async () => {
              try {
                for (const { id, order } of ticketsToUpdate) {
                  await updateTicketAPI(projectId, id, { order })
                }
              } catch (err) {
                console.error('Failed to persist sprint reorder:', err)
              }
            })()
          }
        }
        return
      }

      // Case 2: Cross-section move
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

      // Get sprint names for toast
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

      // Optimistically update the board store (sprintId and order)
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
    [tickets, sprints, projectId, updateTicket, updateTicketSprintMutation, ticketsBySprint],
  )

  // Handle create ticket with sprint prefill
  const handleCreateTicket = useCallback(
    (sprintId: string | null) => {
      openCreateTicketWithData({ sprintId })
    },
    [openCreateTicketWithData],
  )

  // Handle delete sprint
  const handleDeleteSprint = useCallback(
    (sprintId: string) => {
      if (
        window.confirm(
          'Are you sure you want to delete this sprint? Tickets will be moved to the backlog.',
        )
      ) {
        deleteSprint.mutate(sprintId)
      }
    },
    [deleteSprint],
  )

  if (sprintsLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-zinc-900/50 animate-pulse border border-zinc-800"
          />
        ))}
      </div>
    )
  }

  const hasSprints = sprints && sprints.length > 0

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={cn('space-y-3', className)}>
        {/* Header */}
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Sprint Planning</h2>
                <p className="text-sm text-zinc-500">
                  Drag tickets between sprints to plan your work
                </p>
              </div>
            </div>
            {activeSprints.length === 0 && (
              <Button
                onClick={() => setSprintCreateOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Sprint
              </Button>
            )}
          </div>
        )}

        {/* Active Sprints */}
        {activeSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            tickets={ticketsBySprint[sprint.id] ?? []}
            projectKey={projectKey}
            projectId={projectId}
            statusColumns={statusColumns}
            defaultExpanded={true}
            onCreateTicket={handleCreateTicket}
            dropPosition={dropPosition?.sectionId === sprint.id ? dropPosition.insertIndex : null}
            draggingTicketIds={draggingTicketIds}
            totalTicketCount={totalsBySprint[sprint.id]?.count}
            totalStoryPoints={totalsBySprint[sprint.id]?.points}
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
            statusColumns={statusColumns}
            defaultExpanded={true}
            onCreateTicket={handleCreateTicket}
            onDelete={handleDeleteSprint}
            dropPosition={dropPosition?.sectionId === sprint.id ? dropPosition.insertIndex : null}
            draggingTicketIds={draggingTicketIds}
            totalTicketCount={totalsBySprint[sprint.id]?.count}
            totalStoryPoints={totalsBySprint[sprint.id]?.points}
          />
        ))}

        {/* Backlog */}
        <SprintSection
          sprint={null}
          tickets={ticketsBySprint.backlog}
          projectKey={projectKey}
          projectId={projectId}
          statusColumns={statusColumns}
          defaultExpanded={!hasSprints || ticketsBySprint.backlog.length > 0}
          onCreateTicket={handleCreateTicket}
          dropPosition={dropPosition?.sectionId === 'backlog' ? dropPosition.insertIndex : null}
          draggingTicketIds={draggingTicketIds}
          hasActiveSprint={activeSprints.length > 0}
          totalTicketCount={totalsBySprint.backlog?.count}
          totalStoryPoints={totalsBySprint.backlog?.points}
        />

        {/* Completed Sprints (collapsed by default) */}
        {completedSprints.length > 0 && (
          <div className="pt-4 border-t border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-2">
              Completed Sprints
              <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
                {completedSprints.length}
              </span>
            </h3>
            <div className="space-y-2">
              {completedSprints.slice(0, 3).map((sprint) => (
                <SprintSection
                  key={sprint.id}
                  sprint={sprint}
                  tickets={ticketsBySprint[sprint.id] ?? []}
                  projectKey={projectKey}
                  projectId={projectId}
                  statusColumns={statusColumns}
                  defaultExpanded={false}
                  dropPosition={
                    dropPosition?.sectionId === sprint.id ? dropPosition.insertIndex : null
                  }
                  draggingTicketIds={draggingTicketIds}
                  totalTicketCount={totalsBySprint[sprint.id]?.count}
                  totalStoryPoints={totalsBySprint[sprint.id]?.points}
                />
              ))}
              {completedSprints.length > 3 && (
                <p className="text-xs text-zinc-600 text-center py-2">
                  +{completedSprints.length - 3} more completed sprints
                </p>
              )}
            </div>
          </div>
        )}
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
                    statusColumns,
                  }}
                  columns={visibleColumns}
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
                  statusColumns,
                }}
                columns={visibleColumns}
                allTicketIds={[]}
                isOverlay
              />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
