'use client'

import { format } from 'date-fns'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
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
import { useProjectSprints } from '@/hooks/queries/use-sprints'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  formatDaysRemaining,
  getSprintStatusLabel,
  isCompletedColumn,
  isSprintExpired,
} from '@/lib/sprint-utils'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

/**
 * Get budget status info for visual styling
 */
function getBudgetStatus(totalPoints: number, budget: number | null | undefined) {
  if (!budget || budget <= 0) return { status: 'none' as const, percent: 0 }

  const percent = Math.round((totalPoints / budget) * 100)

  if (percent <= 80) return { status: 'under' as const, percent }
  if (percent <= 100) return { status: 'approaching' as const, percent }
  if (percent <= 120) return { status: 'over' as const, percent }
  return { status: 'critical' as const, percent }
}

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
  const { data: sprints, isLoading } = useProjectSprints(projectId)

  // Find current sprint: prefer active, fall back to planning
  const activeSprint =
    sprints?.find((s) => s.status === 'active') ||
    sprints?.find((s) => s.status === 'planning') ||
    null
  const { setSprintCreateOpen, openSprintComplete } = useUIStore()
  const canManageSprints = useHasPermission(projectId, PERMISSIONS.SPRINTS_MANAGE)

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
        {canManageSprints && (
          <Button
            onClick={() => setSprintCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Sprint
          </Button>
        )}
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
              {canManageSprints && (
                <DropdownMenuItem
                  onClick={() => openSprintComplete(activeSprint.id)}
                  className="text-zinc-300 focus:bg-zinc-800"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Sprint
                </DropdownMenuItem>
              )}
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
          {/* Budget tracker - only show if budget is set */}
          {activeSprint.budget && (
            <BudgetTracker
              totalPoints={totalPoints}
              completedPoints={completedPoints}
              budget={activeSprint.budget}
            />
          )}

          {/* Story points summary - show simplified if no budget */}
          {!activeSprint.budget && (
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
          )}

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
          {expired && canManageSprints && (
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

/**
 * Budget tracker component with visual indicators for over-budget status
 */
function BudgetTracker({
  totalPoints,
  completedPoints,
  budget,
}: {
  totalPoints: number
  completedPoints: number
  budget: number
}) {
  const { status, percent } = getBudgetStatus(totalPoints, budget)
  const overBudget = totalPoints > budget
  const overAmount = overBudget ? totalPoints - budget : 0

  // Status-based styling
  const statusConfig = {
    under: {
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: null,
      label: 'On track',
    },
    approaching: {
      barColor: 'bg-amber-500',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      icon: null,
      label: 'Near capacity',
    },
    over: {
      barColor: 'bg-orange-500',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      icon: AlertTriangle,
      label: 'Over budget',
    },
    critical: {
      barColor: 'bg-red-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      icon: Flame,
      label: 'Way over',
    },
    none: {
      barColor: 'bg-zinc-500',
      textColor: 'text-zinc-400',
      bgColor: 'bg-zinc-500/10',
      borderColor: 'border-zinc-500/30',
      icon: null,
      label: '',
    },
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  // Calculate bar widths
  const committedWidth = Math.min(percent, 100)
  const overflowWidth = percent > 100 ? Math.min(percent - 100, 50) : 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'hidden lg:flex items-center gap-3 px-3 py-2 rounded-lg border transition-all',
            config.bgColor,
            config.borderColor,
            overBudget && 'animate-pulse-subtle',
          )}
        >
          {/* Status icon for over budget */}
          {StatusIcon && (
            <StatusIcon
              className={cn(
                'h-4 w-4 flex-shrink-0',
                config.textColor,
                status === 'critical' && 'animate-bounce',
              )}
            />
          )}

          {/* Budget bar visualization */}
          <div className="flex flex-col gap-1 min-w-[100px]">
            <div className="flex items-center justify-between text-[10px] font-medium">
              <span className={cn(config.textColor, 'uppercase tracking-wider')}>Budget</span>
              <span className={cn(config.textColor)}>
                {totalPoints}/{budget} SP
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-visible">
              {/* Committed portion (up to 100%) */}
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                  config.barColor,
                )}
                style={{ width: `${committedWidth}%` }}
              />

              {/* Overflow indicator (beyond 100%) */}
              {overBudget && (
                <div
                  className={cn(
                    'absolute inset-y-0 rounded-r-full transition-all duration-500',
                    status === 'critical' ? 'bg-red-500' : 'bg-orange-500',
                  )}
                  style={{
                    left: '100%',
                    width: `${overflowWidth}%`,
                  }}
                />
              )}

              {/* Budget line marker at 100% */}
              <div
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full',
                  overBudget ? 'bg-zinc-400' : 'bg-zinc-600',
                )}
                style={{ left: '100%' }}
              />
            </div>
          </div>

          {/* Over budget badge */}
          {overBudget && (
            <div
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                status === 'critical'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-orange-500/20 text-orange-400',
              )}
            >
              +{overAmount}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-100">
        <div className="space-y-1">
          <p className="font-medium">
            {overBudget ? (
              <span className={config.textColor}>{overAmount} points over budget</span>
            ) : (
              <span>{budget - totalPoints} points remaining in budget</span>
            )}
          </p>
          <p className="text-xs text-zinc-400">
            {completedPoints} completed / {totalPoints} committed / {budget} budgeted
          </p>
          {overBudget && (
            <p className="text-xs text-zinc-500">
              Consider moving lower-priority items to backlog or increasing the budget
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
