'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMemo } from 'react'
import { DropIndicator } from './drop-indicator'
import { TicketTableHeader } from './ticket-table-header'
import { TicketTableRow } from './ticket-table-row'
import type { TicketTableProps } from './types'

/**
 * Unified ticket table component.
 * Used by both BacklogTable and SprintSection.
 * Handles rendering tickets in a table with drag-and-drop support.
 *
 * Note: This component does not include a DndContext - the parent must provide one.
 */
export function TicketTable({
  context,
  tickets,
  columns,
  allTicketIds,
  draggingTicketIds = [],
  dropPosition = null,
  showHeader = true,
  sort,
  onToggleSort,
  onSetSort,
  enableColumnReorder = false,
  onHideColumn,
  overlayTicket,
}: TicketTableProps) {
  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns])
  const ticketIds = useMemo(() => tickets.map((t) => t.id), [tickets])

  // Render overlay if provided (for DragOverlay)
  if (overlayTicket) {
    return (
      <TicketTableRow
        ticket={overlayTicket}
        context={context}
        columns={visibleColumns}
        allTicketIds={allTicketIds}
        isOverlay
      />
    )
  }

  return (
    <table className="w-full border-collapse">
      {showHeader && (
        <TicketTableHeader
          columns={visibleColumns}
          sort={sort}
          onToggleSort={onToggleSort}
          onSetSort={onSetSort}
          enableColumnReorder={enableColumnReorder}
          onHideColumn={onHideColumn}
        />
      )}

      <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
        <tbody>
          {tickets.map((ticket, index) => {
            const isBeingDragged = draggingTicketIds.includes(ticket.id)
            // Show drop indicator before this ticket if this is the drop position
            // Don't show indicator on the dragged ticket itself
            const showIndicator = !isBeingDragged && index === dropPosition

            return (
              <TicketTableRow
                key={ticket.id}
                ticket={ticket}
                context={context}
                columns={visibleColumns}
                allTicketIds={allTicketIds}
                isBeingDragged={isBeingDragged}
                showDropIndicator={showIndicator}
                draggingCount={draggingTicketIds.length}
              />
            )
          })}
          {/* Drop indicator at end of list */}
          {dropPosition !== null && dropPosition >= tickets.length && tickets.length > 0 && (
            <tr>
              <td colSpan={visibleColumns.length + 1} className="p-0">
                <DropIndicator itemCount={draggingTicketIds.length} />
              </td>
            </tr>
          )}
        </tbody>
      </SortableContext>
    </table>
  )
}
