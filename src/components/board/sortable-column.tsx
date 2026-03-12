'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnWithTickets } from '@/types'
import { KanbanColumn } from './kanban-column'

interface SortableColumnProps {
  column: ColumnWithTickets
  projectId: string
  projectKey: string
  allColumns: ColumnWithTickets[]
  dragSelectionIds?: string[]
  activeTicketId?: string | null
  activeDragTarget?: number | null
  activeSprintId?: string | null
  isDraggingColumn?: boolean
  canDragColumns?: boolean
}

export function SortableColumn({
  column,
  projectId,
  projectKey,
  allColumns,
  dragSelectionIds = [],
  activeTicketId = null,
  activeDragTarget = null,
  activeSprintId = null,
  isDraggingColumn = false,
  canDragColumns = false,
}: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.id,
    data: {
      type: 'sortable-column',
      column,
    },
    disabled: !canDragColumns,
  })

  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null),
    transition,
    opacity: isDraggingColumn ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <KanbanColumn
        column={column}
        projectId={projectId}
        projectKey={projectKey}
        allColumns={allColumns}
        dragSelectionIds={dragSelectionIds}
        activeTicketId={activeTicketId}
        activeDragTarget={activeDragTarget}
        activeSprintId={activeSprintId}
        columnDragHandleProps={canDragColumns ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  )
}
