'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, isToday } from 'date-fns'
import { Calendar, GripVertical, MessageSquare, Paperclip, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InlineCodeText } from '@/components/common/inline-code'
import { PriorityBadge } from '@/components/common/priority-badge'
import { ResolutionBadge } from '@/components/common/resolution-badge'
import { TypeBadge } from '@/components/common/type-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn, getAvatarColor, getInitials, getLabelStyles } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { IssueType, Priority, Resolution, TicketWithRelations } from '@/types'
import { TicketContextMenu } from './ticket-context-menu'

interface KanbanCardProps {
  ticket: TicketWithRelations
  projectKey: string
  allTicketIds?: string[]
  isBeingDragged?: boolean
}

export function KanbanCard({
  ticket,
  projectKey,
  allTicketIds = [],
  isBeingDragged = false,
}: KanbanCardProps) {
  const { setActiveTicketId } = useUIStore()
  const { isSelected, selectTicket, toggleTicket, selectRange } = useSelectionStore()
  const selected = isSelected(ticket.id)
  const [isMounted, setIsMounted] = useState(false)

  // Only apply drag-and-drop attributes after mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: {
      type: 'ticket',
      ticket,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    // Disable transitions during drag to prevent visual glitches when items are inserted
    transition: isDragging ? 'none' : transition,
  }

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl/Cmd + click: toggle selection
    if (e.ctrlKey || e.metaKey) {
      toggleTicket(ticket.id)
      return
    }

    // Shift + click: range selection
    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      selectRange(ticket.id, allTicketIds)
      return
    }

    // If this ticket is already selected and part of a multi-selection,
    // don't change selection (allows dragging the group)
    // Only open ticket detail if it's the only one selected
    if (selected && useSelectionStore.getState().selectedTicketIds.size > 1) {
      // Don't change selection, allow drag to proceed
      return
    }

    // Normal click: open ticket detail (and select only this one)
    selectTicket(ticket.id)
    setActiveTicketId(ticket.id)
  }

  const commentCount = ticket._count?.comments ?? 0
  const attachmentCount = ticket._count?.attachments ?? 0
  const isOverdue = ticket.dueDate && isPast(ticket.dueDate) && !isToday(ticket.dueDate)
  const isDueToday = ticket.dueDate && isToday(ticket.dueDate)

  // Hide the card if it's being dragged (for multi-drag support)
  if (isBeingDragged) {
    return null
  }

  return (
    <TicketContextMenu ticket={ticket}>
      <Card
        ref={setNodeRef}
        style={style}
        data-ticket-card
        {...(isMounted ? attributes : {})}
        {...(isMounted ? listeners : {})}
        className={cn(
          'group relative cursor-grab border-zinc-800 bg-zinc-900/80 p-3 transition-colors select-none active:cursor-grabbing',
          !selected && 'hover:border-zinc-700 hover:bg-zinc-900',
          isDragging && 'opacity-50 shadow-lg ring-2 ring-amber-500/50',
          selected &&
            'ring-2 ring-amber-500 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15',
        )}
        onClick={handleClick}
      >
        {/* Drag handle indicator - visible on hover */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <GripVertical className="h-4 w-4 text-zinc-600" />
        </div>

        <div className="pl-4">
          {/* Header row: Type, Key, Priority */}
          <div className="flex items-center gap-2 mb-2">
            <TypeBadge type={ticket.type as IssueType} size="sm" />
            <span className="text-xs font-mono text-zinc-500">
              {projectKey}-{ticket.number}
            </span>
            <div className="ml-auto">
              <PriorityBadge priority={ticket.priority as Priority} size="sm" />
            </div>
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-zinc-200 mb-2 line-clamp-2">
            <InlineCodeText text={ticket.title} />
          </h4>

          {/* Resolution badge (only non-Done resolutions like Won't Fix, Duplicate, etc.) */}
          {ticket.resolution && ticket.resolution !== 'Done' && (
            <div className="mb-2">
              <ResolutionBadge resolution={ticket.resolution as Resolution} size="sm" />
            </div>
          )}

          {/* Labels */}
          {ticket.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {ticket.labels.slice(0, 3).map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={getLabelStyles(label.color)}
                >
                  {label.name}
                </Badge>
              ))}
              {ticket.labels.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500"
                >
                  +{ticket.labels.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Due date if set */}
          {ticket.dueDate && (
            <div
              className={cn(
                'flex items-center gap-1 text-[10px] mb-2',
                isOverdue && 'text-red-400',
                isDueToday && 'text-amber-400',
                !isOverdue && !isDueToday && 'text-zinc-500',
              )}
            >
              <Calendar className="h-3 w-3" />
              <span>{format(ticket.dueDate, 'MMM d')}</span>
              {isOverdue && <span className="font-medium">(Overdue)</span>}
              {isDueToday && <span className="font-medium">(Today)</span>}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
            {/* Left side: Story points and metadata */}
            <div className="flex items-center gap-3">
              {/* Story points */}
              {ticket.storyPoints !== null && ticket.storyPoints !== undefined && (
                <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                  {ticket.storyPoints} SP
                </span>
              )}

              {/* Metadata counts */}
              <div className="flex items-center gap-2 text-zinc-600">
                {attachmentCount > 0 && (
                  <div
                    className="flex items-center gap-0.5"
                    title={`${attachmentCount} attachment(s)`}
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="text-[10px]">{attachmentCount}</span>
                  </div>
                )}
                {commentCount > 0 && (
                  <div className="flex items-center gap-0.5" title={`${commentCount} comment(s)`}>
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-[10px]">{commentCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Assignee (right side) */}
            {ticket.assignee ? (
              <Avatar className="h-5 w-5" title={ticket.assignee.name}>
                <AvatarImage src={ticket.assignee.avatar || undefined} />
                <AvatarFallback
                  className="text-white text-[10px] font-medium"
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
              <Avatar className="h-5 w-5" title="Unassigned">
                <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                  <User className="h-3 w-3 text-zinc-500" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </Card>
    </TicketContextMenu>
  )
}
