'use client'

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { List, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BacklogTable, ColumnConfig } from '@/components/backlog'
import { SprintSection } from '@/components/sprints'
import { SprintTicketRow } from '@/components/sprints/sprint-ticket-row'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useProjectSprints, useUpdateTicketSprint } from '@/hooks/queries/use-sprints'
import { useColumnsByProject, useTicketsByProject } from '@/hooks/queries/use-tickets'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { useBacklogStore } from '@/stores/backlog-store'
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
  const { clearSelection, selectedTicketIds, isSelected } = useSelectionStore()
  const { columns: backlogColumns, setBacklogOrder, reorderColumns, sort: backlogSort } =
    useBacklogStore()

  // API mutations
  const updateTicketSprintMutation = useUpdateTicketSprint(projectId)

  // Drag state for sprint sections
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  const draggedIdsRef = useRef<string[]>([])

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

  // Drag handlers - unified for sprint sections and backlog table
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const dataType = active.data.current?.type

      // Handle both 'ticket' (from sprint) and 'backlog-ticket' (from backlog table)
      if (dataType !== 'ticket' && dataType !== 'backlog-ticket') return

      const ticket = active.data.current?.ticket as TicketWithRelations
      setActiveTicket(ticket)

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

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback handled by SprintSection's isOver state
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedIds = draggedIdsRef.current
      const { active, over } = event

      setActiveTicket(null)
      setDraggingTicketIds([])
      draggedIdsRef.current = []

      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string
      const activeType = active.data.current?.type
      const overType = over.data.current?.type

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

      // Case 2: Row reordering within backlog (backlog-ticket to backlog-ticket, same sprint)
      // Only allow reordering when there's no active sort
      if (
        activeType === 'backlog-ticket' &&
        overType === 'backlog-ticket' &&
        active.data.current?.sprintId === over.data.current?.sprintId &&
        !backlogSort
      ) {
        const backlogTickets = ticketsBySprint.backlog ?? []
        const selectedIds = Array.from(selectedTicketIds)

        // Multi-drag reordering
        if (selectedIds.length > 1 && isSelected(activeId)) {
          const selectedSet = new Set(selectedIds)
          const remaining = backlogTickets.filter((t) => !selectedSet.has(t.id))
          const selectedInOrder = backlogTickets.filter((t) => selectedSet.has(t.id))

          let insertIndex = remaining.findIndex((t) => t.id === overId)
          if (insertIndex === -1) insertIndex = remaining.length
          if (selectedSet.has(overId)) insertIndex = remaining.length

          const newOrder = [
            ...remaining.slice(0, insertIndex),
            ...selectedInOrder,
            ...remaining.slice(insertIndex),
          ]

          setBacklogOrder(projectId, newOrder.map((t) => t.id))
          clearSelection()
        } else {
          // Single drag reordering
          const oldIndex = backlogTickets.findIndex((t) => t.id === activeId)
          const newIndex = backlogTickets.findIndex((t) => t.id === overId)

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newOrder = arrayMove(backlogTickets, oldIndex, newIndex)
            setBacklogOrder(projectId, newOrder.map((t) => t.id))
          }
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

      const fromSprints = new Set(ticketsChangingSprint.map((t) => t.sprintId ?? 'backlog'))
      const targetSprintName =
        targetSprintId === null
          ? 'Backlog'
          : (sprints?.find((s) => s.id === targetSprintId)?.name ?? 'Sprint')

      // Optimistic update
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
            { description: `From ${fromLabel}` },
          )
        })
        .catch((error) => {
          toast.error('Failed to move tickets', { description: error.message })
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
      ticketsBySprint.backlog,
      selectedTicketIds,
      isSelected,
      setBacklogOrder,
      clearSelection,
      backlogSort,
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
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-zinc-500">Loading backlog...</div>
      </div>
    )
  }

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

  const hasActiveSprints = activeSprints.length > 0 || planningSprints.length > 0

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
            <p className="text-sm text-zinc-500">
              View and manage all tickets in a configurable list
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => setCreateTicketOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>
      </div>

      {/* Unified DnD context wrapping sprint sections AND backlog table */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
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
          </div>
        )}

        {/* Backlog table with filters and columns */}
        <BacklogDropZone isOver={false}>
          <div className="flex-1 overflow-hidden min-h-0">
            <BacklogTable
              tickets={ticketsBySprint.backlog?.filter((t) => !draggingTicketIds.includes(t.id)) ?? []}
              columns={columns}
              projectKey={projectKey}
              projectId={projectId}
              useExternalDnd={hasActiveSprints}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        </BacklogDropZone>

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

/** Drop zone wrapper for the backlog section - enables dropping from sprint to backlog */
function BacklogDropZone({
  children,
  isOver: _isOverProp,
}: {
  children: React.ReactNode
  isOver?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'backlog',
    data: {
      type: 'sprint-section',
      sprintId: null, // null = backlog
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col overflow-hidden min-h-0 transition-colors ${
        isOver ? 'bg-blue-500/5 ring-2 ring-blue-500/20 ring-inset' : ''
      }`}
    >
      {children}
    </div>
  )
}
