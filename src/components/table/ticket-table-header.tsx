'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, CheckIcon, EyeOff, GripVertical, MinusIcon, X } from 'lucide-react'
import { useCallback } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selection-store'
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
  onHideColumn,
}: {
  column: BacklogColumn
  sort?: SortConfig | null
  onSetSort?: (sort: SortConfig | null) => void
  onHideColumn?: (columnId: string) => void
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
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => onSetSort(null)} disabled={!isSorted}>
        <X className="h-4 w-4" />
        Clear Sort
      </ContextMenuItem>
      {onHideColumn && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onHideColumn(column.id)}>
            <EyeOff className="h-4 w-4" />
            Hide Column
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
function SortableHeaderCell({
  column,
  sort,
  onToggleSort,
  onSetSort,
  onHideColumn,
}: SortableHeaderCellProps) {
  const isSorted = sort?.column === column.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
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
        className="shrink-0 cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
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
        <SortContextMenuContent
          column={column}
          sort={sort}
          onSetSort={onSetSort}
          onHideColumn={onHideColumn}
        />
      </ContextMenu>
    )
  }

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
      <ContextMenuContent>
        <ContextMenuLabel className="text-zinc-500">Not sortable</ContextMenuLabel>
        {onHideColumn && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onHideColumn(column.id)}>
              <EyeOff className="h-4 w-4" />
              Hide Column
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * A non-sortable header cell (no drag reordering).
 * Supports a right-click context menu for sort controls.
 */
function StaticHeaderCell({
  column,
  sort,
  onToggleSort,
  onSetSort,
  onHideColumn,
}: SortableHeaderCellProps) {
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
        <SortContextMenuContent
          column={column}
          sort={sort}
          onSetSort={onSetSort}
          onHideColumn={onHideColumn}
        />
      </ContextMenu>
    )
  }

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
      <ContextMenuContent>
        <ContextMenuLabel className="text-zinc-500">Not sortable</ContextMenuLabel>
        {onHideColumn && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onHideColumn(column.id)}>
              <EyeOff className="h-4 w-4" />
              Hide Column
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
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
  onHideColumn,
  allTicketIds = [],
}: TicketTableHeaderProps) {
  const HeaderCell = enableColumnReorder ? SortableHeaderCell : StaticHeaderCell
  const { selectedTicketIds, addToSelection, clearSelection } = useSelectionStore()
  const hasAnySelection = selectedTicketIds.size > 0

  // Determine select-all state
  const allSelected =
    allTicketIds.length > 0 && allTicketIds.every((id) => selectedTicketIds.has(id))
  const someSelected = hasAnySelection && !allSelected

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection()
    } else {
      addToSelection(allTicketIds)
    }
  }, [allSelected, allTicketIds, addToSelection, clearSelection])

  return (
    <thead
      className="sticky z-10 text-left text-xs text-zinc-500 uppercase tracking-wider"
      style={{
        backgroundColor: 'var(--table-header-bg, rgb(9 9 11))',
        top: 'var(--section-header-height, 0px)',
      }}
    >
      <tr className="border-b border-zinc-800">
        {/* Select all checkbox */}
        <th className="w-8 px-1 py-2">
          <div className="flex h-6 w-6 items-center justify-center">
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn(
                'h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors',
                allSelected
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : someSelected
                    ? 'border-amber-500 bg-amber-500/30 text-amber-400'
                    : 'border-zinc-600 bg-transparent hover:border-zinc-400',
              )}
            >
              {allSelected && <CheckIcon className="h-3 w-3" />}
              {someSelected && !allSelected && <MinusIcon className="h-3 w-3" />}
            </button>
          </div>
        </th>
        {/* Empty cell for drag handle column */}
        <th className="w-8" />
        {columns.map((column) => (
          <HeaderCell
            key={column.id}
            column={column}
            sort={sort}
            onToggleSort={onToggleSort}
            onSetSort={onSetSort}
            onHideColumn={onHideColumn}
          />
        ))}
      </tr>
    </thead>
  )
}
