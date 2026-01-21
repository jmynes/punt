'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { format } from 'date-fns'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDaysRemaining, isSprintExpired } from '@/lib/sprint-utils'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { SprintStatus, SprintWithMetrics, TicketWithRelations } from '@/types'
import { SprintTicketRow } from './sprint-ticket-row'

interface SprintSectionProps {
  sprint: SprintWithMetrics | null // null = backlog
  tickets: TicketWithRelations[]
  projectKey: string
  projectId: string
  defaultExpanded?: boolean
  onCreateTicket?: (sprintId: string | null) => void
  onDelete?: (sprintId: string) => void
}

/**
 * A collapsible sprint section in Jira-style backlog view.
 * Shows sprint header with stats and a list of draggable tickets.
 */
export function SprintSection({
  sprint,
  tickets,
  projectKey,
  projectId: _projectId,
  defaultExpanded = true,
  onCreateTicket,
  onDelete,
}: SprintSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { setSprintCreateOpen, openSprintStart, openSprintComplete, openSprintEdit } = useUIStore()

  const isBacklog = !sprint
  const isPlanning = sprint?.status === 'planning'
  const isActive = sprint?.status === 'active'
  const isCompleted = sprint?.status === 'completed'

  const expired =
    isActive && sprint
      ? isSprintExpired({ ...sprint, status: sprint.status as SprintStatus })
      : false

  // Calculate totals
  const totalPoints = tickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const ticketCount = tickets.length

  // Droppable for the section
  const droppableId = sprint?.id ?? 'backlog'
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      type: 'sprint-section',
      sprintId: sprint?.id ?? null,
    },
  })

  // Ticket IDs for sortable context
  const ticketIds = tickets.map((t) => t.id)

  const handleStartSprint = useCallback(() => {
    if (sprint) openSprintStart(sprint.id)
  }, [sprint, openSprintStart])

  const handleCompleteSprint = useCallback(() => {
    if (sprint) openSprintComplete(sprint.id)
  }, [sprint, openSprintComplete])

  const handleEditSprint = useCallback(() => {
    if (sprint) openSprintEdit(sprint.id)
  }, [sprint, openSprintEdit])

  const handleDeleteSprint = useCallback(() => {
    if (sprint && onDelete) {
      onDelete(sprint.id)
    }
  }, [sprint, onDelete])

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        isBacklog && 'border-zinc-800 bg-zinc-900/30',
        isPlanning && 'border-blue-500/20 bg-blue-500/5',
        isActive && !expired && 'border-green-500/30 bg-green-500/5',
        isActive && expired && 'border-orange-500/30 bg-orange-500/5',
        isCompleted && 'border-zinc-700 bg-zinc-900/20 opacity-75',
        isOver && 'border-blue-500/50 bg-blue-500/10 ring-2 ring-blue-500/20',
      )}
    >
      {/* Section Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer select-none',
          'rounded-t-xl transition-colors',
          'hover:bg-white/[0.02]',
        )}
      >
        {/* Expand/Collapse chevron */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>

        {/* Sprint icon and name */}
        <div className="flex items-center gap-2 min-w-0">
          {isBacklog ? (
            <div className="p-1.5 rounded-lg bg-zinc-800">
              <Target className="h-4 w-4 text-zinc-400" />
            </div>
          ) : (
            <div
              className={cn(
                'p-1.5 rounded-lg',
                isPlanning && 'bg-blue-500/20',
                isActive && !expired && 'bg-green-500/20',
                isActive && expired && 'bg-orange-500/20',
                isCompleted && 'bg-zinc-700',
              )}
            >
              <Target
                className={cn(
                  'h-4 w-4',
                  isPlanning && 'text-blue-400',
                  isActive && !expired && 'text-green-400',
                  isActive && expired && 'text-orange-400',
                  isCompleted && 'text-zinc-400',
                )}
              />
            </div>
          )}
          <h3
            className={cn(
              'font-semibold text-sm truncate',
              isBacklog ? 'text-zinc-400' : 'text-zinc-100',
            )}
          >
            {isBacklog ? 'Backlog' : sprint.name}
          </h3>

          {/* Status badge */}
          {!isBacklog && (
            <span
              className={cn(
                'px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wide',
                isPlanning && 'bg-blue-500/20 text-blue-400',
                isActive && !expired && 'bg-green-500/20 text-green-400',
                isActive && expired && 'bg-orange-500/20 text-orange-400',
                isCompleted && 'bg-zinc-700 text-zinc-400',
              )}
            >
              {isActive && expired ? 'Overdue' : sprint.status}
            </span>
          )}
        </div>

        {/* Sprint dates */}
        {sprint?.startDate && sprint.endDate && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              {format(new Date(sprint.startDate), 'MMM d')} -{' '}
              {format(new Date(sprint.endDate), 'MMM d')}
            </span>
          </div>
        )}

        {/* Time remaining for active sprint */}
        {isActive && sprint?.endDate && (
          <div
            className={cn(
              'hidden sm:flex items-center gap-1.5 text-xs',
              expired ? 'text-orange-400' : 'text-zinc-400',
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDaysRemaining(sprint.endDate)}</span>
          </div>
        )}

        {/* Sprint goal tooltip */}
        {sprint?.goal && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden lg:inline text-xs text-zinc-500 truncate max-w-[150px] italic">
                &ldquo;{sprint.goal}&rdquo;
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">{sprint.goal}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs">
          {/* Story points */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="font-medium">{totalPoints}</span>
            <span className="text-zinc-600">pts</span>
          </div>

          {/* Ticket count */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-medium tabular-nums',
                ticketCount === 0 ? 'text-zinc-600' : 'text-zinc-300',
              )}
            >
              {ticketCount}
            </span>
            <span className="text-zinc-600">{ticketCount === 1 ? 'issue' : 'issues'}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Create ticket button */}
          {onCreateTicket && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCreateTicket(sprint?.id ?? null)}
              className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}

          {/* Start Sprint button for planning sprints */}
          {isPlanning && ticketCount > 0 && (
            <Button
              size="sm"
              onClick={handleStartSprint}
              className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-medium"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}

          {/* Complete Sprint button for expired active sprints */}
          {isActive && expired && (
            <Button
              size="sm"
              onClick={handleCompleteSprint}
              className="h-7 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium"
            >
              Complete
            </Button>
          )}

          {/* Sprint menu */}
          {!isBacklog && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-700">
                <DropdownMenuItem
                  onClick={handleEditSprint}
                  className="text-zinc-300 focus:bg-zinc-800"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Sprint
                </DropdownMenuItem>

                {isPlanning && (
                  <DropdownMenuItem
                    onClick={handleStartSprint}
                    className="text-zinc-300 focus:bg-zinc-800"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Sprint
                  </DropdownMenuItem>
                )}

                {isActive && (
                  <DropdownMenuItem
                    onClick={handleCompleteSprint}
                    className="text-zinc-300 focus:bg-zinc-800"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Complete Sprint
                  </DropdownMenuItem>
                )}

                {isPlanning && onDelete && (
                  <>
                    <DropdownMenuSeparator className="bg-zinc-700" />
                    <DropdownMenuItem
                      onClick={handleDeleteSprint}
                      className="text-red-400 focus:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Sprint
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Create Sprint button for backlog */}
          {isBacklog && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSprintCreateOpen(true)}
              className="h-7 px-3 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Sprint
            </Button>
          )}
        </div>
      </div>

      {/* Ticket list */}
      {expanded && (
        <div ref={setNodeRef} className={cn('px-4 pb-3 space-y-1', ticketCount === 0 && 'py-6')}>
          {ticketCount === 0 ? (
            <div className="text-center text-zinc-600 text-sm">
              {isBacklog
                ? 'Drag tickets here to remove them from sprints'
                : 'Drag tickets here to add them to this sprint'}
            </div>
          ) : (
            <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
              {tickets.map((ticket) => (
                <SprintTicketRow key={ticket.id} ticket={ticket} projectKey={projectKey} />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  )
}
