'use client'

import { format } from 'date-fns'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Play,
  Target,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  formatDaysRemaining,
  getSprintStatusColor,
  getSprintStatusLabel,
  isSprintExpired,
} from '@/lib/sprint-utils'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { SprintStatus, SprintWithMetrics } from '@/types'

interface SprintCardProps {
  sprint: SprintWithMetrics
  projectId: string
  ticketCount?: number
  onDelete?: (sprintId: string) => void
}

/**
 * Card component displaying sprint information and actions.
 */
export function SprintCard({ sprint, projectId, ticketCount = 0, onDelete }: SprintCardProps) {
  const { openSprintEdit, openSprintStart, openSprintComplete } = useUIStore()
  const canManageSprints = useHasPermission(projectId, PERMISSIONS.SPRINTS_MANAGE)

  const isPlanning = sprint.status === 'planning'
  const isActive = sprint.status === 'active'
  const isCompleted = sprint.status === 'completed'
  const expired = isActive && isSprintExpired({ ...sprint, status: sprint.status as SprintStatus })

  const dateRange =
    sprint.startDate && sprint.endDate
      ? `${format(new Date(sprint.startDate), 'MMM d')} - ${format(new Date(sprint.endDate), 'MMM d, yyyy')}`
      : sprint.startDate
        ? `Starts ${format(new Date(sprint.startDate), 'MMM d, yyyy')}`
        : sprint.endDate
          ? `Ends ${format(new Date(sprint.endDate), 'MMM d, yyyy')}`
          : 'No dates set'

  return (
    <Card
      className={cn(
        'bg-zinc-900 border-zinc-800 transition-colors',
        isActive && 'border-green-500/30',
        expired && 'border-orange-500/30',
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-400" />
            <h3 className="font-semibold text-zinc-100">{sprint.name}</h3>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                getSprintStatusColor(sprint.status),
              )}
            >
              {getSprintStatusLabel(sprint.status)}
            </span>
          </div>
          {sprint.goal && (
            <p className="text-sm text-zinc-500 line-clamp-2">&ldquo;{sprint.goal}&rdquo;</p>
          )}
        </div>

        {canManageSprints && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
              <DropdownMenuItem
                onClick={() => openSprintEdit(sprint.id)}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Sprint
              </DropdownMenuItem>

              {isPlanning && (
                <DropdownMenuItem
                  onClick={() => openSprintStart(sprint.id)}
                  className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Sprint
                </DropdownMenuItem>
              )}

              {isActive && (
                <DropdownMenuItem
                  onClick={() => openSprintComplete(sprint.id)}
                  className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Sprint
                </DropdownMenuItem>
              )}

              {isPlanning && onDelete && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  <DropdownMenuItem
                    onClick={() => onDelete(sprint.id)}
                    className="text-red-400 focus:bg-red-900/20 focus:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Sprint
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Dates */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <CalendarDays className="h-4 w-4" />
          <span>{dateRange}</span>
        </div>

        {/* Time remaining for active sprint */}
        {isActive && sprint.endDate && (
          <div
            className={cn(
              'flex items-center gap-2 text-sm',
              expired ? 'text-orange-400' : 'text-zinc-400',
            )}
          >
            <Clock className="h-4 w-4" />
            <span>{formatDaysRemaining(sprint.endDate)}</span>
          </div>
        )}

        {/* Metrics for active/completed sprints */}
        {(isActive || isCompleted) && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Tickets:</span>
              <span className="text-zinc-300">{ticketCount}</span>
            </div>
            {isCompleted && sprint.completedTicketCount != null && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">Completed:</span>
                  <span className="text-zinc-300">{sprint.completedTicketCount}</span>
                </div>
                {sprint.incompleteTicketCount != null && sprint.incompleteTicketCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-orange-500">Incomplete:</span>
                    <span className="text-zinc-300">{sprint.incompleteTicketCount}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Story points for completed sprints */}
        {isCompleted && sprint.completedStoryPoints != null && (
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>
              {sprint.completedStoryPoints} story point
              {sprint.completedStoryPoints !== 1 ? 's' : ''} completed
            </span>
          </div>
        )}

        {/* Action buttons - only show if user can manage sprints */}
        {canManageSprints && (
          <div className="flex gap-2 pt-2">
            {isPlanning && (
              <Button
                size="sm"
                onClick={() => openSprintStart(sprint.id)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="h-3 w-3 mr-1" />
                Start Sprint
              </Button>
            )}
            {isActive && expired && (
              <Button
                size="sm"
                onClick={() => openSprintComplete(sprint.id)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
