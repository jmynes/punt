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
import type { BacklogColumn } from '@/stores/backlog-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { TicketContextMenu } from '../board/ticket-context-menu'
import { DropIndicator } from './drop-indicator'

interface SprintTableRowProps {
  ticket: TicketWithRelations
  projectKey: string
  statusColumns: ColumnWithTickets[]
  columns: BacklogColumn[]
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
 * Table row for sprint tickets - uses configurable columns from backlog store.
 */
export function SprintTableRow({
  ticket,
  projectKey,
  statusColumns,
  columns,
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

  const renderCell = (column: BacklogColumn) => {
    switch (column.id) {
      case 'type':
        return <TypeBadge type={ticket.type} />

      case 'key':
        return (
          <span className="font-mono text-sm text-zinc-400">
            {projectKey}-{ticket.number}
          </span>
        )

      case 'title':
        return (
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{ticket.title}</span>
            {ticket._count && ticket._count.subtasks > 0 && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {ticket._count.subtasks} subtasks
              </Badge>
            )}
          </div>
        )

      case 'status': {
        const statusName = getStatusName(ticket.columnId)
        const { icon: StatusIcon, color } = getStatusIcon(statusName)
        return (
          <Badge variant="secondary" className="whitespace-nowrap flex items-center gap-1">
            <StatusIcon className={cn('h-3.5 w-3.5', color)} aria-hidden />
            {statusName}
          </Badge>
        )
      }

      case 'priority':
        return <PriorityBadge priority={ticket.priority} showLabel />

      case 'assignee':
        return ticket.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
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
            <span className="truncate text-sm">{ticket.assignee.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-500">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                <User className="h-3 w-3 text-zinc-500" />
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">Unassigned</span>
          </div>
        )

      case 'reporter':
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={ticket.creator.avatar || undefined} />
              <AvatarFallback
                className="text-[10px] text-white font-medium"
                style={{
                  backgroundColor: getAvatarColor(ticket.creator.id || ticket.creator.name),
                }}
              >
                {getInitials(ticket.creator.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{ticket.creator.name}</span>
          </div>
        )

      case 'labels':
        return (
          <div className="flex flex-wrap gap-1">
            {ticket.labels.slice(0, 2).map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                style={{
                  borderColor: label.color,
                  color: label.color,
                }}
                className="text-xs"
              >
                {label.name}
              </Badge>
            ))}
            {ticket.labels.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{ticket.labels.length - 2}
              </Badge>
            )}
          </div>
        )

      case 'sprint':
        return ticket.sprint ? (
          <Badge
            variant="outline"
            className={cn(
              ticket.sprint.status === 'active'
                ? 'border-green-600 bg-green-900/30 text-green-400'
                : 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
            )}
          >
            {ticket.sprint.name}
          </Badge>
        ) : (
          <span className="text-zinc-500">—</span>
        )

      case 'storyPoints':
        return ticket.storyPoints !== null ? (
          <Badge variant="outline" className="font-mono">
            {ticket.storyPoints}
          </Badge>
        ) : (
          <span className="text-zinc-500">—</span>
        )

      case 'estimate':
        return ticket.estimate ? (
          <span className="text-sm">{ticket.estimate}</span>
        ) : (
          <span className="text-zinc-500">—</span>
        )

      case 'dueDate': {
        if (!ticket.dueDate) return <span className="text-zinc-500">—</span>
        const isOverdue = isBefore(ticket.dueDate, new Date()) && !isToday(ticket.dueDate)
        const isDueToday = isToday(ticket.dueDate)
        return (
          <span
            className={cn(
              'text-sm',
              isOverdue && 'font-medium text-red-400',
              isDueToday && 'font-medium text-amber-400',
            )}
          >
            {format(ticket.dueDate, 'MMM d')}
          </span>
        )
      }

      case 'created':
        return (
          <span className="text-sm text-zinc-400">{format(ticket.createdAt, 'yyyy-MM-dd')}</span>
        )

      case 'updated':
        return (
          <span className="text-sm text-zinc-400">{format(ticket.updatedAt, 'yyyy-MM-dd')}</span>
        )

      case 'parent':
        return ticket.parentId ? (
          <span className="text-sm text-zinc-400">{ticket.parentId}</span>
        ) : (
          <span className="text-zinc-500">—</span>
        )

      default:
        return null
    }
  }

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
            {columns.map((column) => (
              <td
                key={column.id}
                style={{
                  width: column.width || undefined,
                  minWidth: column.minWidth,
                }}
                className="px-3 py-2"
              >
                {renderCell(column)}
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
          <td colSpan={columns.length + 1} className="p-0">
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

          {columns.map((column) => (
            <td
              key={column.id}
              style={{
                width: column.width || undefined,
                minWidth: column.minWidth,
              }}
              className="px-3 py-2"
            >
              {renderCell(column)}
            </td>
          ))}
        </tr>
      </TicketContextMenu>
    </>
  )
}
