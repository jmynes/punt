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
import { Settings2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DropZone, type TableContext, TicketTable } from '@/components/table'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { type SortConfig, useBacklogStore } from '@/stores/backlog-store'
import { useSelectionStore } from '@/stores/selection-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { BacklogFilters } from './backlog-filters'
import { BacklogHeader } from './backlog-header'

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
    filterByType,
    filterByPriority,
    filterByStatus,
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
    let result = [...orderedTickets]

    // Filter out subtasks if disabled
    if (!showSubtasks) {
      result = result.filter((t) => t.type !== 'subtask')
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          `${projectKey}-${t.number}`.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query),
      )
    }

    // Type filter
    if (filterByType.length > 0) {
      result = result.filter((t) => filterByType.includes(t.type))
    }

    // Priority filter
    if (filterByPriority.length > 0) {
      result = result.filter((t) => filterByPriority.includes(t.priority))
    }

    // Status filter
    if (filterByStatus.length > 0) {
      result = result.filter((t) => filterByStatus.includes(t.columnId))
    }

    // Assignee filter
    if (filterByAssignee.length > 0) {
      result = result.filter((t) => filterByAssignee.includes(t.assigneeId || 'unassigned'))
    }

    // Labels filter (any match)
    if (filterByLabels.length > 0) {
      result = result.filter((t) => {
        const ids = t.labels.map((l) => l.id)
        return ids.some((id) => filterByLabels.includes(id))
      })
    }

    // Sprint filter
    if (filterBySprint) {
      if (filterBySprint === 'backlog') {
        result = result.filter((t) => !t.sprintId)
      } else {
        result = result.filter((t) => t.sprintId === filterBySprint)
      }
    }

    // Points filter
    if (filterByPoints) {
      result = result.filter((t) => {
        if (t.storyPoints === null || t.storyPoints === undefined) return false

        const { operator, value } = filterByPoints
        switch (operator) {
          case '<':
            return t.storyPoints < value
          case '>':
            return t.storyPoints > value
          case '=':
            return t.storyPoints === value
          case '<=':
            return t.storyPoints <= value
          case '>=':
            return t.storyPoints >= value
          default:
            return false
        }
      })
    }

    // Due date filter
    const {
      from: dueDateFrom,
      to: dueDateTo,
      includeNone: includeNoDueDate,
      includeOverdue,
    } = filterByDueDate
    if (dueDateFrom || dueDateTo || includeNoDueDate || includeOverdue) {
      result = result.filter((t) => {
        // Check if we're only filtering for "no due date" tickets (no other filters active)
        const isNoDueDateOnly = includeNoDueDate && !dueDateFrom && !dueDateTo && !includeOverdue
        if (isNoDueDateOnly) {
          // Only show tickets without due dates
          return !t.dueDate
        }

        // Otherwise, apply full filtering logic
        // If we want to include overdue tickets, check that first
        if (includeOverdue && t.dueDate) {
          const ticketDate = new Date(t.dueDate)
          const now = new Date()
          // Overdue means due date is before today (end of today)
          const todayEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999,
          )
          if (ticketDate.getTime() < todayEnd.getTime()) {
            return true
          }
        }

        // If we want to include tickets with no due date, check that next
        if (includeNoDueDate && !t.dueDate) {
          return true
        }

        // If ticket has no due date but we're not including them, filter it out
        if (!t.dueDate) {
          return false
        }

        // Handle tickets with due dates
        const ticketDate = new Date(t.dueDate)
        const ticketTime = ticketDate.getTime()

        // If no from date, only check upper bound
        if (!dueDateFrom && dueDateTo) {
          const toTime = new Date(dueDateTo).setHours(23, 59, 59, 999)
          return ticketTime <= toTime
        }

        // If no to date, only check lower bound
        if (dueDateFrom && !dueDateTo) {
          const fromTime = new Date(dueDateFrom).setHours(0, 0, 0, 0)
          return ticketTime >= fromTime
        }

        // If both from and to dates, check range
        if (dueDateFrom && dueDateTo) {
          const fromTime = new Date(dueDateFrom).setHours(0, 0, 0, 0)
          const toTime = new Date(dueDateTo).setHours(23, 59, 59, 999)
          return ticketTime >= fromTime && ticketTime <= toTime
        }

        // If neither from nor to, and not including no due date or overdue, show all (shouldn't happen with current logic)
        return true
      })
    }

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
    filterByAssignee,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
    sort,
    hasManualOrder,
    projectKey,
    filterByLabels.includes,
    filterByLabels.length,
    filterByStatus.includes,
    filterByStatus.length,
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

  // Table content (shared between internal and external DnD modes)
  const tableContent = (
    <div>
      {/* Header with column reordering */}
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-zinc-900">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            <tr className="border-b border-zinc-800">
              {/* Empty cell for drag handle column */}
              <th className="w-8" />
              {visibleColumns.map((column) => (
                <BacklogHeader key={column.id} column={column} />
              ))}
            </tr>
          </SortableContext>
        </thead>
      </table>

      {/* Body with row reordering using unified TicketTable */}
      <TicketTable
        context={tableContext}
        tickets={filteredTickets}
        columns={columns}
        allTicketIds={ticketIds}
        draggingTicketIds={activeDraggingIds}
        dropPosition={activeDropPosition}
        showHeader={false}
      />
    </div>
  )

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

      {/* Table */}
      <ScrollArea
        className="flex-1"
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-sm text-zinc-500">
        <span>
          {filteredTickets.length} of {tickets.length} tickets
        </span>
      </div>
    </div>
  )
}
