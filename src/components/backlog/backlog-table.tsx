'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useBacklogStore, type SortConfig } from '@/stores/backlog-store'
import { useSelectionStore } from '@/stores/selection-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { BacklogFilters } from './backlog-filters'
import { BacklogHeader } from './backlog-header'
import { BacklogRow } from './backlog-row'

interface BacklogTableProps {
  tickets: TicketWithRelations[]
  columns: ColumnWithTickets[]
  projectKey: string
  projectId: string
}

export function BacklogTable({
  tickets,
  columns: statusColumns,
  projectKey,
  projectId,
}: BacklogTableProps) {
  const {
    columns,
    reorderColumns,
    sort,
    filterByType,
    filterByPriority,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    searchQuery,
    showSubtasks,
    setColumnConfigOpen,
    backlogOrder,
    setBacklogOrder,
    clearBacklogOrder,
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
  const [hasManualOrder, setHasManualOrder] = useState(
    (backlogOrder[projectId] || []).length > 0,
  )
  const sortInitRef = useRef<SortConfig | null>(sort)
  const sortDidInitRef = useRef(false)

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
    const changed =
      prev?.column !== sort?.column || prev?.direction !== sort?.direction
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
            aVal = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
            bVal = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
            break
          case 'created':
            aVal = a.createdAt.getTime()
            bVal = b.createdAt.getTime()
            break
          case 'updated':
            aVal = a.updatedAt.getTime()
            bVal = b.updatedAt.getTime()
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
    sort,
    hasManualOrder,
    projectKey,
  ])

  const visibleColumns = columns.filter((c) => c.visible)
  const columnIds = visibleColumns.map((c) => c.id)

  // Get selection store
  const { selectedTicketIds, clearSelection, isSelected } = useSelectionStore()

  // Handle drag start - clear selection if dragging a non-selected ticket
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
  }

  // Handle drag end for both columns and rows
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
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
        setBacklogOrder(projectId, newOrder.map((t) => t.id))
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
          setBacklogOrder(projectId, newOrder.map((t) => t.id))
        }
      }
    }
  }

  // Get status name from columnId
  const getStatusName = (columnId: string) => {
    const col = statusColumns.find((c) => c.id === columnId)
    return col?.name || 'Unknown'
  }

  const ticketIds = filteredTickets.map((t) => t.id)

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <BacklogFilters statusColumns={statusColumns} />
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
        <DndContext
          id="backlog-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full border-collapse">
            {/* Header with column reordering */}
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

            {/* Body with row reordering - disabled when sorted */}
            <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <BacklogRow
                    key={ticket.id}
                    ticket={ticket}
                    projectKey={projectKey}
                    columns={visibleColumns}
                    getStatusName={getStatusName}
                    isDraggable={!sort}
                    allTicketIds={filteredTickets.map((t) => t.id)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>

        {filteredTickets.length === 0 && (
          <div className="flex h-40 items-center justify-center text-zinc-500">
            No tickets found
          </div>
        )}

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
