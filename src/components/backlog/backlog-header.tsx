'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type BacklogColumn, useBacklogStore } from '@/stores/backlog-store'

interface BacklogHeaderProps {
  column: BacklogColumn
}

export function BacklogHeader({ column }: BacklogHeaderProps) {
  const { sort, toggleSort } = useBacklogStore()
  const isSorted = sort?.column === column.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  })

  const handleSortClick = column.sortable ? () => toggleSort(column.id) : undefined

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: column.width || undefined,
    minWidth: column.minWidth,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative select-none whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-400',
        isDragging && 'z-50 bg-zinc-800 opacity-80',
        column.sortable && 'cursor-pointer hover:text-zinc-200',
      )}
      onClick={handleSortClick}
      role={column.sortable ? 'button' : undefined}
      aria-sort={column.sortable && isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <div className="flex items-center gap-1">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>

        {/* Column label */}
        <span className={cn(column.sortable && 'hover:underline')}>{column.label}</span>

        {/* Sort indicator */}
        {isSorted && (
          <span className="text-amber-500">
            {sort.direction === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
    </th>
  )
}
