'use client'

import { useSortable } from '@dnd-kit/sortable'
import { format, isBefore, isToday } from 'date-fns'
import { GripVertical, User } from 'lucide-react'
import { PriorityBadge } from '@/components/common/priority-badge'
import { TypeBadge } from '@/components/common/type-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getStatusIcon } from '@/lib/status-icons'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { TicketContextMenu } from '../board/ticket-context-menu'
import { DropIndicator } from './drop-indicator'

interface SprintTableRowProps {
  ticket: TicketWithRelations
  projectKey: string
  statusColumns: ColumnWithTickets[]
  allTicketIds: string[]
  isOverlay?: boolean
  /** Whether this row is currently being dragged */
  isBeingDragged?: boolean
  /** Whether to show drop indicator before this row */
  showDropIndicator?: boolean
  /** Number of items being dragged */
  draggingCount?: number
}

/**
 * Table row for sprint tickets - matches backlog table styling.
 */
export function SprintTableRow({
  ticket,
  projectKey,
  statusColumns,
  allTicketIds,
  isOverlay = false,
  isBeingDragged = false,
  showDropIndicator = false,
  draggingCount = 0,
}: SprintTableRowProps) {
  const { setActiveTicketId } = useUIStore()
  const { isSelected, selectTicket, toggleTicket, selectRange } = useSelectionStore()
  const selected = isSelected(ticket.id)

  const { attributes, listeners, setNodeRef } = useSortable({
    id: ticket.id,
    data: {
      type: 'ticket',
      ticket,
      sprintId: ticket.sprintId,
    },
  })

  // Don't apply transform - we want tickets to stay in place until drop
  // The drop indicator shows where they'll land

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleTicket(ticket.id)
      return
    }
    if (e.shiftKey) {
      selectRange(ticket.id, allTicketIds)
      return
    }
    if (selected && useSelectionStore.getState().selectedTicketIds.size > 1) {
      return
    }
    selectTicket(ticket.id)
    setActiveTicketId(ticket.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      selectTicket(ticket.id)
      setActiveTicketId(ticket.id)
    }
  }

  // Get status name from columnId
  const getStatusName = (columnId: string) => {
    const col = statusColumns.find((c) => c.id === columnId)
    return col?.name || 'Unknown'
  }

  const statusName = getStatusName(ticket.columnId)
  const { icon: StatusIcon, color: statusColor } = getStatusIcon(statusName)
  const isOverdue =
    ticket.dueDate && isBefore(ticket.dueDate, new Date()) && !isToday(ticket.dueDate)
  const isDueToday = ticket.dueDate && isToday(ticket.dueDate)

  // For overlay, render as a standalone table
  if (isOverlay) {
    return (
      <table className="w-full border-collapse bg-zinc-800 rounded-lg shadow-2xl shadow-black/50 ring-2 ring-blue-500/50">
        <tbody>
          <tr className="select-none">
            <td className="w-8 px-1 py-2">
              <div className="flex h-6 w-6 items-center justify-center">
                <GripVertical className="h-4 w-4 text-zinc-500" />
              </div>
            </td>
            <td className="px-3 py-2 w-10">
              <TypeBadge type={ticket.type} />
            </td>
            <td className="px-3 py-2 w-24">
              <span className="font-mono text-sm text-zinc-400">
                {projectKey}-{ticket.number}
              </span>
            </td>
            <td className="px-3 py-2">
              <span className="truncate font-medium text-zinc-200">{ticket.title}</span>
            </td>
            <td className="px-3 py-2 w-28">
              <Badge variant="secondary" className="whitespace-nowrap flex items-center gap-1">
                <StatusIcon className={cn('h-3.5 w-3.5', statusColor)} aria-hidden />
                {statusName}
              </Badge>
            </td>
            <td className="px-3 py-2 w-24">
              <PriorityBadge priority={ticket.priority} showLabel />
            </td>
            <td className="px-3 py-2 w-16 text-center">
              {ticket.storyPoints !== null ? (
                <Badge variant="outline" className="font-mono">
                  {ticket.storyPoints}
                </Badge>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </td>
            <td className="px-3 py-2 w-8">
              {ticket.assignee ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ticket.assignee.avatar || undefined} />
                  <AvatarFallback
                    className="text-[10px] text-white font-medium"
                    style={{
                      backgroundColor: getAvatarColor(ticket.assignee.id || ticket.assignee.name),
                    }}
                  >
                    {getInitials(ticket.assignee.name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                    <User className="h-3 w-3 text-zinc-500" />
                  </AvatarFallback>
                </Avatar>
              )}
            </td>
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
          <td colSpan={9} className="p-0">
            <DropIndicator itemCount={draggingCount} />
          </td>
        </tr>
      )}
      <TicketContextMenu ticket={ticket}>
        <tr
          ref={setNodeRef}
          data-ticket-row
          data-ticket-id={ticket.id}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            'group border-b border-zinc-800/50 transition-all duration-200 focus:outline-none select-none',
            !selected && !isBeingDragged && 'hover:bg-zinc-800/50 focus:bg-zinc-800/50',
            'cursor-grab active:cursor-grabbing',
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
          )}
          {...attributes}
          {...listeners}
        >
          {/* Drag handle */}
          <td className="w-8 px-1 py-2">
            <div className="flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <GripVertical className="h-4 w-4 text-zinc-500" />
            </div>
          </td>

          {/* Type */}
          <td className="px-3 py-2 w-10">
            <TypeBadge type={ticket.type} />
          </td>

          {/* Key */}
          <td className="px-3 py-2 w-24">
            <span className="font-mono text-sm text-zinc-400">
              {projectKey}-{ticket.number}
            </span>
          </td>

          {/* Title */}
          <td className="px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{ticket.title}</span>
              {ticket._count && ticket._count.subtasks > 0 && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {ticket._count.subtasks} subtasks
                </Badge>
              )}
            </div>
          </td>

          {/* Status */}
          <td className="px-3 py-2 w-28">
            <Badge variant="secondary" className="whitespace-nowrap flex items-center gap-1">
              <StatusIcon className={cn('h-3.5 w-3.5', statusColor)} aria-hidden />
              {statusName}
            </Badge>
          </td>

          {/* Priority */}
          <td className="px-3 py-2 w-24">
            <PriorityBadge priority={ticket.priority} showLabel />
          </td>

          {/* Story Points */}
          <td className="px-3 py-2 w-16 text-center">
            {ticket.storyPoints !== null ? (
              <Badge variant="outline" className="font-mono">
                {ticket.storyPoints}
              </Badge>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </td>

          {/* Due Date */}
          <td className="px-3 py-2 w-24">
            {ticket.dueDate ? (
              <span
                className={cn(
                  'text-sm',
                  isOverdue && 'font-medium text-red-400',
                  isDueToday && 'font-medium text-amber-400',
                )}
              >
                {format(ticket.dueDate, 'MMM d')}
              </span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </td>

          {/* Assignee */}
          <td className="px-3 py-2 w-8">
            {ticket.assignee ? (
              <Avatar className="h-6 w-6">
                <AvatarImage src={ticket.assignee.avatar || undefined} />
                <AvatarFallback
                  className="text-[10px] text-white font-medium"
                  style={{
                    backgroundColor: getAvatarColor(ticket.assignee.id || ticket.assignee.name),
                  }}
                >
                  {getInitials(ticket.assignee.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                  <User className="h-3 w-3 text-zinc-500" />
                </AvatarFallback>
              </Avatar>
            )}
          </td>
        </tr>
      </TicketContextMenu>
    </>
  )
}
