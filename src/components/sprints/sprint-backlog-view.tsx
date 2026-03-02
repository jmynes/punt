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
import { Code2, Plus, Target } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QueryInput } from '@/components/backlog/query-input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useDeleteSprint,
  useProjectSprints,
  useUpdateTicketSprint,
} from '@/hooks/queries/use-sprints'
import { updateTicketAPI } from '@/hooks/queries/use-tickets'
import { filterTickets } from '@/lib/filter-tickets'
import { evaluateQuery } from '@/lib/query-evaluator'
import { parse, QueryParseError } from '@/lib/query-parser'
import { isCompletedColumn } from '@/lib/sprint-utils'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn } from '@/lib/utils'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useSprintStore } from '@/stores/sprint-store'
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
    filterByAttachments,
    searchQuery,
    showSubtasks,
    queryMode,
    setQueryMode,
    queryText,
    setQueryText,
  } = useBacklogStore()
  const visibleColumns = backlogColumns.filter((c) => c.visible)
  const persistTableSort = useSettingsStore((s) => s.persistTableSort)
  const clearAllSprintSorts = useSprintStore((s) => s.clearAllSprintSorts)

  // Clear sprint sorts on mount when sort persistence is disabled
  const sortResetRef = useRef(false)
  useEffect(() => {
    if (!sortResetRef.current) {
      sortResetRef.current = true
      if (!persistTableSort) {
        clearAllSprintSorts()
      }
    }
  }, [persistTableSort, clearAllSprintSorts])

  // Debounce query text to prevent per-keystroke evaluation
  const [debouncedQueryText, setDebouncedQueryText] = useState(queryText)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQueryText(queryText), 150)
    return () => clearTimeout(timer)
  }, [queryText])

  // Extract dynamic values for query autocomplete
  const dynamicValues = useMemo(() => {
    const statusNames = statusColumns.map((c) => c.name)
    const userSet = new Set<string>()
    const labelSet = new Set<string>()

    for (const ticket of tickets) {
      if (ticket.assignee?.name) userSet.add(ticket.assignee.name)
      if (ticket.creator?.name) userSet.add(ticket.creator.name)
      for (const label of ticket.labels) {
        labelSet.add(label.name)
      }
    }

    const sprintNames = sprints?.map((s) => s.name).sort() ?? []

    return {
      statusNames,
      assigneeNames: Array.from(userSet).sort(),
      sprintNames,
      labelNames: Array.from(labelSet).sort(),
    }
  }, [tickets, statusColumns, sprints])

  // Query parse error for tooltip
  const [queryError, setQueryError] = useState<string | null>(null)

  // Apply filters from the shared backlog store (or PQL query)
  const filteredTickets = useMemo(() => {
    // PQL query mode
    if (queryMode && debouncedQueryText.trim()) {
      try {
        const ast = parse(debouncedQueryText)
        setQueryError(null)
        return evaluateQuery(ast, tickets, statusColumns, projectKey)
      } catch (err) {
        if (err instanceof QueryParseError) {
          setQueryError(err.message)
        } else {
          setQueryError('Invalid query')
        }
        return tickets
      }
    }

    // Standard filter mode
    setQueryError(null)
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
      filterByAttachments,
      showSubtasks,
    })
  }, [
    queryMode,
    debouncedQueryText,
    tickets,
    statusColumns,
    projectKey,
    searchQuery,
    filterByType,
    filterByPriority,
    filterByStatus,
    filterByResolution,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
    filterByAttachments,
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

  // Calculate unfiltered totals per sprint (for filtered/total display)
  const doneColumnIds = useMemo(
    () => statusColumns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id),
    [statusColumns],
  )

  const unfilteredTotals = useMemo(() => {
    const totals: Record<
      string,
      { count: number; points: number; completedCount: number; completedPoints: number }
    > = {
      backlog: { count: 0, points: 0, completedCount: 0, completedPoints: 0 },
    }

    // Initialize for each sprint
    sprints?.forEach((sprint) => {
      totals[sprint.id] = { count: 0, points: 0, completedCount: 0, completedPoints: 0 }
    })

    // Count all tickets (unfiltered)
    tickets.forEach((ticket) => {
      const sprintId = ticket.sprintId ?? 'backlog'
      const bucket = totals[sprintId] ?? totals.backlog
      const pts = ticket.storyPoints ?? 0
      const isDone = doneColumnIds.includes(ticket.columnId)

      bucket.count++
      bucket.points += pts
      if (isDone) {
        bucket.completedCount++
        bucket.completedPoints += pts
      }
    })

    return totals
  }, [tickets, sprints, doneColumnIds])

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

      // Check if hovering over a sprint section or end-of-list zone
      const isOverSection = overData?.type === 'sprint-section'
      const isOverSectionEnd = overData?.type === 'section-end'

      let targetSectionId: string | undefined
      let forceInsertAtEnd = false

      if (isOverSection || isOverSectionEnd) {
        // Hovering over an empty section, section container, or end-of-list zone
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

      // Capture drop position before clearing state
      const currentDropPosition = dropPosition

      // Clean up state
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

      if (overData?.type === 'sprint-section' || overData?.type === 'section-end') {
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
      if (
        ticketsChangingSprint.length === 0 &&
        (overData?.type === 'ticket' || overData?.type === 'section-end')
      ) {
        const sourceSprintId = ticketsToMove[0]?.sprintId ?? null
        const sectionKey = sourceSprintId ?? 'backlog'
        const sectionTickets = ticketsBySprint[sectionKey] ?? []

        // Skip if dropped on self
        if (activeId === overId) return

        // Find indices
        const oldIndex = sectionTickets.findIndex((t) => t.id === activeId)
        const newIndex =
          overData?.type === 'section-end'
            ? sectionTickets.length - 1
            : sectionTickets.findIndex((t) => t.id === overId)

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

      // Calculate new orders for tickets in target section
      const targetSectionKey = targetSprintId ?? 'backlog'
      const targetSectionTickets = ticketsBySprint[targetSectionKey] ?? []

      // Determine insertion index from drop position
      // If we have a valid drop position for this section, use it; otherwise append at end
      const insertIndex =
        currentDropPosition?.sectionId === targetSectionKey
          ? currentDropPosition.insertIndex
          : targetSectionTickets.length

      // Build the new order by inserting moved tickets at the correct position
      // and reordering existing tickets around them
      const existingTicketIds = new Set(ticketsChangingSprint.map((t) => t.id))
      const existingTargetTickets = targetSectionTickets.filter((t) => !existingTicketIds.has(t.id))

      // Create the new ordered list with inserted tickets
      const newOrderedTickets = [
        ...existingTargetTickets.slice(0, insertIndex),
        ...ticketsChangingSprint,
        ...existingTargetTickets.slice(insertIndex),
      ]

      // Calculate new orders for all affected tickets
      const allOrderUpdates: { ticketId: string; newOrder: number }[] = []
      newOrderedTickets.forEach((ticket, index) => {
        if (ticket.order !== index) {
          allOrderUpdates.push({ ticketId: ticket.id, newOrder: index })
        }
      })

      // Capture original sprint IDs and orders for undo
      const originalSprintIds = ticketsChangingSprint.map((t) => {
        const newOrder =
          allOrderUpdates.find((u) => u.ticketId === t.id)?.newOrder ?? newOrderedTickets.indexOf(t)
        return {
          ticketId: t.id,
          sprintId: t.sprintId,
          order: t.order,
          newOrder,
        }
      })

      // Also track original orders of existing tickets that need reordering
      const existingTicketOrderUpdates = allOrderUpdates
        .filter((u) => !existingTicketIds.has(u.ticketId))
        .map((u) => {
          const ticket = targetSectionTickets.find((t) => t.id === u.ticketId)
          return {
            ticketId: u.ticketId,
            originalOrder: ticket?.order ?? 0,
            newOrder: u.newOrder,
          }
        })

      // Get sprint names for toast
      const fromSprints = new Set(ticketsChangingSprint.map((t) => t.sprintId ?? 'backlog'))
      const targetSprintName =
        targetSprintId === null
          ? 'Backlog'
          : (sprints?.find((s) => s.id === targetSprintId)?.name ?? 'Sprint')

      const count = ticketsChangingSprint.length
      const ticketKeys = ticketsChangingSprint.map((t) => `${projectKey}-${t.number}`)
      const fromLabel =
        fromSprints.size === 1
          ? fromSprints.has('backlog')
            ? 'Backlog'
            : (sprints?.find((s) => s.id === Array.from(fromSprints)[0])?.name ?? 'Sprint')
          : 'multiple sprints'

      // Optimistically update the board store (sprintId and order for moved tickets)
      for (const item of originalSprintIds) {
        updateTicket(projectId, item.ticketId, { sprintId: targetSprintId, order: item.newOrder })
      }
      // Also update order for existing tickets that need reordering
      for (const { ticketId, newOrder } of existingTicketOrderUpdates) {
        updateTicket(projectId, ticketId, { order: newOrder })
      }

      // Show toast
      showUndoRedoToast('success', {
        title:
          count === 1
            ? `${ticketKeys[0]} moved to ${targetSprintName}`
            : `${count} tickets moved to ${targetSprintName}`,
        description:
          count === 1 ? `From ${fromLabel}` : `${ticketKeys.join(', ')} — from ${fromLabel}`,
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
      )

      // Persist to database
      Promise.all([
        ...originalSprintIds.map(({ ticketId, newOrder }) =>
          updateTicketSprintMutation.mutateAsync({
            ticketId,
            sprintId: targetSprintId,
            order: newOrder,
          }),
        ),
        ...existingTicketOrderUpdates.map(({ ticketId, newOrder }) =>
          updateTicketAPI(projectId, ticketId, { order: newOrder }),
        ),
      ]).catch((error) => {
        // Revert on error
        for (const { ticketId, sprintId, order } of originalSprintIds) {
          updateTicket(projectId, ticketId, { sprintId, order })
        }
        for (const { ticketId, originalOrder } of existingTicketOrderUpdates) {
          updateTicket(projectId, ticketId, { order: originalOrder })
        }
        showUndoRedoToast('error', {
          title: 'Failed to move tickets',
          description: error.message,
        })
      })
    },
    [
      tickets,
      sprints,
      projectId,
      projectKey,
      updateTicket,
      updateTicketSprintMutation,
      ticketsBySprint,
      dropPosition,
    ],
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
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
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
              <div className="flex items-center gap-2">
                {/* Query mode toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQueryMode(!queryMode)}
                      className={cn(
                        'h-8 w-8',
                        queryMode
                          ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                          : 'text-zinc-400 hover:text-zinc-300',
                      )}
                    >
                      <Code2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {queryMode ? 'Switch to standard filters' : 'Switch to PQL query mode'}
                  </TooltipContent>
                </Tooltip>

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
            </div>

            {/* PQL Query Input */}
            {queryMode && (
              <QueryInput
                value={queryText}
                onChange={setQueryText}
                onClear={() => setQueryText('')}
                error={queryError}
                dynamicValues={dynamicValues}
                autoFocus
              />
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
            totalTicketCount={unfilteredTotals[sprint.id]?.count ?? 0}
            totalStoryPoints={unfilteredTotals[sprint.id]?.points ?? 0}
            totalCompletedCount={unfilteredTotals[sprint.id]?.completedCount ?? 0}
            totalCompletedPoints={unfilteredTotals[sprint.id]?.completedPoints ?? 0}
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
            totalTicketCount={unfilteredTotals[sprint.id]?.count ?? 0}
            totalStoryPoints={unfilteredTotals[sprint.id]?.points ?? 0}
            totalCompletedCount={unfilteredTotals[sprint.id]?.completedCount ?? 0}
            totalCompletedPoints={unfilteredTotals[sprint.id]?.completedPoints ?? 0}
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
          totalTicketCount={unfilteredTotals.backlog?.count ?? 0}
          totalStoryPoints={unfilteredTotals.backlog?.points ?? 0}
          totalCompletedCount={unfilteredTotals.backlog?.completedCount ?? 0}
          totalCompletedPoints={unfilteredTotals.backlog?.completedPoints ?? 0}
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
                  totalTicketCount={unfilteredTotals[sprint.id]?.count ?? 0}
                  totalStoryPoints={unfilteredTotals[sprint.id]?.points ?? 0}
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
