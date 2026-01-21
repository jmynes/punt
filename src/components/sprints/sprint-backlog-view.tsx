'use client'

import {
  closestCenter,
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
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useDeleteSprint,
  useProjectSprints,
  useUpdateTicketSprint,
} from '@/hooks/queries/use-sprints'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { SprintSection } from './sprint-section'
import { SprintTicketRow } from './sprint-ticket-row'

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
  const updateTicketSprint = useUpdateTicketSprint(projectId)
  const deleteSprint = useDeleteSprint(projectId)
  const { setSprintCreateOpen, openCreateTicketWithData } = useUIStore()
  const { updateTicket } = useBoardStore()

  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [_overId, setOverId] = useState<string | null>(null)

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
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const ticket = active.data.current?.ticket as TicketWithRelations | undefined
    if (ticket) {
      setActiveTicket(ticket)
    }
  }, [])

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
    async (event: DragEndEvent) => {
      const { active, over } = event

      setActiveTicket(null)
      setOverId(null)

      if (!over) return

      const activeTicketData = active.data.current?.ticket as TicketWithRelations | undefined
      if (!activeTicketData) return

      // Determine target sprint
      let targetSprintId: string | null = null
      const overData = over.data.current

      if (overData?.type === 'sprint-section') {
        targetSprintId = overData.sprintId ?? null
      } else if (overData?.type === 'ticket') {
        const overTicket = overData.ticket as TicketWithRelations
        targetSprintId = overTicket.sprintId
      }

      // Check if sprint changed
      const currentSprintId = activeTicketData.sprintId
      if (targetSprintId === currentSprintId) {
        // Same sprint - might be reordering within sprint
        // For now, we don't support reordering within sprint section
        return
      }

      // Optimistically update the ticket
      updateTicket(projectId, activeTicketData.id, { sprintId: targetSprintId })

      // Show toast
      const targetSprintName =
        targetSprintId === null
          ? 'Backlog'
          : (sprints?.find((s) => s.id === targetSprintId)?.name ?? 'Sprint')

      toast.success(`Moved to ${targetSprintName}`, {
        description: `${projectKey}-${activeTicketData.number}: ${activeTicketData.title}`,
      })

      // Persist to API
      try {
        await updateTicketSprint.mutateAsync({
          ticketId: activeTicketData.id,
          sprintId: targetSprintId,
        })
      } catch (_error) {
        // Revert on failure
        updateTicket(projectId, activeTicketData.id, { sprintId: currentSprintId })
        toast.error('Failed to move ticket', {
          description: 'Please try again.',
        })
      }
    },
    [projectId, projectKey, sprints, updateTicket, updateTicketSprint],
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
      collisionDetection={closestCenter}
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
            tickets={ticketsBySprint[sprint.id] ?? []}
            projectKey={projectKey}
            projectId={projectId}
            defaultExpanded={true}
            onCreateTicket={handleCreateTicket}
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
            defaultExpanded={true}
            onCreateTicket={handleCreateTicket}
            onDelete={handleDeleteSprint}
          />
        ))}

        {/* Backlog */}
        <SprintSection
          sprint={null}
          tickets={ticketsBySprint.backlog}
          projectKey={projectKey}
          projectId={projectId}
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
                  tickets={ticketsBySprint[sprint.id] ?? []}
                  projectKey={projectKey}
                  projectId={projectId}
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
      <DragOverlay>
        {activeTicket ? (
          <SprintTicketRow ticket={activeTicket} projectKey={projectKey} isOverlay={true} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
