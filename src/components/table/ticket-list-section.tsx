'use client'

import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useBacklogStore } from '@/stores/backlog-store'
import { DropZone } from './drop-indicator'
import { TicketTable } from './ticket-table'
import type { TableContext, TicketListSectionProps } from './types'

/**
 * Shared wrapper around TicketTable used by SprintSection (and the backlog page).
 * Handles column config, TableContext, droppable zones, sort wiring, and empty states.
 */
export function TicketListSection({
  sectionId,
  sprintId,
  projectKey,
  projectId,
  statusColumns,
  tickets,
  draggingTicketIds = [],
  dropPosition = null,
  droppableId,
  droppableData,
  endDroppableId,
  endDroppableData,
  sort,
  onToggleSort,
  onSetSort,
  enableColumnReorder = false,
  onHideColumn,
  emptyMessage = 'Drag tickets here',
  showHeader = true,
  className,
  endZoneClassName,
  onIsOver,
}: TicketListSectionProps) {
  const { columns } = useBacklogStore()
  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns])
  const columnIds = visibleColumns.map((c) => c.id)
  const ticketIds = useMemo(() => tickets.map((t) => t.id), [tickets])

  // Droppable for the section
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: droppableData,
  })

  // Droppable zone at the end of the ticket list
  const { setNodeRef: setEndDropRef } = useDroppable({
    id: endDroppableId,
    data: endDroppableData,
  })

  // Notify parent of isOver changes
  useEffect(() => {
    onIsOver?.(isOver)
  }, [isOver, onIsOver])

  // Create table context
  const tableContext: TableContext = useMemo(
    () => ({
      sectionId,
      sprintId,
      projectKey,
      projectId,
      statusColumns,
    }),
    [sectionId, sprintId, projectKey, projectId, statusColumns],
  )

  // Handle sort toggle with sortable check
  const handleToggleSort = useCallback(
    (columnId: string) => {
      const column = columns.find((c) => c.id === columnId)
      if (!column?.sortable) return
      onToggleSort(columnId)
    },
    [columns, onToggleSort],
  )

  // Count visible (non-dragging) tickets for empty state
  const visibleCount = tickets.filter((t) => !draggingTicketIds.includes(t.id)).length
  const draggingCount = draggingTicketIds.length

  const table = (
    <TicketTable
      context={tableContext}
      tickets={tickets}
      columns={columns}
      allTicketIds={ticketIds}
      draggingTicketIds={draggingTicketIds}
      dropPosition={dropPosition}
      showHeader={showHeader}
      sort={sort}
      onToggleSort={handleToggleSort}
      onSetSort={onSetSort}
      enableColumnReorder={enableColumnReorder}
      onHideColumn={onHideColumn}
    />
  )

  return (
    <div ref={setNodeRef} className={cn(className)}>
      {visibleCount === 0 ? (
        <div className="px-4 py-3">
          <DropZone
            isActive={dropPosition !== null || isOver}
            itemCount={draggingCount}
            message={emptyMessage}
          />
        </div>
      ) : (
        <div className="relative">
          {enableColumnReorder ? (
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {table}
            </SortableContext>
          ) : (
            table
          )}
          <div ref={setEndDropRef} className={cn('h-2', endZoneClassName)} />
        </div>
      )}
    </div>
  )
}
