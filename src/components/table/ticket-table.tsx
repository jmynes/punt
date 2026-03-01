'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMemo } from 'react'
import { nestTickets } from '@/lib/nest-tickets'
import { useBacklogStore } from '@/stores/backlog-store'
import { DropIndicator } from './drop-indicator'
import { TicketTableHeader } from './ticket-table-header'
import { TicketTableRow } from './ticket-table-row'
import type { TicketTableProps } from './types'

/**
 * Unified ticket table component.
 * Used by both BacklogTable and SprintSection.
 * Handles rendering tickets in a table with drag-and-drop support.
 * Supports nested subtask display under parent tickets.
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

  const collapsedParentIds = useBacklogStore((s) => s.collapsedParentIds)
  const toggleParentCollapsed = useBacklogStore((s) => s.toggleParentCollapsed)

  // Build collapsed set for lookup
  const collapsedSet = useMemo(() => new Set(collapsedParentIds), [collapsedParentIds])

  // Nest tickets: group subtasks under their parents
  const nestedEntries = useMemo(() => nestTickets(tickets, collapsedSet), [tickets, collapsedSet])

  // Ticket IDs for SortableContext - use the nested order
  const ticketIds = useMemo(() => nestedEntries.map((e) => e.ticket.id), [nestedEntries])

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
          {nestedEntries.map((entry, index) => {
            const { ticket } = entry
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
                isNested={entry.isNested}
                depth={entry.depth}
                hasChildren={entry.hasChildren}
                childCount={entry.childCount}
                isCollapsed={collapsedSet.has(ticket.id)}
                onToggleCollapse={toggleParentCollapsed}
              />
            )
          })}
          {/* Drop indicator at end of list */}
          {dropPosition !== null &&
            dropPosition >= nestedEntries.length &&
            nestedEntries.length > 0 && (
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
