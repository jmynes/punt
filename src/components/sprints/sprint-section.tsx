'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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
import {
  type BacklogColumnId,
  type SortConfig,
  type SortDirection,
  useBacklogStore,
} from '@/stores/backlog-store'
import { useUIStore } from '@/stores/ui-store'
import type {
  ColumnWithTickets,
  SprintStatus,
  SprintWithMetrics,
  TicketWithRelations,
} from '@/types'
import { DropIndicator, DropZone } from './drop-indicator'
import { SprintTableRow } from './sprint-table-row'

interface SprintSectionProps {
  sprint: SprintWithMetrics | null // null = backlog
  tickets: TicketWithRelations[]
  projectKey: string
  projectId: string
  statusColumns: ColumnWithTickets[]
  defaultExpanded?: boolean
  onCreateTicket?: (sprintId: string | null) => void
  onDelete?: (sprintId: string) => void
  /** Index where drop indicator should appear (null = not a drop target) */
  dropPosition?: number | null
  /** IDs of tickets currently being dragged */
  draggingTicketIds?: string[]
  /** Whether there's an active sprint (used to hide create sprint button) */
  hasActiveSprint?: boolean
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
  statusColumns,
  defaultExpanded = true,
  onCreateTicket,
  onDelete,
  dropPosition = null,
  draggingTicketIds = [],
  hasActiveSprint = false,
}: SprintSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { setSprintCreateOpen, openSprintStart, openSprintComplete, openSprintEdit } = useUIStore()
  const { columns } = useBacklogStore()
  const visibleColumns = columns.filter((c) => c.visible)

  // Local sort state for this section only
  const [sort, setSort] = useState<SortConfig | null>(null)

  const handleToggleSort = useCallback(
    (columnId: BacklogColumnId) => {
      const column = columns.find((c) => c.id === columnId)
      if (!column?.sortable) return

      setSort((prev) => {
        if (prev?.column === columnId) {
          // Toggle direction or clear
          if (prev.direction === 'asc') {
            return { column: columnId, direction: 'desc' as SortDirection }
          }
          return null
        }
        return { column: columnId, direction: 'asc' as SortDirection }
      })
    },
    [columns],
  )

  // Get status name helper
  const getStatusName = useCallback(
    (columnId: string) => {
      const col = statusColumns.find((c) => c.id === columnId)
      return col?.name || 'Unknown'
    },
    [statusColumns],
  )

  // Sort tickets locally
  const sortedTickets = useMemo(() => {
    if (!sort) return tickets

    const sorted = [...tickets]
    sorted.sort((a, b) => {
      let aVal: string | number | Date | null = null
      let bVal: string | number | Date | null = null

      switch (sort.column) {
        case 'key':
          aVal = a.number
          bVal = b.number
          break
        case 'title':
          aVal = a.title.toLowerCase()
          bVal = b.title.toLowerCase()
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'status':
          aVal = getStatusName(a.columnId).toLowerCase()
          bVal = getStatusName(b.columnId).toLowerCase()
          break
        case 'priority': {
          const priorityOrder = ['critical', 'highest', 'high', 'medium', 'low', 'lowest']
          aVal = priorityOrder.indexOf(a.priority)
          bVal = priorityOrder.indexOf(b.priority)
          break
        }
        case 'assignee':
          aVal = a.assignee?.name.toLowerCase() || 'zzz'
          bVal = b.assignee?.name.toLowerCase() || 'zzz'
          break
        case 'reporter':
          aVal = a.creator.name.toLowerCase()
          bVal = b.creator.name.toLowerCase()
          break
        case 'sprint':
          aVal = a.sprint?.name.toLowerCase() || 'zzz'
          bVal = b.sprint?.name.toLowerCase() || 'zzz'
          break
        case 'storyPoints':
          aVal = a.storyPoints ?? -1
          bVal = b.storyPoints ?? -1
          break
        case 'estimate':
          aVal = a.estimate || ''
          bVal = b.estimate || ''
          break
        case 'dueDate':
          aVal = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
          bVal = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
          break
        case 'created':
          aVal = a.createdAt.getTime()
          bVal = b.createdAt.getTime()
          break
        case 'updated':
          aVal = a.updatedAt.getTime()
          bVal = b.updatedAt.getTime()
          break
        case 'parent':
          aVal = a.parentId || 'zzz'
          bVal = b.parentId || 'zzz'
          break
        case 'labels':
          aVal = a.labels
            .map((l) => l.name)
            .join(',')
            .toLowerCase()
          bVal = b.labels
            .map((l) => l.name)
            .join(',')
            .toLowerCase()
          break
      }

      if (aVal === null || bVal === null) return 0
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [tickets, sort, getStatusName])

  const isBacklog = !sprint
  const isPlanning = sprint?.status === 'planning'
  const isActive = sprint?.status === 'active'
  const isCompleted = sprint?.status === 'completed'

  const expired =
    isActive && sprint
      ? isSprintExpired({ ...sprint, status: sprint.status as SprintStatus })
      : false

  // Calculate totals (excluding dragging tickets for display counts)
  const visibleTickets = tickets.filter((t) => !draggingTicketIds.includes(t.id))
  const totalPoints = visibleTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
  const ticketCount = visibleTickets.length
  const draggingCount = draggingTicketIds.length

  // Droppable for the section
  const droppableId = sprint?.id ?? 'backlog'
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      type: 'sprint-section',
      sprintId: sprint?.id ?? null,
    },
  })

  // Ticket IDs for sortable context - use sorted order
  const ticketIds = sortedTickets.map((t) => t.id)

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
        // Drop target styling - subtle glow when this section is a valid drop target
        dropPosition !== null && 'border-blue-500/40 ring-1 ring-blue-500/20',
        // isOver is still useful for empty sections
        isOver && ticketCount === 0 && 'border-blue-500/50 bg-blue-500/10 ring-2 ring-blue-500/20',
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
          {/* Story points with budget */}
          {sprint?.budget ? (
            <BudgetIndicator totalPoints={totalPoints} budget={sprint.budget} />
          ) : (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-medium">{totalPoints}</span>
              <span className="text-zinc-600">pts</span>
            </div>
          )}

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

          {/* Create Sprint button for backlog (only when no active sprint) */}
          {isBacklog && !hasActiveSprint && (
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

      {/* Ticket table */}
      {expanded && (
        <div ref={setNodeRef} className={cn('pb-3', ticketCount === 0 && 'px-4 py-3')}>
          {ticketCount === 0 ? (
            <DropZone
              isActive={dropPosition !== null || isOver}
              itemCount={draggingCount}
              message={
                isBacklog
                  ? 'Drag tickets here to remove them from sprints'
                  : 'Drag tickets here to add them to this sprint'
              }
            />
          ) : (
            <div className="relative">
              <table className="w-full border-collapse">
                <thead className="text-left text-xs text-zinc-500 uppercase tracking-wider">
                  <tr className="border-b border-zinc-800/50">
                    <th className="w-8" />
                    {visibleColumns.map((column) => {
                      const isSorted = sort?.column === column.id
                      return (
                        <th
                          key={column.id}
                          style={{
                            width: column.width || undefined,
                            minWidth: column.minWidth,
                          }}
                          className={cn(
                            'px-3 py-2 select-none whitespace-nowrap',
                            column.sortable && 'cursor-pointer hover:text-zinc-200',
                          )}
                          onClick={column.sortable ? () => handleToggleSort(column.id) : undefined}
                        >
                          <div className="flex items-center gap-1">
                            <span className={cn(column.sortable && 'hover:underline')}>
                              {column.label}
                            </span>
                            {isSorted && (
                              <span className="text-amber-500">
                                {sort.direction === 'asc' ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {sortedTickets.map((ticket, index) => {
                      const isBeingDragged = draggingTicketIds.includes(ticket.id)
                      // Show drop indicator before this ticket if this is the drop position
                      // Don't show indicator on the dragged ticket itself
                      const showIndicator = !isBeingDragged && index === dropPosition

                      return (
                        <SprintTableRow
                          key={ticket.id}
                          ticket={ticket}
                          projectKey={projectKey}
                          statusColumns={statusColumns}
                          columns={visibleColumns}
                          allTicketIds={ticketIds}
                          isBeingDragged={isBeingDragged}
                          showDropIndicator={showIndicator}
                          draggingCount={draggingCount}
                        />
                      )
                    })}
                    {/* Drop indicator at end of list */}
                    {dropPosition !== null && dropPosition >= sortedTickets.length && (
                      <tr>
                        <td colSpan={visibleColumns.length + 1} className="p-0">
                          <DropIndicator itemCount={draggingCount} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableContext>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
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
