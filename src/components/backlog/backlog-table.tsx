'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Settings2, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DropZone, type TableContext, TicketTable } from '@/components/table'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { filterTickets } from '@/lib/filter-tickets'
import { type SortConfig, useBacklogStore } from '@/stores/backlog-store'
import { useSelectionStore } from '@/stores/selection-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { BacklogFilters } from './backlog-filters'

interface BacklogTableProps {
  tickets: TicketWithRelations[]
  columns: ColumnWithTickets[]
  projectKey: string
  projectId: string
  /** When true, BacklogTable won't create its own DndContext - expects external one */
  useExternalDnd?: boolean
  /** Called when drag starts (for external DnD coordination) */
  onDragStart?: (event: DragStartEvent) => void
  /** Called when drag ends (for external DnD coordination) */
  onDragEnd?: (event: DragEndEvent) => void
  /** IDs of tickets being dragged (for external DnD mode) */
  externalDraggingIds?: string[]
  /** Insert index for drop indicator (for external DnD mode) - same as SprintSection */
  dropPosition?: number | null
}

export function BacklogTable({
  tickets,
  columns: statusColumns,
  projectKey,
  projectId,
  useExternalDnd = false,
  onDragStart: externalDragStart,
  onDragEnd: externalDragEnd,
  externalDraggingIds = [],
  dropPosition: externalDropPosition = null,
}: BacklogTableProps) {
  const {
    columns,
    reorderColumns,
    sort,
    toggleSort,
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
    setColumnConfigOpen,
    backlogOrder,
    setBacklogOrder,
    clearBacklogOrder: _clearBacklogOrder,
  } = useBacklogStore()

  // Apply persisted backlog order (per project) while keeping any new tickets appended
  const applyBacklogOrder = useMemo(
    () => (ticketList: TicketWithRelations[], order: string[]) => {
      if (order.length === 0) return ticketList
      const orderSet = new Set(order)
      const ordered = order
        .map((id) => ticketList.find((t) => t.id === id))
        .filter(Boolean) as TicketWithRelations[]
      const remaining = ticketList.filter((t) => !orderSet.has(t.id))
      return [...ordered, ...remaining]
    },
    [],
  )

  const [orderedTickets, setOrderedTickets] = useState<TicketWithRelations[]>(() =>
    applyBacklogOrder(tickets, backlogOrder[projectId] || []),
  )
  const [hasManualOrder, setHasManualOrder] = useState((backlogOrder[projectId] || []).length > 0)
  const sortInitRef = useRef<SortConfig | null>(sort)
  const sortDidInitRef = useRef(false)

  // Drag state
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  const [dropPosition, setDropPosition] = useState<number | null>(null)
  const draggedIdsRef = useRef<string[]>([])

  // Sync with incoming tickets prop
  useEffect(() => {
    const projectOrder = backlogOrder[projectId] || []
    const ordered = applyBacklogOrder(tickets, projectOrder)
    setOrderedTickets(ordered)
    setHasManualOrder(projectOrder.length > 0)
  }, [tickets, backlogOrder, projectId, applyBacklogOrder])

  // Reset manual order when sort changes (user clicked a column header to sort)
  useEffect(() => {
    // Ignore the first run to avoid clobbering persisted order on initial render
    if (!sortDidInitRef.current) {
      sortDidInitRef.current = true
      sortInitRef.current = sort
      return
    }

    const prev = sortInitRef.current
    const changed = prev?.column !== sort?.column || prev?.direction !== sort?.direction
    sortInitRef.current = sort

    if (!changed) return

    if (sort) {
      // When a sort is active, defer to sorted view but keep the stored manual order intact
      setHasManualOrder(false)
    } else {
      // Sort cleared: restore the persisted manual order for this project
      const projectOrder = backlogOrder[projectId] || []
      setHasManualOrder(projectOrder.length > 0)
      setOrderedTickets(applyBacklogOrder(tickets, projectOrder))
    }
  }, [sort, tickets, projectId, applyBacklogOrder, backlogOrder])

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

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    const result = filterTickets(orderedTickets, {
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

    // Sort (skip if using manual order from drag & drop)
    if (sort && !hasManualOrder) {
      result.sort((a, b) => {
        let aVal: string | number | Date | null = null
        let bVal: string | number | Date | null = null

        switch (sort.column) {
          case 'key':
            aVal = a.number
            bVal = b.number
            break
          case 'title':
            aVal = a.title.toLowerCase()
            bVal = b.title.toLowerCase()
            break
          case 'type':
            aVal = a.type
            bVal = b.type
            break
          case 'status':
            aVal = a.columnId
            bVal = b.columnId
            break
          case 'priority': {
            const priorityOrder = ['critical', 'highest', 'high', 'medium', 'low', 'lowest']
            aVal = priorityOrder.indexOf(a.priority)
            bVal = priorityOrder.indexOf(b.priority)
            break
          }
          case 'assignee':
            aVal = a.assignee?.name.toLowerCase() || 'zzz'
            bVal = b.assignee?.name.toLowerCase() || 'zzz'
            break
          case 'reporter':
            aVal = a.creator.name.toLowerCase()
            bVal = b.creator.name.toLowerCase()
            break
          case 'sprint':
            aVal = a.sprint?.name.toLowerCase() || 'zzz'
            bVal = b.sprint?.name.toLowerCase() || 'zzz'
            break
          case 'storyPoints':
            aVal = a.storyPoints ?? -1
            bVal = b.storyPoints ?? -1
            break
          case 'estimate':
            aVal = a.estimate || ''
            bVal = b.estimate || ''
            break
          case 'dueDate':
            aVal = a.dueDate
              ? (a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate)).getTime()
              : Number.MAX_SAFE_INTEGER
            bVal = b.dueDate
              ? (b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate)).getTime()
              : Number.MAX_SAFE_INTEGER
            break
          case 'created':
            aVal = (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)).getTime()
            bVal = (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).getTime()
            break
          case 'updated':
            aVal = (a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt)).getTime()
            bVal = (b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt)).getTime()
            break
          case 'parent':
            aVal = a.parentId || 'zzz'
            bVal = b.parentId || 'zzz'
            break
          case 'startDate':
            aVal = a.startDate
              ? (a.startDate instanceof Date ? a.startDate : new Date(a.startDate)).getTime()
              : Number.MAX_SAFE_INTEGER
            bVal = b.startDate
              ? (b.startDate instanceof Date ? b.startDate : new Date(b.startDate)).getTime()
              : Number.MAX_SAFE_INTEGER
            break
          case 'environment':
            aVal = a.environment?.toLowerCase() || 'zzz'
            bVal = b.environment?.toLowerCase() || 'zzz'
            break
          case 'affectedVersion':
            aVal = a.affectedVersion?.toLowerCase() || 'zzz'
            bVal = b.affectedVersion?.toLowerCase() || 'zzz'
            break
          case 'fixVersion':
            aVal = a.fixVersion?.toLowerCase() || 'zzz'
            bVal = b.fixVersion?.toLowerCase() || 'zzz'
            break
          case 'watchers':
            aVal = a.watchers?.length ?? 0
            bVal = b.watchers?.length ?? 0
            break
        }

        if (aVal === null || bVal === null) return 0
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [
    orderedTickets,
    showSubtasks,
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
    sort,
    hasManualOrder,
    projectKey,
  ])

  const visibleColumns = columns.filter((c) => c.visible)
  const columnIds = visibleColumns.map((c) => c.id)

  // Get selection store
  const { selectedTicketIds, clearSelection, isSelected } = useSelectionStore()

  // Droppable for backlog section (allows dropping at end of list or when empty)
  const { setNodeRef: setBacklogDropRef, isOver: isOverBacklog } = useDroppable({
    id: 'backlog',
    data: {
      type: 'sprint-section',
      sprintId: null,
    },
  })

  // Handle drag start - track dragging tickets and clear selection if needed
  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const activeId = active.id as string

    // Only for ticket drags (not column drags)
    const isColumnDrag = columnIds.includes(activeId as (typeof columnIds)[number])
    if (isColumnDrag) return

    // If dragging a ticket that's not part of the current selection, clear selection
    if (selectedTicketIds.size > 0 && !isSelected(activeId)) {
      clearSelection()
    }

    // Determine which tickets are being dragged
    const selected = Array.from(selectedTicketIds)
    let ticketIds: string[]
    if (selected.length > 1 && selected.includes(activeId)) {
      ticketIds = selected
    } else {
      ticketIds = [activeId]
    }

    setDraggingTicketIds(ticketIds)
    draggedIdsRef.current = ticketIds

    // Notify external handler
    externalDragStart?.(event)
  }

  // Handle drag over - track drop position for visual feedback
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event
      if (!over) {
        setDropPosition(null)
        return
      }

      const overId = over.id as string
      const draggedIds = draggedIdsRef.current

      // Ignore column drags
      if (columnIds.includes(overId as (typeof columnIds)[number])) {
        setDropPosition(null)
        return
      }

      // If hovering over a dragged ticket, don't show indicator
      if (draggedIds.includes(overId)) {
        setDropPosition(null)
        return
      }

      // Find the index of the ticket we're hovering over
      const overTicketIndex = filteredTickets.findIndex((t) => t.id === overId)
      if (overTicketIndex >= 0) {
        setDropPosition(overTicketIndex)
      } else {
        setDropPosition(null)
      }
    },
    [filteredTickets, columnIds],
  )

  // Handle drag end for both columns and rows
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    // Clean up drag state
    setDraggingTicketIds([])
    setDropPosition(null)
    draggedIdsRef.current = []

    // If dropped on a sprint section, delegate to external handler
    if (over?.data.current?.type === 'sprint-section') {
      externalDragEnd?.(event)
      return
    }

    if (!over || active.id === over.id) return

    const activeId = active.id as string

    // Check if it's a column drag (column IDs are like 'type', 'key', 'title', etc.)
    const isColumnDrag = columnIds.includes(activeId as (typeof columnIds)[number])

    if (isColumnDrag) {
      // Column reordering
      const oldIndex = columns.findIndex((c) => c.id === activeId)
      const newIndex = columns.findIndex((c) => c.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderColumns(oldIndex, newIndex)
      }
    } else {
      // Row/ticket reordering
      const overId = over.id as string

      // Work with the full orderedTickets (unfiltered) to keep hidden items in place
      const selectedIds = Array.from(selectedTicketIds)

      const baseOrdered = [...orderedTickets]

      // Multi-drag
      if (selectedIds.length > 1 && isSelected(activeId)) {
        const selectedSet = new Set(selectedIds)

        // Remove selected from base order
        const remaining = baseOrdered.filter((t) => !selectedSet.has(t.id))
        const selectedInOrder = baseOrdered.filter((t) => selectedSet.has(t.id))

        // Determine insertion index in the remaining (unfiltered) list
        let insertIndex = remaining.findIndex((t) => t.id === overId)
        if (insertIndex === -1) insertIndex = remaining.length
        // If over target is one of the selected (can happen in multi-select), put at end
        if (selectedSet.has(overId)) {
          insertIndex = remaining.length
        }

        const newOrder = [
          ...remaining.slice(0, insertIndex),
          ...selectedInOrder,
          ...remaining.slice(insertIndex),
        ]

        setOrderedTickets(newOrder)
        setHasManualOrder(true)
        setBacklogOrder(
          projectId,
          newOrder.map((t) => t.id),
        )
        clearSelection()
      } else {
        // Single drag using base order
        const oldIndex = baseOrdered.findIndex((t) => t.id === activeId)
        let targetIndex = baseOrdered.findIndex((t) => t.id === overId)
        if (targetIndex === -1) {
          targetIndex = baseOrdered.length - 1
        }

        if (oldIndex !== -1 && targetIndex !== -1) {
          const newOrder = arrayMove(baseOrdered, oldIndex, targetIndex)
          setOrderedTickets(newOrder)
          setHasManualOrder(true)
          setBacklogOrder(
            projectId,
            newOrder.map((t) => t.id),
          )
        }
      }
    }
  }

  const ticketIds = filteredTickets.map((t) => t.id)

  // Create table context for the unified TicketTable component
  const tableContext: TableContext = useMemo(
    () => ({
      sectionId: 'backlog',
      sprintId: null,
      projectKey,
      projectId,
      statusColumns,
    }),
    [projectKey, projectId, statusColumns],
  )

  // Determine active drag state for rendering
  const activeDraggingIds = useExternalDnd ? externalDraggingIds : draggingTicketIds
  const activeDropPosition = useExternalDnd ? externalDropPosition : dropPosition

  // Handle sort toggle with proper type casting
  const handleToggleSort = useCallback(
    (columnId: string) => {
      toggleSort(columnId as (typeof columns)[number]['id'])
    },
    [toggleSort],
  )

  // Table content (shared between internal and external DnD modes)
  const tableContent = (
    <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
      <TicketTable
        context={tableContext}
        tickets={filteredTickets}
        columns={columns}
        allTicketIds={ticketIds}
        draggingTicketIds={activeDraggingIds}
        dropPosition={activeDropPosition}
        showHeader={true}
        sort={sort}
        onToggleSort={handleToggleSort}
        enableColumnReorder={true}
      />
    </SortableContext>
  )

  // Compute story points totals
  const filteredPoints = filteredTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const totalPoints = tickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const isFiltered = filteredTickets.length !== tickets.length

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <BacklogFilters projectId={projectId} statusColumns={statusColumns} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setColumnConfigOpen(true)}
          className="shrink-0"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </div>

      {/* Summary header */}
      <div className="flex shrink-0 items-center justify-end gap-4 border-b border-zinc-800 px-4 py-2 text-sm">
        {/* Ticket count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default text-zinc-400">
              {isFiltered ? (
                <>
                  <span className="font-medium tabular-nums text-zinc-200">
                    {filteredTickets.length}
                  </span>
                  <span className="text-zinc-600"> / </span>
                  <span className="tabular-nums text-zinc-500">{tickets.length}</span>{' '}
                  {tickets.length === 1 ? 'issue' : 'issues'}
                </>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-zinc-200">{tickets.length}</span>{' '}
                  <span className="text-zinc-500">{tickets.length === 1 ? 'issue' : 'issues'}</span>
                </>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
            {isFiltered ? (
              <div className="space-y-1">
                <p className="text-xs text-zinc-100">
                  Showing {filteredTickets.length} of {tickets.length} issues
                </p>
                <p className="text-xs text-zinc-400">Filters are active</p>
              </div>
            ) : (
              <p className="text-xs text-zinc-100">
                {tickets.length} {tickets.length === 1 ? 'issue' : 'issues'} in backlog
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Story points */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default items-center gap-1.5 text-zinc-400">
              <TrendingUp className="h-3.5 w-3.5" />
              {isFiltered ? (
                <>
                  <span className="font-medium tabular-nums text-zinc-200">{filteredPoints}</span>
                  <span className="text-zinc-600"> / </span>
                  <span className="tabular-nums text-zinc-500">{totalPoints}</span>
                  <span className="text-zinc-600"> pts</span>
                </>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-zinc-200">{totalPoints}</span>
                  <span className="text-zinc-500"> pts</span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
            {isFiltered ? (
              <div className="space-y-1">
                <p className="text-xs text-zinc-100">
                  Showing {filteredPoints} of {totalPoints} story points
                </p>
                <p className="text-xs text-zinc-400">Filters are active</p>
              </div>
            ) : (
              <p className="text-xs text-zinc-100">{totalPoints} story points in backlog</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Table */}
      <ScrollArea
        className="min-h-0 flex-1"
        onClick={(e) => {
          // Clear selection when clicking on empty space (not on a ticket row)
          const target = e.target as HTMLElement
          if (target.closest('[data-ticket-row]') === null && selectedTicketIds.size > 0) {
            clearSelection()
          }
        }}
      >
        <div ref={setBacklogDropRef} className="flex min-h-full flex-col">
          {useExternalDnd ? (
            // When using external DnD, just render the sortable contexts (parent provides DndContext)
            tableContent
          ) : (
            // When using internal DnD, wrap with our own DndContext
            <DndContext
              id="backlog-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {tableContent}
            </DndContext>
          )}

          {filteredTickets.length === 0 ? (
            <div className="p-4">
              <DropZone
                isActive={isOverBacklog || externalDropPosition !== null}
                itemCount={useExternalDnd ? externalDraggingIds.length : draggingTicketIds.length}
                message="Drag tickets here to add them to the backlog"
              />
            </div>
          ) : (
            // Spacer to fill remaining space - acts as drop zone for "end of list"
            <div className="min-h-16 flex-1" />
          )}
        </div>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
