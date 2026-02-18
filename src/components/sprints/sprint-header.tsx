'use client'

import { format } from 'date-fns'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDeleteSprint, useProjectSprints } from '@/hooks/queries/use-sprints'
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
  /** Filtered tickets (from board filters). When provided and different from total, shows filtered progress overlay. */
  filteredTickets?: TicketWithRelations[]
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
  filteredTickets,
  className,
}: SprintHeaderProps) {
  const { data: sprints, isLoading } = useProjectSprints(projectId)

  // Find current sprint: prefer active, fall back to planning
  const activeSprint =
    sprints?.find((s) => s.status === 'active') ||
    sprints?.find((s) => s.status === 'planning') ||
    null
  const { setSprintCreateOpen, openSprintComplete, openSprintEdit, openSprintStart } = useUIStore()
  const canManageSprints = useHasPermission(projectId, PERMISSIONS.SPRINTS_MANAGE)
  const deleteSprint = useDeleteSprint(projectId)

  const isPlanning = activeSprint?.status === 'planning'
  const isActive = activeSprint?.status === 'active'

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
  const _progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

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

  // Calculate filtered stats (when board filters are active)
  const hasFilter = filteredTickets !== undefined && filteredTickets.length !== sprintTickets.length
  const filteredSprintTickets = hasFilter
    ? filteredTickets.filter((t) => t.sprintId === activeSprint.id)
    : null
  const filteredCompletedCount = filteredSprintTickets
    ? filteredSprintTickets.filter((t) => doneColumnIds.includes(t.columnId)).length
    : null
  const filteredTotalCount = filteredSprintTickets?.length ?? null
  const filteredCompletedPoints = filteredSprintTickets
    ? filteredSprintTickets
        .filter((t) => doneColumnIds.includes(t.columnId))
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
    : null
  const filteredTotalPoints = filteredSprintTickets
    ? filteredSprintTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
    : null

  // Calculate "velocity" (points per day if we had more data)
  // For now, show estimated remaining work indicator
  const _remainingPoints = totalPoints - completedPoints

  // Color scheme: orange for expired, blue for planning, green for active
  const getColorScheme = () => {
    if (expired) return 'orange'
    if (isPlanning) return 'blue'
    return 'emerald'
  }
  const colorScheme = getColorScheme()

  const colorClasses = {
    orange: {
      gradient: 'from-orange-950/40 via-orange-900/20 to-zinc-900/40 border-orange-500/30',
      radial: 'from-orange-500/20 via-transparent to-transparent',
      icon: 'bg-orange-500/20 border border-orange-500/30',
      iconText: 'text-orange-400',
      pulse: 'bg-orange-500',
      badge: 'bg-orange-500/20 text-orange-400',
      progress: 'stroke-orange-500',
      text: 'text-orange-400',
    },
    blue: {
      gradient: 'from-blue-950/40 via-blue-900/20 to-zinc-900/40 border-blue-500/20',
      radial: 'from-blue-500/20 via-transparent to-transparent',
      icon: 'bg-blue-500/20 border border-blue-500/30',
      iconText: 'text-blue-400',
      pulse: 'bg-blue-500',
      badge: 'bg-blue-500/20 text-blue-400',
      progress: 'stroke-blue-500',
      text: 'text-blue-400',
    },
    emerald: {
      gradient: 'from-emerald-950/40 via-emerald-900/20 to-zinc-900/40 border-emerald-500/20',
      radial: 'from-emerald-500/20 via-transparent to-transparent',
      icon: 'bg-emerald-500/20 border border-emerald-500/30',
      iconText: 'text-emerald-400',
      pulse: 'bg-emerald-500',
      badge: 'bg-emerald-500/20 text-emerald-400',
      progress: 'stroke-emerald-500',
      text: 'text-emerald-400',
    },
  }

  const colors = colorClasses[colorScheme]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-gradient-to-r',
        colors.gradient,
        'border',
        className,
      )}
    >
      {/* Subtle animated gradient background */}
      <div
        className={cn(
          'absolute inset-0 opacity-30',
          'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))]',
          colors.radial,
        )}
      />

      <div className="relative flex items-center justify-between px-5 py-4">
        {/* Left: Sprint info */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Sprint icon with status indicator */}
          <div className="relative">
            <div className={cn('p-2.5 rounded-xl', colors.icon)}>
              <Zap className={cn('h-5 w-5', colors.iconText)} />
            </div>
            {/* Pulse indicator */}
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full animate-pulse',
                colors.pulse,
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
                        colors.badge,
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
                <>
                  <DropdownMenuItem
                    onClick={() => openSprintEdit(activeSprint.id)}
                    className="text-zinc-300 focus:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Sprint
                  </DropdownMenuItem>

                  {isPlanning && (
                    <DropdownMenuItem
                      onClick={() => openSprintStart(activeSprint.id)}
                      className="text-zinc-300 focus:bg-zinc-800"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Sprint
                    </DropdownMenuItem>
                  )}

                  {isActive && (
                    <DropdownMenuItem
                      onClick={() => openSprintComplete(activeSprint.id)}
                      className="text-zinc-300 focus:bg-zinc-800"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete Sprint
                    </DropdownMenuItem>
                  )}

                  {isPlanning && (
                    <>
                      <DropdownMenuSeparator className="bg-zinc-700" />
                      <DropdownMenuItem
                        onClick={() => deleteSprint.mutate(activeSprint.id)}
                        className="text-red-400 focus:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Sprint
                      </DropdownMenuItem>
                    </>
                  )}
                </>
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
          {/* Progress meters (issues, points, budget) */}
          <ProgressMeters
            completedCount={completedCount}
            totalCount={totalCount}
            completedPoints={completedPoints}
            totalPoints={totalPoints}
            colorScheme={colorScheme}
            filteredCompletedCount={filteredCompletedCount}
            filteredTotalCount={filteredTotalCount}
            filteredCompletedPoints={filteredCompletedPoints}
            filteredTotalPoints={filteredTotalPoints}
            budget={activeSprint.budget}
          />

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
 * Dual progress meters showing issues and story points completion.
 * When filtered stats are provided, shows a layered progress bar with
 * the filtered portion highlighted and the overall sprint progress dimmed behind it.
 */
function ProgressMeters({
  completedCount,
  totalCount,
  completedPoints,
  totalPoints,
  colorScheme,
  filteredCompletedCount,
  filteredTotalCount,
  filteredCompletedPoints,
  filteredTotalPoints,
  budget,
}: {
  completedCount: number
  totalCount: number
  completedPoints: number
  totalPoints: number
  colorScheme: 'orange' | 'blue' | 'emerald'
  filteredCompletedCount?: number | null
  filteredTotalCount?: number | null
  filteredCompletedPoints?: number | null
  filteredTotalPoints?: number | null
  budget?: number | null
}) {
  const issuePercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const pointsPercent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0

  const hasFilter = filteredTotalCount != null && filteredTotalCount !== totalCount

  const filteredIssuePercent =
    hasFilter && totalCount > 0
      ? Math.round(((filteredCompletedCount ?? 0) / totalCount) * 100)
      : null
  const filteredPointsPercent =
    hasFilter && totalPoints > 0
      ? Math.round(((filteredCompletedPoints ?? 0) / totalPoints) * 100)
      : null

  const progressColors = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
  }

  const dimmedProgressColors = {
    orange: 'bg-orange-500/30',
    blue: 'bg-blue-500/30',
    emerald: 'bg-emerald-500/30',
  }

  const textColors = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
  }

  const progressColor = progressColors[colorScheme]
  const dimmedColor = dimmedProgressColors[colorScheme]
  const textColor = textColors[colorScheme]

  return (
    <div className="hidden md:flex items-center gap-6">
      {/* Issues progress */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1.5">
            {/* Label row */}
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Issues
              </span>
            </div>

            {/* Progress bar with numbers */}
            <div className="flex items-center gap-4">
              <div className="relative h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                {/* Total completion bar (dimmed when filtered) */}
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    hasFilter ? dimmedColor : progressColor,
                  )}
                  style={{ width: `${issuePercent}%` }}
                />
                {/* Filtered completion overlay */}
                {filteredIssuePercent != null && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                      progressColor,
                    )}
                    style={{ width: `${filteredIssuePercent}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-0.5 text-sm min-w-[52px]">
                {hasFilter ? (
                  <>
                    <span className={cn('font-semibold tabular-nums', textColor)}>
                      {filteredCompletedCount}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500 font-medium tabular-nums">
                      {filteredTotalCount}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={cn('font-semibold tabular-nums', textColor)}>
                      {completedCount}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500 font-medium tabular-nums">{totalCount}</span>
                  </>
                )}
              </div>
            </div>

            {/* Overall stats shown below when filtered */}
            {hasFilter && (
              <div className="flex items-center gap-1 text-xs text-zinc-600">
                <span>Sprint:</span>
                <span className="font-medium tabular-nums">
                  {completedCount}/{totalCount}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
          {hasFilter ? (
            <div className="space-y-1">
              <p className="text-xs text-zinc-100">
                Filtered: {filteredCompletedCount} of {filteredTotalCount} issues completed
              </p>
              <p className="text-xs text-zinc-400">
                Sprint total: {completedCount} of {totalCount} issues ({issuePercent}%)
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-100">
              {completedCount} of {totalCount} issues completed ({issuePercent}%)
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className={cn('w-px bg-zinc-800/60', hasFilter ? 'h-14' : 'h-10')} />

      {/* Story points progress */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1.5">
            {/* Label row */}
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Points
              </span>
            </div>

            {/* Progress bar with numbers */}
            <div className="flex items-center gap-4">
              <div className="relative h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                {/* Total completion bar (dimmed when filtered) */}
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    hasFilter ? dimmedColor : progressColor,
                  )}
                  style={{ width: `${pointsPercent}%` }}
                />
                {/* Filtered completion overlay */}
                {filteredPointsPercent != null && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                      progressColor,
                    )}
                    style={{ width: `${filteredPointsPercent}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-0.5 text-sm min-w-[52px]">
                {hasFilter ? (
                  <>
                    <span className={cn('font-semibold tabular-nums', textColor)}>
                      {filteredCompletedPoints}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500 font-medium tabular-nums">
                      {filteredTotalPoints}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={cn('font-semibold tabular-nums', textColor)}>
                      {completedPoints}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500 font-medium tabular-nums">{totalPoints}</span>
                  </>
                )}
              </div>
            </div>

            {/* Overall stats shown below when filtered */}
            {hasFilter && (
              <div className="flex items-center gap-1 text-xs text-zinc-600">
                <span>Sprint:</span>
                <span className="font-medium tabular-nums">
                  {completedPoints}/{totalPoints}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
          {hasFilter ? (
            <div className="space-y-1">
              <p className="text-xs text-zinc-100">
                Filtered: {filteredCompletedPoints} of {filteredTotalPoints} story points completed
              </p>
              <p className="text-xs text-zinc-400">
                Sprint total: {completedPoints} of {totalPoints} points ({pointsPercent}%)
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-100">
              {completedPoints} of {totalPoints} story points completed ({pointsPercent}%)
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Budget meter - only shown when budget is set */}
      {budget != null && budget > 0 && (
        <>
          {/* Divider */}
          <div className={cn('w-px bg-zinc-800/60', hasFilter ? 'h-14' : 'h-10')} />

          {/* Budget progress */}
          <BudgetMeter totalPoints={totalPoints} budget={budget} />
        </>
      )}
    </div>
  )
}

/**
 * Budget meter matching the visual style of issues/points progress meters.
 * Always reflects total sprint scope (ignores active filters).
 */
function BudgetMeter({ totalPoints, budget }: { totalPoints: number; budget: number }) {
  const { status, percent } = getBudgetStatus(totalPoints, budget)
  const overBudget = totalPoints > budget
  const overAmount = overBudget ? totalPoints - budget : 0
  const budgetPercent = Math.min(percent, 100)

  // Color based on budget status
  const budgetColors = {
    under: { bar: 'bg-emerald-500', text: 'text-emerald-400', icon: 'text-zinc-500' },
    approaching: { bar: 'bg-amber-500', text: 'text-amber-400', icon: 'text-amber-500' },
    over: { bar: 'bg-orange-500', text: 'text-orange-400', icon: 'text-orange-500' },
    critical: { bar: 'bg-red-500', text: 'text-red-400', icon: 'text-red-500' },
    none: { bar: 'bg-zinc-500', text: 'text-zinc-400', icon: 'text-zinc-500' },
  }

  const colors = budgetColors[status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col gap-1.5">
          {/* Label row */}
          <div className="flex items-center gap-1.5">
            <Target className={cn('h-3.5 w-3.5', colors.icon)} />
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Budget
            </span>
          </div>

          {/* Progress bar with numbers */}
          <div className="flex items-center gap-4">
            <div className="relative h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                  colors.bar,
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-0.5 text-sm min-w-[52px]">
              <span className={cn('font-semibold tabular-nums', colors.text)}>{totalPoints}</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-500 font-medium tabular-nums">{budget}</span>
              <span className="text-zinc-600 text-xs ml-0.5">pts</span>
            </div>
          </div>

          {/* Over budget indicator */}
          {overBudget && (
            <div className={cn('flex items-center gap-1 text-[10px] font-medium', colors.text)}>
              <AlertTriangle className="h-3 w-3" />
              <span>+{overAmount} over</span>
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-100">
        <div className="space-y-1">
          <p className="font-medium">
            {overBudget ? (
              <span className={colors.text}>{overAmount} points over budget</span>
            ) : (
              <span>{budget - totalPoints} points remaining in budget</span>
            )}
          </p>
          <p className="text-xs text-zinc-400">
            {totalPoints} committed of {budget} budgeted ({percent}%)
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
