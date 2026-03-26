'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CheckIcon, GripVertical } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { TicketContextMenu } from '@/components/board/ticket-context-menu'
import { cn } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { DropIndicator } from './drop-indicator'
import { TicketCell } from './ticket-cell'
import type { TicketTableRowProps } from './types'

/**
 * Unified table row for tickets.
 * Used by SprintSection (and the backlog page).
 * Handles selection, drag-and-drop, and visual states.
 */
export function TicketTableRow({
  ticket,
  context,
  columns,
  allTicketIds,
  isBeingDragged = false,
  showDropIndicator = false,
  draggingCount = 0,
  isOverlay = false,
  reorderDisabled = false,
}: TicketTableRowProps) {
  const { setActiveTicketId } = useUIStore()
  const { isSelected, selectTicket, toggleTicket, selectRange } = useSelectionStore()
  const selected = isSelected(ticket.id)
  const hasAnySelection = useSelectionStore((s) => s.selectedTicketIds.size > 0)

  const { attributes, listeners, setNodeRef } = useSortable({
    id: ticket.id,
    data: {
      type: 'ticket',
      ticket,
      sprintId: ticket.sprintId,
    },
  })

  // Get status name from column ID
  const getStatusName = useCallback(
    (columnId: string) => {
      const col = context.statusColumns.find((c) => c.id === columnId)
      return col?.name || 'Unknown'
    },
    [context.statusColumns],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Ctrl/Cmd + click: toggle selection (don't open detail)
      if (e.ctrlKey || e.metaKey) {
        toggleTicket(ticket.id)
        return
      }

      // Shift + click: range selection (don't open detail)
      if (e.shiftKey) {
        selectRange(ticket.id, allTicketIds)
        return
      }

      // If this ticket is already selected and part of a multi-selection,
      // collapse to single selection and open the ticket
      if (selected && useSelectionStore.getState().selectedTicketIds.size > 1) {
        selectTicket(ticket.id)
        setActiveTicketId(ticket.id)
        return
      }

      // Normal click: open ticket detail (and select only this one)
      selectTicket(ticket.id)
      setActiveTicketId(ticket.id)
    },
    [ticket.id, selected, allTicketIds, toggleTicket, selectRange, selectTicket, setActiveTicketId],
  )

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleTicket(ticket.id)
    },
    [ticket.id, toggleTicket],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        selectTicket(ticket.id)
        setActiveTicketId(ticket.id)
      }
    },
    [ticket.id, selectTicket, setActiveTicketId],
  )

  // Memoize row styles
  const rowClassName = useMemo(
    () =>
      cn(
        'group border-b border-zinc-800/50 transition-all duration-200 focus:outline-none select-none',
        !selected && !isBeingDragged && 'hover:bg-zinc-800/50 focus:bg-zinc-800/50',
        !reorderDisabled && 'cursor-grab active:cursor-grabbing',
        // Being dragged - prominent "moving" state
        isBeingDragged && [
          'bg-amber-500/10 border-amber-500/40',
          'ring-2 ring-amber-500/50 ring-offset-1 ring-offset-zinc-900',
          'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
          'relative z-10',
        ],
        // Selected state
        selected &&
          !isBeingDragged &&
          'bg-amber-500/20 hover:bg-amber-500/25 focus:bg-amber-500/25 border-amber-500/50',
      ),
    [selected, isBeingDragged, reorderDisabled],
  )

  // For overlay, render as a standalone table
  if (isOverlay) {
    return (
      <table className="w-full border-collapse bg-zinc-800 rounded-lg shadow-2xl shadow-black/50 ring-2 ring-blue-500/50">
        <tbody>
          <tr className="select-none">
            {/* Checkbox cell (placeholder in overlay) */}
            <td className="w-10 pl-3.5 pr-0.5 py-2">
              <div className="flex h-6 w-6 items-center justify-center">
                <div className="h-4 w-4 rounded-[4px] border border-amber-500 bg-amber-500 flex items-center justify-center">
                  <CheckIcon className="h-3 w-3 text-white" />
                </div>
              </div>
            </td>
            <td className="w-10 pl-3.5 pr-0.5 py-2">
              <div className="flex h-6 w-6 items-center justify-center">
                <GripVertical className="h-4 w-4 text-zinc-500" />
              </div>
            </td>
            {columns.map((column) => (
              <td
                key={column.id}
                style={{
                  width: column.width || undefined,
                  minWidth: column.minWidth,
                }}
                className="px-3 py-2"
              >
                <TicketCell
                  column={column}
                  ticket={ticket}
                  projectKey={context.projectKey}
                  getStatusName={getStatusName}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    )
  }

  return (
    <>
      {/* Drop indicator before this row */}
      {showDropIndicator && (
        <tr>
          <td colSpan={columns.length + 2} className="p-0">
            <DropIndicator itemCount={draggingCount} />
          </td>
        </tr>
      )}
      <TicketContextMenu ticket={ticket}>
        <tr
          ref={setNodeRef}
          data-ticket-row
          data-ticket-id={ticket.id}
          className={rowClassName}
          {...attributes}
          {...listeners}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          {/* Selection checkbox */}
          <td className="w-10 pl-3.5 pr-0.5 py-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center',
                // Always visible when selected or any selection exists; otherwise show on hover
                !selected && !hasAnySelection && 'opacity-0 group-hover:opacity-100',
                'transition-opacity',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={`Select ticket ${context.projectKey}-${ticket.number ?? ticket.id}`}
                onClick={handleCheckboxClick}
                className={cn(
                  'h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors',
                  selected
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-zinc-600 bg-transparent hover:border-zinc-400',
                )}
              >
                {selected && <CheckIcon className="h-3 w-3" />}
              </button>
            </div>
          </td>

          {/* Drag handle */}
          <td className="w-10 pl-3.5 pr-0.5 py-2">
            {!reorderDisabled && (
              <div className="flex h-6 w-6 items-center justify-center rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                <GripVertical className="h-4 w-4 text-zinc-500" />
              </div>
            )}
          </td>

          {columns.map((column) => (
            <td
              key={column.id}
              style={{
                width: column.width || undefined,
                minWidth: column.minWidth,
              }}
              className="px-3 py-2"
            >
              <TicketCell
                column={column}
                ticket={ticket}
                projectKey={context.projectKey}
                getStatusName={getStatusName}
              />
            </td>
          ))}
        </tr>
      </TicketContextMenu>
    </>
  )
}
