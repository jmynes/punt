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
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useBudgetAlert } from '@/hooks/use-budget-alert'
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

  // Monitor budget and trigger fire effect when crossing over-budget threshold
  useBudgetAlert(projectId, activeSprint)

  // Detect when desktop row overflows — date should move above meters
  const rowRef = useRef<HTMLDivElement>(null)
  const [dateAboveMeters, setDateAboveMeters] = useState(false)
  const dateAboveRef = useRef(false) // mirror of state, readable without re-renders
  const dateRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<HTMLDivElement>(null)

  const metersRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<number | null>(null)
  // Cache the content widths from side-by-side layout for restore calculation
  const cachedIdentityWidthRef = useRef(0)
  const cachedMetersWidthRef = useRef(0)
  const checkOverflow = useCallback(() => {
    if (pendingRef.current) cancelAnimationFrame(pendingRef.current)
    pendingRef.current = requestAnimationFrame(() => {
      const rowEl = rowRef.current
      const dateEl = dateRef.current
      const metersEl = metersRef.current
      if (!rowEl || !dateEl || !metersEl) return
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches
      if (!isDesktop) {
        if (dateAboveRef.current) {
          dateAboveRef.current = false
          setDateAboveMeters(false)
        }
        return
      }

      let shouldStack: boolean
      if (dateAboveRef.current) {
        // Currently stacked (flex-col). Identity stretches to full width, so we
        // use cached content widths from the last side-by-side layout. Restore
        // only when the container can fit both + 32px buffer.
        const containerWidth = rowEl.clientWidth
        const needed =
          (cachedIdentityWidthRef.current || 400) + (cachedMetersWidthRef.current || 300)
        shouldStack = containerWidth < needed + 32
      } else {
        // Currently side-by-side (flex-row). Cache content widths and measure gap.
        cachedIdentityWidthRef.current = identityRef.current?.getBoundingClientRect().width ?? 0
        cachedMetersWidthRef.current = metersEl.getBoundingClientRect().width
        const gap = metersEl.getBoundingClientRect().left - dateEl.getBoundingClientRect().right
        shouldStack = gap < 16
      }

      if (shouldStack !== dateAboveRef.current) {
        dateAboveRef.current = shouldStack
        setDateAboveMeters(shouldStack)
      }
    })
  }, []) // no dependencies — reads refs only

  useEffect(() => {
    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    if (rowRef.current) observer.observe(rowRef.current)
    if (metersRef.current) observer.observe(metersRef.current)
    return () => observer.disconnect()
  }, [checkOverflow])

  if (isLoading) {
    return <div className={cn('h-16 bg-zinc-900/50 rounded-xl animate-pulse', className)} />
  }

  // No active sprint
  if (!activeSprint) {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 md:px-5 md:py-4 rounded-xl',
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

      {/*
        Layout tiers:
        - Mobile (<sm):     Stack: [icon+name] / [meters]
        - Tablet (sm-lg):   [icon+name ... date+time] / [meters]
        - Desktop (lg+):    [icon+name date+time .... meters+complete]  (one row)
        - Desktop narrow:   Detection-based stack when meters crowd the date:
                            [icon+name .............. date+time]
                            [........................... meters]
        Meters NEVER wrap individually — always one non-breaking row.
      */}
      <div className="relative px-4 py-3 md:px-5 md:py-4">
        <div
          ref={rowRef}
          className={cn(
            'flex flex-col gap-3',
            !dateAboveMeters && 'lg:flex-row lg:items-center lg:justify-between',
          )}
        >
          {/* Sprint identity — icon + name, with date inline below lg and when reflowed */}
          <div
            ref={identityRef}
            className={cn(
              'flex items-center justify-between gap-2 md:gap-4 min-w-0',
              !dateAboveMeters && 'lg:justify-start',
            )}
          >
            {/* Icon + name grouped — never separate */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className={cn('p-2.5 rounded-xl', colors.icon)}>
                  <Zap className={cn('h-5 w-5', colors.iconText)} />
                </div>
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full animate-pulse',
                    colors.pulse,
                  )}
                />
              </div>

              {/* Name dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded-lg transition-colors shrink-0"
                  >
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-100 whitespace-nowrap">
                          {activeSprint.name}
                        </h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider whitespace-nowrap',
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
            </div>
            {/* Date + time — always inline with title (hidden on xs only) */}
            <div ref={dateRef} className="hidden sm:flex items-center gap-2 shrink-0">
              {activeSprint.startDate && activeSprint.endDate && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 whitespace-nowrap">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {format(new Date(activeSprint.startDate), 'MMM d')} -{' '}
                    {format(new Date(activeSprint.endDate), 'MMM d')}
                  </span>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-default whitespace-nowrap',
                      expired ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-400',
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{daysText}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {activeSprint.endDate
                    ? `Ends ${format(new Date(activeSprint.endDate), 'PPP')} at ${format(new Date(activeSprint.endDate), 'p')}`
                    : 'No end date set'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Meters + complete button */}
          <div
            ref={metersRef}
            className={cn('flex flex-col items-end gap-3', dateAboveMeters && 'self-end')}
          >
            {/* Meters row */}
            <div className="flex flex-nowrap items-center justify-end">
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

              {expired && canManageSprints && (
                <Button
                  onClick={() => openSprintComplete(activeSprint.id)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium whitespace-nowrap ml-4"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
            </div>
          </div>
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
    <>
      {/* Issues + Points grouped — never separate */}
      <div className="flex items-center shrink-0">
        {/* Issues progress */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col gap-px">
              {/* Label row */}
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Issues
                </span>
              </div>

              {/* Progress bar with numbers */}
              <div className="flex items-center gap-3">
                <div className="relative h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden shrink-0">
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
                <div className="flex items-center gap-0.5 text-sm">
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

        {/* Divider — symmetric px-4 so it's visually centered between meters */}
        <div className="px-4">
          <div className={cn('w-px bg-zinc-700/50', hasFilter ? 'h-12' : 'h-8')} />
        </div>

        {/* Story points progress */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col gap-px">
              {/* Label row */}
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Points
                </span>
              </div>

              {/* Progress bar with numbers */}
              <div className="flex items-center gap-3">
                <div className="relative h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden shrink-0">
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
                <div className="flex items-center gap-0.5 text-sm">
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
                  Filtered: {filteredCompletedPoints} of {filteredTotalPoints} story points
                  completed
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
      </div>

      {/* Budget meter — separate flex item so it can wrap to its own line */}
      {budget != null && budget > 0 && (
        <div className="flex items-center shrink-0">
          <div className="px-4">
            <div className={cn('w-px bg-zinc-700/50', hasFilter ? 'h-12' : 'h-8')} />
          </div>
          <BudgetMeter totalPoints={totalPoints} budget={budget} />
        </div>
      )}
    </>
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
        <div className="flex flex-col gap-px">
          {/* Label row */}
          <div className="flex items-center gap-1.5">
            <Target className={cn('h-3.5 w-3.5', colors.icon)} />
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Budget
            </span>
          </div>

          {/* Progress bar with numbers */}
          <div className="flex items-center gap-3">
            <div className="relative h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden shrink-0">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                  colors.bar,
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-0.5 text-sm">
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
