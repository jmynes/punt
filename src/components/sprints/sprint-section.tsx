'use client'

import { format } from 'date-fns'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TicketListSection } from '@/components/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useReopenSprint } from '@/hooks/queries/use-sprints'
import { useBudgetAlert } from '@/hooks/use-budget-alert'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { formatDaysRemaining, isCompletedColumn, isSprintExpired } from '@/lib/sprint-utils'
import { sortTickets } from '@/lib/ticket-sort'
import { cn } from '@/lib/utils'
import { useBacklogStore } from '@/stores/backlog-store'
import { useUIStore } from '@/stores/ui-store'
import type {
  ColumnWithTickets,
  SprintStatus,
  SprintWithMetrics,
  TicketWithRelations,
} from '@/types'

interface SprintSectionProps {
  sprint: SprintWithMetrics | null // null = backlog
  tickets: TicketWithRelations[]
  projectKey: string
  projectId: string
  statusColumns: ColumnWithTickets[]
  defaultExpanded?: boolean
  /** Whether the section can be collapsed (default: true). When false, content is always visible and no chevron is shown. */
  collapsible?: boolean
  onCreateTicket?: (sprintId: string | null) => void
  onDelete?: (sprintId: string) => void
  /** Index where drop indicator should appear (null = not a drop target) */
  dropPosition?: number | null
  /** IDs of tickets currently being dragged */
  draggingTicketIds?: string[]
  /** Whether there's an active sprint (used to hide create sprint button) */
  hasActiveSprint?: boolean
  /** Total ticket count before filters (for filtered/total display) */
  totalTicketCount?: number
  /** Total story points before filters (for filtered/total display) */
  totalStoryPoints?: number
  /** Total completed ticket count before filters */
  totalCompletedCount?: number
  /** Total completed story points before filters */
  totalCompletedPoints?: number
  /** Whether to show the section header (default: true). When false, only the table is rendered. */
  showHeader?: boolean
  /** Whether to wrap in a card (rounded border + background). Default: true. Set false for flush layout. */
  showCard?: boolean
}

/**
 * A collapsible sprint section in Jira-style backlog view.
 * Shows sprint header with stats and a list of draggable tickets.
 */
export function SprintSection({
  sprint,
  tickets,
  projectKey,
  projectId,
  statusColumns,
  defaultExpanded = true,
  collapsible = true,
  onCreateTicket,
  onDelete,
  dropPosition = null,
  draggingTicketIds = [],
  hasActiveSprint = false,
  totalTicketCount,
  totalStoryPoints,
  totalCompletedCount,
  totalCompletedPoints,
  showHeader = true,
  showCard = true,
}: SprintSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [isOverSection, setIsOverSection] = useState(false)
  const sectionHeaderRef = useRef<HTMLDivElement>(null)
  const [sectionHeaderHeight, setSectionHeaderHeight] = useState(0)

  useEffect(() => {
    const el = sectionHeaderRef.current
    if (!el) return
    const measure = () => setSectionHeaderHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const { setSprintCreateOpen, openSprintStart, openSprintComplete, openSprintEdit } = useUIStore()
  const { sort, toggleSort, setSort, toggleColumnVisibility } = useBacklogStore()
  const canManageSprints = useHasPermission(projectId, PERMISSIONS.SPRINTS_MANAGE)
  const reopenSprintMutation = useReopenSprint(projectId)

  // Sort tickets locally using the shared sort utility
  const sortedTickets = useMemo(
    () => sortTickets(tickets, sort, statusColumns),
    [tickets, sort, statusColumns],
  )

  const isBacklog = !sprint
  const isPlanning = sprint?.status === 'planning'
  const isActive = sprint?.status === 'active'
  const isCompleted = sprint?.status === 'completed'

  // Monitor budget and trigger fire effect when crossing over-budget threshold
  useBudgetAlert(projectId, sprint)

  const expired =
    isActive && sprint
      ? isSprintExpired({ ...sprint, status: sprint.status as SprintStatus })
      : false

  // Calculate totals (excluding dragging tickets for display counts)
  const visibleTickets = tickets.filter((t) => !draggingTicketIds.includes(t.id))
  const filteredPoints = visibleTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const filteredCount = visibleTickets.length

  // Calculate completion stats (done columns)
  const doneColumnIds = useMemo(
    () => statusColumns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id),
    [statusColumns],
  )
  const completedCount = visibleTickets.filter((t) => doneColumnIds.includes(t.columnId)).length
  const completedPoints = visibleTickets
    .filter((t) => doneColumnIds.includes(t.columnId))
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)

  // Determine if filters are active (total counts provided and differ from filtered)
  const isFiltered =
    totalTicketCount !== undefined &&
    totalStoryPoints !== undefined &&
    (totalTicketCount !== filteredCount || totalStoryPoints !== filteredPoints)

  const droppableId = sprint?.id ?? 'backlog'

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

  const handleReopenSprint = useCallback(() => {
    if (sprint) {
      reopenSprintMutation.mutate(sprint.id)
    }
  }, [sprint, reopenSprintMutation])

  return (
    <div
      style={{ '--section-header-height': `${sectionHeaderHeight}px` } as React.CSSProperties}
      className={cn(
        showCard && 'rounded-xl ring-1 transition-all duration-200',
        showCard && isBacklog && 'ring-zinc-800 bg-zinc-900/30 [--table-header-bg:#1a1a1f]',
        showCard && isPlanning && 'ring-blue-500/20 bg-blue-500/5 [--table-header-bg:#0c0c1a]',
        showCard &&
          isActive &&
          !expired &&
          'ring-emerald-500/30 bg-emerald-500/5 [--table-header-bg:#0c1a14]',
        showCard &&
          isActive &&
          expired &&
          'ring-orange-500/30 bg-orange-500/5 [--table-header-bg:#1a140c]',
        showCard &&
          isCompleted &&
          'ring-zinc-700 bg-zinc-900/20 opacity-75 [--table-header-bg:#161618]',
        // Drop target styling - subtle glow when this section is a valid drop target
        showCard && dropPosition !== null && 'ring-blue-500/40 ring-2',
        // isOver is useful for empty sections (via callback from TicketListSection)
        showCard &&
          isOverSection &&
          filteredCount === 0 &&
          'ring-blue-500/50 bg-blue-500/10 ring-2',
      )}
    >
      {/* Section Header */}
      {showHeader && (
        <div
          ref={sectionHeaderRef}
          onClick={collapsible ? () => setExpanded(!expanded) : undefined}
          className={cn(
            'flex items-center gap-3 px-4 py-3 select-none',
            'rounded-t-xl transition-colors',
            'sticky top-0 z-20',
            collapsible && 'cursor-pointer hover:bg-white/[0.02]',
          )}
          style={{ backgroundColor: 'var(--table-header-bg, rgb(9 9 11))' }}
        >
          {/* Expand/Collapse chevron (only when collapsible) */}
          {collapsible && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
          )}

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
                  isActive && !expired && 'bg-emerald-500/20',
                  isActive && expired && 'bg-orange-500/20',
                  isCompleted && 'bg-zinc-700',
                )}
              >
                <Target
                  className={cn(
                    'h-4 w-4',
                    isPlanning && 'text-blue-400',
                    isActive && !expired && 'text-emerald-400',
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
                  isActive && !expired && 'bg-emerald-500/20 text-emerald-400',
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'hidden sm:flex items-center gap-1.5 text-xs cursor-default',
                    expired ? 'text-orange-400' : 'text-zinc-400',
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDaysRemaining(sprint.endDate)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Ends {format(new Date(sprint.endDate), 'PPP')} at{' '}
                {format(new Date(sprint.endDate), 'p')}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Sprint goal tooltip */}
          {sprint?.goal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden lg:inline text-xs text-zinc-500 truncate max-w-[150px] italic cursor-default">
                  &ldquo;{sprint.goal}&rdquo;
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{sprint.goal}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats */}
          {sprint ? (
            <SprintProgressBars
              completedCount={completedCount}
              totalCount={filteredCount}
              completedPoints={completedPoints}
              totalPoints={filteredPoints}
              unfilteredCompletedCount={totalCompletedCount ?? completedCount}
              unfilteredTotalCount={totalTicketCount ?? filteredCount}
              unfilteredCompletedPoints={totalCompletedPoints ?? completedPoints}
              unfilteredTotalPoints={totalStoryPoints ?? filteredPoints}
              isFiltered={isFiltered}
              budget={sprint.budget}
              sprintStatus={sprint.status as 'planning' | 'active' | 'completed'}
              expired={expired}
            />
          ) : (
            /* Backlog: simple text stats with filtered/total when filters active */
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    filteredCount === 0 ? 'text-zinc-600' : 'text-zinc-300',
                  )}
                >
                  {filteredCount}
                </span>
                {isFiltered && (
                  <>
                    <span className="text-zinc-600">/</span>
                    <span className="tabular-nums text-zinc-500">{totalTicketCount}</span>
                  </>
                )}
                <span className="text-zinc-600">
                  {(isFiltered ? totalTicketCount : filteredCount) === 1 ? 'issue' : 'issues'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="font-medium">{filteredPoints}</span>
                {isFiltered && (
                  <>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-500">{totalStoryPoints}</span>
                  </>
                )}
                <span className="text-zinc-600">pts</span>
              </div>
            </div>
          )}

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
            {canManageSprints && isPlanning && filteredCount > 0 && (
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
            {canManageSprints && isActive && expired && (
              <Button
                size="sm"
                onClick={handleCompleteSprint}
                className="h-7 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium"
              >
                Complete
              </Button>
            )}

            {/* Sprint menu - only show if user can manage sprints */}
            {canManageSprints && !isBacklog && (
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

                  {isCompleted && (
                    <DropdownMenuItem
                      onClick={handleReopenSprint}
                      disabled={reopenSprintMutation.isPending}
                      className="text-zinc-300 focus:bg-zinc-800"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reopen Sprint
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

            {/* Create Sprint button for backlog (only when no active sprint) */}
            {canManageSprints && isBacklog && !hasActiveSprint && (
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
      )}

      {/* Ticket table */}
      {(!collapsible || expanded) && (
        <TicketListSection
          sectionId={sprint?.id ?? 'backlog'}
          sprintId={sprint?.id ?? null}
          projectKey={projectKey}
          projectId={projectId}
          statusColumns={statusColumns}
          tickets={sortedTickets}
          draggingTicketIds={draggingTicketIds}
          dropPosition={dropPosition}
          droppableId={droppableId}
          droppableData={{ type: 'sprint-section', sprintId: sprint?.id ?? null }}
          endDroppableId={`${droppableId}-end`}
          endDroppableData={{ type: 'section-end', sprintId: sprint?.id ?? null }}
          sort={sort}
          onToggleSort={(id) => toggleSort(id as Parameters<typeof toggleSort>[0])}
          onSetSort={setSort}
          enableColumnReorder={true}
          onHideColumn={(id) =>
            toggleColumnVisibility(id as Parameters<typeof toggleColumnVisibility>[0])
          }
          reorderDisabled={sort !== null}
          emptyMessage={
            isBacklog
              ? 'Drag tickets here to remove them from sprints'
              : 'Drag tickets here to add them to this sprint'
          }
          className="pb-3"
          onIsOver={setIsOverSection}
        />
      )}
    </div>
  )
}

/**
 * Progress bars for sprint sections, matching the active sprint header style.
 * Shows layered bars: total completion dimmed behind filtered completion.
 * Budget always reflects total sprint scope (ignores filters).
 */
function SprintProgressBars({
  completedCount,
  totalCount,
  completedPoints,
  totalPoints,
  unfilteredCompletedCount,
  unfilteredTotalCount,
  unfilteredCompletedPoints,
  unfilteredTotalPoints,
  isFiltered,
  budget,
  sprintStatus,
  expired,
}: {
  completedCount: number
  totalCount: number
  completedPoints: number
  totalPoints: number
  unfilteredCompletedCount: number
  unfilteredTotalCount: number
  unfilteredCompletedPoints: number
  unfilteredTotalPoints: number
  isFiltered: boolean
  budget?: number | null
  sprintStatus: 'planning' | 'active' | 'completed'
  expired: boolean
}) {
  // When filtered: show total completion dimmed, filtered completion bright
  // When unfiltered: show completion directly
  const issuePercent =
    unfilteredTotalCount > 0
      ? Math.round((unfilteredCompletedCount / unfilteredTotalCount) * 100)
      : 0
  const filteredIssuePercent =
    isFiltered && unfilteredTotalCount > 0
      ? Math.round((completedCount / unfilteredTotalCount) * 100)
      : null

  const pointsPercent =
    unfilteredTotalPoints > 0
      ? Math.round((unfilteredCompletedPoints / unfilteredTotalPoints) * 100)
      : 0
  const filteredPointsPercent =
    isFiltered && unfilteredTotalPoints > 0
      ? Math.round((completedPoints / unfilteredTotalPoints) * 100)
      : null

  // Match color scheme from the active sprint header:
  // orange for expired, blue for planning, emerald for active/completed
  const colorScheme = expired ? 'orange' : sprintStatus === 'planning' ? 'blue' : 'emerald'
  const barColor = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
  }[colorScheme]
  const barColorDimmed = {
    orange: 'bg-orange-500/30',
    blue: 'bg-blue-500/30',
    emerald: 'bg-emerald-500/30',
  }[colorScheme]
  const filteredTextColor = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
  }[colorScheme]

  return (
    <>
      <div className="hidden sm:flex items-center gap-4 text-xs">
        {/* Issues progress */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-default">
              <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
              <div className="relative h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                {/* Total completion (dimmed when filtered) */}
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    isFiltered ? barColorDimmed : barColor,
                  )}
                  style={{ width: `${issuePercent}%` }}
                />
                {/* Filtered completion overlay */}
                {filteredIssuePercent != null && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                      barColor,
                    )}
                    style={{ width: `${filteredIssuePercent}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-0.5 min-w-[36px]">
                {isFiltered ? (
                  <>
                    <span className={cn('font-bold tabular-nums', filteredTextColor)}>
                      {completedCount}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="tabular-nums text-zinc-500">{totalCount}</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold tabular-nums text-zinc-300">{completedCount}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="tabular-nums text-zinc-500">{totalCount}</span>
                  </>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
            <div className="space-y-1">
              {isFiltered ? (
                <>
                  <p className="text-xs text-zinc-100">
                    Filtered: {completedCount} of {totalCount} issues completed
                  </p>
                  <p className="text-xs text-zinc-400">
                    Sprint total: {unfilteredCompletedCount} of {unfilteredTotalCount} issues
                  </p>
                </>
              ) : (
                <p className="text-xs text-zinc-100">
                  {completedCount} of {totalCount} issues completed
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Points progress */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-default">
              <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
              <div className="relative h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                {/* Total completion (dimmed when filtered) */}
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    isFiltered ? barColorDimmed : barColor,
                  )}
                  style={{ width: `${pointsPercent}%` }}
                />
                {/* Filtered completion overlay */}
                {filteredPointsPercent != null && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                      barColor,
                    )}
                    style={{ width: `${filteredPointsPercent}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-0.5 min-w-[36px]">
                {isFiltered ? (
                  <>
                    <span className={cn('font-bold tabular-nums', filteredTextColor)}>
                      {completedPoints}
                    </span>
                    <span className="text-zinc-600">/</span>
                    <span className="tabular-nums text-zinc-500">{totalPoints}</span>
                    <span className="text-zinc-600 ml-0.5">pts</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold tabular-nums text-zinc-300">{completedPoints}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="tabular-nums text-zinc-500">{totalPoints}</span>
                    <span className="text-zinc-600 ml-0.5">pts</span>
                  </>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
            <div className="space-y-1">
              {isFiltered ? (
                <>
                  <p className="text-xs text-zinc-100">
                    Filtered: {completedPoints} of {totalPoints} story points completed
                  </p>
                  <p className="text-xs text-zinc-400">
                    Sprint total: {unfilteredCompletedPoints} of {unfilteredTotalPoints} points
                  </p>
                </>
              ) : (
                <p className="text-xs text-zinc-100">
                  {completedPoints} of {totalPoints} story points completed
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Budget - always uses unfiltered total points */}
        {budget != null && budget > 0 && (
          <BudgetIndicator totalPoints={unfilteredTotalPoints} budget={budget} />
        )}
      </div>

      {/* Compact stats for small screens */}
      <div className="flex sm:hidden items-center gap-3 text-xs">
        <span className="tabular-nums text-zinc-400">
          {completedCount}/{totalCount} issues
        </span>
        <span className="tabular-nums text-zinc-400">{completedPoints} pts</span>
      </div>
    </>
  )
}

/**
 * Compact budget indicator for sprint section header
 */
function BudgetIndicator({ totalPoints, budget }: { totalPoints: number; budget: number }) {
  const percent = Math.round((totalPoints / budget) * 100)
  const overBudget = totalPoints > budget
  const overAmount = overBudget ? totalPoints - budget : 0

  // Determine status
  let status: 'under' | 'approaching' | 'over' | 'critical' = 'under'
  if (percent > 120) status = 'critical'
  else if (percent > 100) status = 'over'
  else if (percent > 80) status = 'approaching'

  const statusColors = {
    under: 'text-emerald-400',
    approaching: 'text-amber-400',
    over: 'text-orange-400',
    critical: 'text-red-400',
  }

  const StatusIcon = status === 'critical' ? Flame : status === 'over' ? AlertTriangle : null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center gap-1.5', statusColors[status])}>
          {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
          {!StatusIcon && <TrendingUp className="h-3.5 w-3.5" />}
          <span className="font-medium">{totalPoints}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">{budget}</span>
          <span className="text-zinc-600">pts</span>
          {overBudget && (
            <span
              className={cn(
                'px-1 py-0.5 rounded text-[10px] font-bold',
                status === 'critical' ? 'bg-red-500/20' : 'bg-orange-500/20',
              )}
            >
              +{overAmount}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-zinc-100">
        <p className="text-xs">
          {overBudget ? (
            <span className={statusColors[status]}>{overAmount} points over budget</span>
          ) : (
            <span>{budget - totalPoints} points remaining in budget</span>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
