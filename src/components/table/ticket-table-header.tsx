'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type {
  BacklogColumn,
  SortableHeaderCellProps,
  SortConfig,
  TicketTableHeaderProps,
} from './types'

/**
 * Context menu content for sorting a column header.
 * Shows Sort Ascending, Sort Descending, and Clear Sort (when active).
 */
function SortContextMenuContent({
  column,
  sort,
  onSetSort,
}: {
  column: BacklogColumn
  sort?: SortConfig | null
  onSetSort?: (sort: SortConfig | null) => void
}) {
  if (!column.sortable || !onSetSort) return null

  const isSorted = sort?.column === column.id
  const isSortedAsc = isSorted && sort?.direction === 'asc'
  const isSortedDesc = isSorted && sort?.direction === 'desc'

  return (
    <ContextMenuContent>
      <ContextMenuItem
        onClick={() => onSetSort({ column: column.id, direction: 'asc' })}
        className={cn(isSortedAsc && 'text-amber-500')}
      >
        <ArrowUp className="h-4 w-4" />
        Sort Ascending
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => onSetSort({ column: column.id, direction: 'desc' })}
        className={cn(isSortedDesc && 'text-amber-500')}
      >
        <ArrowDown className="h-4 w-4" />
        Sort Descending
      </ContextMenuItem>
      {isSorted && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onSetSort(null)}>
            <X className="h-4 w-4" />
            Clear Sort
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  )
}

/**
 * A sortable header cell for the ticket table.
 * Supports column reordering via drag-and-drop, sort toggling via click,
 * and a right-click context menu for sort controls.
 */
function SortableHeaderCell({ column, sort, onToggleSort, onSetSort }: SortableHeaderCellProps) {
  const isSorted = sort?.column === column.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  })

  const handleSortClick =
    column.sortable && onToggleSort ? () => onToggleSort(column.id) : undefined

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: column.width || undefined,
    minWidth: column.minWidth,
  }

  const headerContent = (
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
  )

  // Wrap sortable columns with context menu, non-sortable columns render plain
  if (column.sortable && onSetSort) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
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
            aria-sort={
              column.sortable && isSorted
                ? sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            }
          >
            {headerContent}
          </th>
        </ContextMenuTrigger>
        <SortContextMenuContent column={column} sort={sort} onSetSort={onSetSort} />
      </ContextMenu>
    )
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
      aria-sort={
        column.sortable && isSorted
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
    >
      {headerContent}
    </th>
  )
}

/**
 * A non-sortable header cell (no drag reordering).
 * Supports a right-click context menu for sort controls.
 */
function StaticHeaderCell({ column, sort, onToggleSort, onSetSort }: SortableHeaderCellProps) {
  const isSorted = sort?.column === column.id
  const handleSortClick =
    column.sortable && onToggleSort ? () => onToggleSort(column.id) : undefined

  const headerContent = (
    <div className="flex items-center gap-1">
      <span className={cn(column.sortable && 'hover:underline')}>{column.label}</span>
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
  )

  // Wrap sortable columns with context menu
  if (column.sortable && onSetSort) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <th
            style={{
              width: column.width || undefined,
              minWidth: column.minWidth,
            }}
            className={cn(
              'select-none whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-400',
              column.sortable && 'cursor-pointer hover:text-zinc-200',
            )}
            onClick={handleSortClick}
            role={column.sortable ? 'button' : undefined}
            aria-sort={
              column.sortable && isSorted
                ? sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            }
          >
            {headerContent}
          </th>
        </ContextMenuTrigger>
        <SortContextMenuContent column={column} sort={sort} onSetSort={onSetSort} />
      </ContextMenu>
    )
  }

  return (
    <th
      style={{
        width: column.width || undefined,
        minWidth: column.minWidth,
      }}
      className={cn(
        'select-none whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-400',
        column.sortable && 'cursor-pointer hover:text-zinc-200',
      )}
      onClick={handleSortClick}
      role={column.sortable ? 'button' : undefined}
      aria-sort={
        column.sortable && isSorted
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
    >
      {headerContent}
    </th>
  )
}

/**
 * Header row for the ticket table.
 * Supports optional column reordering, sorting via click, and
 * a right-click context menu with sort ascending/descending/clear.
 */
export function TicketTableHeader({
  columns,
  sort,
  onToggleSort,
  onSetSort,
  enableColumnReorder = false,
}: TicketTableHeaderProps) {
  const HeaderCell = enableColumnReorder ? SortableHeaderCell : StaticHeaderCell

  return (
    <thead className="text-left text-xs text-zinc-500 uppercase tracking-wider">
      <tr className="border-b border-zinc-800/50">
        {/* Empty cell for drag handle column */}
        <th className="w-8" />
        {columns.map((column) => (
          <HeaderCell
            key={column.id}
            column={column}
            sort={sort}
            onToggleSort={onToggleSort}
            onSetSort={onSetSort}
          />
        ))}
      </tr>
    </thead>
  )
}
