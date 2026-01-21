'use client'

import { CalendarDays, ChevronDown, Clock, Play, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActiveSprint } from '@/hooks/queries/use-sprints'
import {
  formatDaysRemaining,
  getSprintStatusColor,
  getSprintStatusLabel,
  isCompletedColumn,
  isSprintExpired,
} from '@/lib/sprint-utils'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

interface SprintHeaderProps {
  projectId: string
  tickets?: TicketWithRelations[]
  columns?: ColumnWithTickets[]
  className?: string
}

/**
 * Header bar showing the current active sprint's info and progress.
 * Displays sprint name, days remaining, and progress bar.
 */
export function SprintHeader({
  projectId,
  tickets = [],
  columns = [],
  className,
}: SprintHeaderProps) {
  const { data: activeSprint, isLoading } = useActiveSprint(projectId)
  const { setSprintCreateOpen, openSprintComplete } = useUIStore()

  if (isLoading) {
    return <div className={cn('h-10 bg-zinc-900/50 rounded-lg animate-pulse', className)} />
  }

  // No active sprint
  if (!activeSprint) {
    return (
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 rounded-lg',
          'bg-zinc-900/50 border border-zinc-800',
          className,
        )}
      >
        <span className="text-sm text-zinc-500">No active sprint</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSprintCreateOpen(true)}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <Play className="h-3 w-3 mr-1" />
          Create Sprint
        </Button>
      </div>
    )
  }

  // Calculate progress based on completed columns
  const doneColumnIds = columns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id)

  const sprintTickets = tickets.filter((t) => t.sprintId === activeSprint.id)
  const completedCount = sprintTickets.filter((t) => doneColumnIds.includes(t.columnId)).length
  const totalCount = sprintTickets.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const expired = isSprintExpired({
    ...activeSprint,
    status: activeSprint.status as 'active' | 'planning' | 'completed',
  })
  const daysText = formatDaysRemaining(activeSprint.endDate)

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 rounded-lg',
        'bg-zinc-900/50 border border-zinc-800',
        expired && 'border-orange-500/30 bg-orange-500/5',
        className,
      )}
    >
      {/* Sprint info */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-zinc-100 hover:bg-zinc-800 gap-1.5">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="font-medium">{activeSprint.name}</span>
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-zinc-900 border-zinc-700">
            <DropdownMenuItem
              onClick={() => openSprintComplete(activeSprint.id)}
              className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
            >
              Complete Sprint
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-700" />
            <DropdownMenuItem
              onClick={() => setSprintCreateOpen(true)}
              className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
            >
              Create New Sprint
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sprint goal tooltip */}
        {activeSprint.goal && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-zinc-500 truncate max-w-[200px] hidden sm:inline">
                &ldquo;{activeSprint.goal}&rdquo;
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{activeSprint.goal}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Status badge */}
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            getSprintStatusColor(activeSprint.status),
          )}
        >
          {getSprintStatusLabel(activeSprint.status)}
        </span>
      </div>

      {/* Progress and time */}
      <div className="flex items-center gap-4">
        {/* Days remaining */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-sm',
            expired ? 'text-orange-400' : 'text-zinc-400',
          )}
        >
          {expired ? <Clock className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          <span>{daysText}</span>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 w-16">
            {completedCount}/{totalCount} done
          </span>
        </div>

        {/* Complete button if expired */}
        {expired && (
          <Button
            size="sm"
            onClick={() => openSprintComplete(activeSprint.id)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Complete
          </Button>
        )}
      </div>
    </div>
  )
}
