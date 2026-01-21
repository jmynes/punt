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
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useDeleteSprint,
  useProjectSprints,
  useUpdateTicketSprint,
} from '@/hooks/queries/use-sprints'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { SprintSection } from './sprint-section'
import { SprintTableRow } from './sprint-table-row'

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

  // Drag state
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  const [_overId, setOverId] = useState<string | null>(null)

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

  // Group tickets by sprint
  const ticketsBySprint = useMemo(() => {
    const groups: Record<string, TicketWithRelations[]> = {
      backlog: [],
    }

    // Initialize groups for each sprint
    sprints?.forEach((sprint) => {
      groups[sprint.id] = []
    })

    // Sort tickets into groups
    tickets.forEach((ticket) => {
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
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (over) {
      // Check if we're over a sprint section or a ticket
      const overData = over.data.current
      if (overData?.type === 'sprint-section') {
        setOverId(over.id as string)
      } else if (overData?.type === 'ticket') {
        // Get the sprint of the ticket we're over
        const overTicket = overData.ticket as TicketWithRelations
        setOverId(overTicket.sprintId ?? 'backlog')
      } else {
        setOverId(null)
      }
    } else {
      setOverId(null)
    }
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedIds = draggedIdsRef.current
      const { over } = event

      // Clean up state first
      setActiveTicket(null)
      setDraggingTicketIds([])
      setOverId(null)
      draggedIdsRef.current = []

      if (!over || draggedIds.length === 0) return

      // Determine target sprint
      let targetSprintId: string | null = null
      const overData = over.data.current

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
      if (ticketsChangingSprint.length === 0) return

      // Get sprint names for toast
      const fromSprints = new Set(ticketsChangingSprint.map((t) => t.sprintId ?? 'backlog'))
      const targetSprintName =
        targetSprintId === null
          ? 'Backlog'
          : (sprints?.find((s) => s.id === targetSprintId)?.name ?? 'Sprint')

      // Optimistically update the board store
      for (const ticket of ticketsChangingSprint) {
        updateTicket(projectId, ticket.id, { sprintId: targetSprintId })
      }

      // Persist to database
      const promises = ticketsChangingSprint.map((ticket) =>
        updateTicketSprintMutation.mutateAsync({
          ticketId: ticket.id,
          sprintId: targetSprintId,
        }),
      )

      Promise.all(promises)
        .then(() => {
          const count = ticketsChangingSprint.length
          const fromLabel =
            fromSprints.size === 1
              ? fromSprints.has('backlog')
                ? 'Backlog'
                : (sprints?.find((s) => s.id === Array.from(fromSprints)[0])?.name ?? 'Sprint')
              : 'multiple sprints'

          toast.success(
            count === 1
              ? `Ticket moved to ${targetSprintName}`
              : `${count} tickets moved to ${targetSprintName}`,
            {
              description: `From ${fromLabel}`,
            },
          )
        })
        .catch((error) => {
          // Revert on error - refetch will handle this
          toast.error('Failed to move tickets', { description: error.message })
        })
    },
    [tickets, sprints, projectId, updateTicket, updateTicketSprintMutation],
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

  // Filter out dragging tickets from display
  const filterDragging = (ticketList: TicketWithRelations[]) =>
    ticketList.filter((t) => !draggingTicketIds.includes(t.id))

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
            <Button
              onClick={() => setSprintCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Sprint
            </Button>
          </div>
        )}

        {/* Active Sprints */}
        {activeSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            tickets={filterDragging(ticketsBySprint[sprint.id] ?? [])}
            projectKey={projectKey}
            projectId={projectId}
            statusColumns={statusColumns}
            defaultExpanded={true}
            onCreateTicket={handleCreateTicket}
          />
        ))}

        {/* Planning Sprints */}
        {planningSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            tickets={filterDragging(ticketsBySprint[sprint.id] ?? [])}
            projectKey={projectKey}
            projectId={projectId}
            statusColumns={statusColumns}
            defaultExpanded={true}
            onCreateTicket={handleCreateTicket}
            onDelete={handleDeleteSprint}
          />
        ))}

        {/* Backlog */}
        <SprintSection
          sprint={null}
          tickets={filterDragging(ticketsBySprint.backlog)}
          projectKey={projectKey}
          projectId={projectId}
          statusColumns={statusColumns}
          defaultExpanded={!hasSprints || ticketsBySprint.backlog.length > 0}
          onCreateTicket={handleCreateTicket}
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
                  tickets={filterDragging(ticketsBySprint[sprint.id] ?? [])}
                  projectKey={projectKey}
                  projectId={projectId}
                  statusColumns={statusColumns}
                  defaultExpanded={false}
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
                <SprintTableRow
                  ticket={activeTicket}
                  projectKey={projectKey}
                  statusColumns={statusColumns}
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
                statusColumns={statusColumns}
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
