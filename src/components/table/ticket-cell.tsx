'use client'

import { format, isBefore, isToday } from 'date-fns'
import { User } from 'lucide-react'
import { InlineCodeText } from '@/components/common/inline-code'
import { PriorityBadge } from '@/components/common/priority-badge'
import { TypeBadge } from '@/components/common/type-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getStatusIcon } from '@/lib/status-icons'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import type { TicketCellProps } from './types'

/**
 * Renders a cell for a ticket based on the column configuration.
 * Pure component with no hooks - all data passed via props.
 */
export function TicketCell({ column, ticket, projectKey, getStatusName }: TicketCellProps) {
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
          <InlineCodeText text={ticket.title} className="truncate font-medium" />
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
                backgroundColor:
                  ticket.assignee.avatarColor ||
                  getAvatarColor(ticket.assignee.id || ticket.assignee.name),
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
                backgroundColor:
                  ticket.creator?.avatarColor ||
                  getAvatarColor(ticket.creator.id || ticket.creator.name),
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
          {format(ticket.dueDate, 'yyyy-MM-dd')}
        </span>
      )
    }

    case 'created':
      return <span className="text-sm text-zinc-400">{format(ticket.createdAt, 'yyyy-MM-dd')}</span>

    case 'updated':
      return <span className="text-sm text-zinc-400">{format(ticket.updatedAt, 'yyyy-MM-dd')}</span>

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
