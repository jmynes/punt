'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, isToday } from 'date-fns'
import { Calendar, GripVertical, MessageSquare, Paperclip, Repeat } from 'lucide-react'
import { InlineCodeText } from '@/components/common/inline-code'
import { PriorityBadge } from '@/components/common/priority-badge'
import { TypeBadge } from '@/components/common/type-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'

interface SprintTicketRowProps {
  ticket: TicketWithRelations
  projectKey: string
  isDragging?: boolean
  isOverlay?: boolean
}

/**
 * Compact ticket row for sprint planning view.
 * Draggable between sprint sections.
 */
export function SprintTicketRow({
  ticket,
  projectKey,
  isDragging = false,
  isOverlay = false,
}: SprintTicketRowProps) {
  const { setActiveTicketId } = useUIStore()
  const { isSelected, toggleTicket, selectTicket } = useSelectionStore()
  const selected = isSelected(ticket.id)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: 'ticket',
      ticket,
      sprintId: ticket.sprintId,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? 'none' : transition,
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleTicket(ticket.id)
      return
    }
    selectTicket(ticket.id)
    setActiveTicketId(ticket.id)
  }

  const isOverdue = ticket.dueDate && isPast(ticket.dueDate) && !isToday(ticket.dueDate)
  const isDueToday = ticket.dueDate && isToday(ticket.dueDate)
  const commentCount = ticket._count?.comments ?? 0
  const attachmentCount = ticket._count?.attachments ?? 0

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[52px] rounded-lg border-2 border-dashed border-blue-500/40 bg-blue-500/5"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      {...attributes}
      {...listeners}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
        'border border-transparent hover:border-zinc-700/50',
        'bg-zinc-900/40 hover:bg-zinc-800/60',
        'cursor-grab active:cursor-grabbing select-none',
        selected && 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15',
        isOverlay && 'shadow-2xl shadow-black/50 ring-2 ring-blue-500/50 bg-zinc-800',
        isSortableDragging && 'opacity-50',
      )}
    >
      {/* Drag handle indicator */}
      <div
        className={cn(
          'flex-shrink-0 p-1 -ml-1 rounded opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150',
          'text-zinc-500',
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Type icon */}
      <TypeBadge type={ticket.type} size="sm" />

      {/* Ticket key */}
      <span className="flex-shrink-0 font-mono text-xs text-zinc-500 w-16">
        {projectKey}-{ticket.number}
      </span>

      {/* Title */}
      <InlineCodeText
        text={ticket.title}
        className="flex-1 text-sm text-zinc-200 truncate min-w-0"
      />

      {/* Carryover indicator */}
      {ticket.isCarriedOver && (
        <div className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
          <Repeat className="h-3 w-3" />
          {ticket.carriedOverCount > 1 && (
            <span className="text-[10px] font-medium">{ticket.carriedOverCount}</span>
          )}
        </div>
      )}

      {/* Labels (show first 2 max) */}
      {ticket.labels.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1 max-w-[120px]">
          {ticket.labels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="px-1.5 py-0.5 text-[10px] rounded-full truncate max-w-[60px]"
              style={{
                backgroundColor: `${label.color}20`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
          {ticket.labels.length > 2 && (
            <span className="text-[10px] text-zinc-500">+{ticket.labels.length - 2}</span>
          )}
        </div>
      )}

      {/* Story points */}
      {ticket.storyPoints != null && (
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center',
            'w-6 h-6 rounded-full text-xs font-semibold',
            'bg-zinc-800 text-zinc-400 border border-zinc-700',
          )}
        >
          {ticket.storyPoints}
        </div>
      )}

      {/* Due date */}
      {ticket.dueDate && (
        <div
          className={cn(
            'flex-shrink-0 flex items-center gap-1 text-xs',
            isOverdue && 'text-red-400',
            isDueToday && 'text-amber-400',
            !isOverdue && !isDueToday && 'text-zinc-500',
          )}
        >
          <Calendar className="h-3 w-3" />
          <span>{format(ticket.dueDate, 'MMM d')}</span>
        </div>
      )}

      {/* Metadata */}
      <div className="flex-shrink-0 flex items-center gap-2 text-zinc-500">
        {commentCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs">
            <MessageSquare className="h-3 w-3" />
            {commentCount}
          </span>
        )}
        {attachmentCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs">
            <Paperclip className="h-3 w-3" />
            {attachmentCount}
          </span>
        )}
      </div>

      {/* Priority */}
      <PriorityBadge priority={ticket.priority} size="sm" />

      {/* Assignee */}
      <div className="flex-shrink-0 w-7 h-7">
        {ticket.assignee ? (
          <Avatar className="h-7 w-7 ring-2 ring-zinc-800">
            {ticket.assignee.avatar ? (
              <AvatarImage src={ticket.assignee.avatar} alt={ticket.assignee.name} />
            ) : null}
            <AvatarFallback
              className="text-[10px] font-medium text-white"
              style={{
                backgroundColor:
                  ticket.assignee.avatarColor ||
                  getAvatarColor(ticket.assignee.id || ticket.assignee.name),
              }}
            >
              {getInitials(ticket.assignee.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-7 w-7 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
            <span className="text-zinc-600 text-[10px]">?</span>
          </div>
        )}
      </div>
    </div>
  )
}
