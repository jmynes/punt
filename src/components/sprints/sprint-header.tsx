'use client'

import { format } from 'date-fns'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Plus,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActiveSprint } from '@/hooks/queries/use-sprints'
import {
  formatDaysRemaining,
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
 * Jira-style sprint header with progress visualization.
 * Shows active sprint info, burndown progress, and quick actions.
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
    return <div className={cn('h-16 bg-zinc-900/50 rounded-xl animate-pulse', className)} />
  }

  // No active sprint
  if (!activeSprint) {
    return (
      <div
        className={cn(
          'flex items-center justify-between px-5 py-4 rounded-xl',
          'bg-gradient-to-r from-zinc-900/80 to-zinc-900/40',
          'border border-zinc-800/50',
          className,
        )}
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50">
            <Target className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400">No active sprint</p>
            <p className="text-xs text-zinc-600">Start a sprint to track your progress</p>
          </div>
        </div>
        <Button
          onClick={() => setSprintCreateOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
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

  // Calculate story points
  const totalPoints = sprintTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const completedPoints = sprintTickets
    .filter((t) => doneColumnIds.includes(t.columnId))
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)

  const expired = isSprintExpired({
    ...activeSprint,
    status: activeSprint.status as 'active' | 'planning' | 'completed',
  })
  const daysText = formatDaysRemaining(activeSprint.endDate)

  // Calculate "velocity" (points per day if we had more data)
  // For now, show estimated remaining work indicator
  const remainingPoints = totalPoints - completedPoints

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-gradient-to-r',
        expired
          ? 'from-orange-950/40 via-orange-900/20 to-zinc-900/40 border-orange-500/30'
          : 'from-emerald-950/40 via-emerald-900/20 to-zinc-900/40 border-emerald-500/20',
        'border',
        className,
      )}
    >
      {/* Subtle animated gradient background */}
      <div
        className={cn(
          'absolute inset-0 opacity-30',
          'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))]',
          expired
            ? 'from-orange-500/20 via-transparent to-transparent'
            : 'from-emerald-500/20 via-transparent to-transparent',
        )}
      />

      <div className="relative flex items-center justify-between px-5 py-4">
        {/* Left: Sprint info */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Sprint icon with status indicator */}
          <div className="relative">
            <div
              className={cn(
                'p-2.5 rounded-xl',
                expired
                  ? 'bg-orange-500/20 border border-orange-500/30'
                  : 'bg-emerald-500/20 border border-emerald-500/30',
              )}
            >
              <Zap className={cn('h-5 w-5', expired ? 'text-orange-400' : 'text-emerald-400')} />
            </div>
            {/* Pulse indicator for active */}
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full',
                expired ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500 animate-pulse',
              )}
            />
          </div>

          {/* Sprint name and dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"
              >
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-100 truncate">{activeSprint.name}</h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider',
                        expired
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-emerald-500/20 text-emerald-400',
                      )}
                    >
                      {expired ? 'Overdue' : getSprintStatusLabel(activeSprint.status)}
                    </span>
                  </div>
                  {activeSprint.goal && (
                    <p className="text-xs text-zinc-500 truncate max-w-[200px]">
                      {activeSprint.goal}
                    </p>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-zinc-900 border-zinc-700">
              <DropdownMenuItem
                onClick={() => openSprintComplete(activeSprint.id)}
                className="text-zinc-300 focus:bg-zinc-800"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Sprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date range */}
          {activeSprint.startDate && activeSprint.endDate && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {format(new Date(activeSprint.startDate), 'MMM d')} -{' '}
                {format(new Date(activeSprint.endDate), 'MMM d')}
              </span>
            </div>
          )}

          {/* Time remaining */}
          <div
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              expired ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-400',
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{daysText}</span>
          </div>
        </div>

        {/* Right: Progress and stats */}
        <div className="flex items-center gap-6">
          {/* Story points summary */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden lg:flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <TrendingUp className="h-3 w-3" />
                    Story Points
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-emerald-400">{completedPoints}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-sm text-zinc-400">{totalPoints}</span>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {completedPoints} of {totalPoints} story points completed
                {remainingPoints > 0 && ` (${remainingPoints} remaining)`}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Progress visualization */}
          <div className="flex items-center gap-4">
            {/* Circular progress */}
            <div className="relative">
              <svg className="w-12 h-12 -rotate-90" aria-label="Sprint progress" role="img">
                {/* Background circle */}
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  className="stroke-zinc-800"
                  strokeWidth="4"
                />
                {/* Progress circle */}
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  className={cn(
                    'transition-all duration-500',
                    expired ? 'stroke-orange-500' : 'stroke-emerald-500',
                  )}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercent * 1.256} 125.6`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={cn(
                    'text-xs font-bold',
                    expired ? 'text-orange-400' : 'text-emerald-400',
                  )}
                >
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Ticket count */}
            <div className="text-right">
              <div className="text-xs text-zinc-500">Issues</div>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'text-lg font-bold',
                    expired ? 'text-orange-400' : 'text-emerald-400',
                  )}
                >
                  {completedCount}
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-sm text-zinc-400">{totalCount}</span>
              </div>
            </div>
          </div>

          {/* Complete button when expired */}
          {expired && (
            <Button
              onClick={() => openSprintComplete(activeSprint.id)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
