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
import { List, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ColumnConfig } from '@/components/backlog'
import { SprintSection } from '@/components/sprints'
import { SprintTicketRow } from '@/components/sprints/sprint-ticket-row'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useProjectSprints, useUpdateTicketSprint } from '@/hooks/queries/use-sprints'
import { useColumnsByProject, useTicketsByProject } from '@/hooks/queries/use-tickets'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'

export default function BacklogPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { getProject, isLoading: projectsLoading } = useProjectsStore()
  const project = getProject(projectId)
  const projectKey = project?.key || 'PROJ'

  const { getColumns, updateTicket, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection, selectedTicketIds } = useSelectionStore()

  // API mutations
  const updateTicketSprintMutation = useUpdateTicketSprint(projectId)

  // Drag state
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  const [dropTargetSprintId, setDropTargetSprintId] = useState<string | null | undefined>(undefined)

  // Refs for drag operation
  const draggedIdsRef = useRef<string[]>([])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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

  // Fetch all sprints
  const { data: sprints } = useProjectSprints(projectId)

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
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

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
        // Sprint doesn't exist, move to backlog
        groups.backlog.push(ticket)
      }
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

  // Drag handlers
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

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setDropTargetSprintId(undefined)
      return
    }

    // Check if over a sprint section
    if (over.data.current?.type === 'sprint-section') {
      const sprintId = over.data.current.sprintId as string | null
      setDropTargetSprintId(sprintId)
    } else if (over.data.current?.type === 'ticket') {
      // Over a ticket - get the sprint of that ticket
      const ticket = over.data.current.ticket as TicketWithRelations
      setDropTargetSprintId(ticket.sprintId)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedIds = draggedIdsRef.current
      const { over } = event

      // Clean up state first
      setActiveTicket(null)
      setDraggingTicketIds([])
      setDropTargetSprintId(undefined)
      draggedIdsRef.current = []

      if (!over || draggedIds.length === 0) return

      // Determine target sprint
      let targetSprintId: string | null = null
      if (over.data.current?.type === 'sprint-section') {
        targetSprintId = over.data.current.sprintId as string | null
      } else if (over.data.current?.type === 'ticket') {
        const ticket = over.data.current.ticket as TicketWithRelations
        targetSprintId = ticket.sprintId
      }

      // Get the tickets being moved
      const ticketsToMove = allTickets.filter((t) => draggedIds.includes(t.id))
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
    [allTickets, sprints, projectId, updateTicket, updateTicketSprintMutation],
  )

  // Redirect to dashboard if project doesn't exist after loading
  useEffect(() => {
    if (!projectsLoading && !project) {
      router.replace('/')
    }
  }, [projectsLoading, project, router])

  // Show nothing while redirecting
  if (!projectsLoading && !project) {
    return null
  }

  // Wait for store hydration to prevent hydration mismatch
  // Server renders with empty store, client may have localStorage data
  if (!_hasHydrated) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-zinc-500">Loading backlog...</div>
      </div>
    )
  }

  // Show loading state
  if (columnsLoading || ticketsLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-zinc-500">
          {columnsLoading ? 'Loading columns...' : 'Loading tickets...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Page header */}
      <div className="flex-shrink-0 flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800">
            <List className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{projectKey} Backlog</h1>
            <p className="text-sm text-zinc-500">Drag tickets between sprints to plan your work</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => setCreateTicketOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>
      </div>

      {/* Scrollable content with sprint and backlog sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto min-h-0 p-4 lg:p-6 space-y-4">
          {/* Active Sprints */}
          {activeSprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              sprint={sprint}
              tickets={
                ticketsBySprint[sprint.id]?.filter((t) => !draggingTicketIds.includes(t.id)) ?? []
              }
              projectKey={projectKey}
              projectId={projectId}
              defaultExpanded={true}
            />
          ))}

          {/* Planning Sprints */}
          {planningSprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              sprint={sprint}
              tickets={
                ticketsBySprint[sprint.id]?.filter((t) => !draggingTicketIds.includes(t.id)) ?? []
              }
              projectKey={projectKey}
              projectId={projectId}
              defaultExpanded={true}
            />
          ))}

          {/* Backlog Section */}
          <SprintSection
            sprint={null}
            tickets={
              ticketsBySprint.backlog?.filter((t) => !draggingTicketIds.includes(t.id)) ?? []
            }
            projectKey={projectKey}
            projectId={projectId}
            defaultExpanded={true}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTicket && (
            <div className="w-full max-w-4xl">
              {draggingTicketIds.length > 1 ? (
                <div className="relative">
                  <SprintTicketRow ticket={activeTicket} projectKey={projectKey} isOverlay />
                  <div className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg">
                    {draggingTicketIds.length}
                  </div>
                </div>
              ) : (
                <SprintTicketRow ticket={activeTicket} projectKey={projectKey} isOverlay />
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
