'use client'

import { format } from 'date-fns'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { useState } from 'react'
import { useTicketSprintHistory } from '@/hooks/queries/use-tickets'
import { cn } from '@/lib/utils'
import { Label } from '../ui/label'

interface SprintHistoryTimelineProps {
  projectId: string
  ticketId: string
}

export function SprintHistoryTimeline({ projectId, ticketId }: SprintHistoryTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: history, isLoading } = useTicketSprintHistory(projectId, ticketId)

  // Hide when no history and not loading
  if (!isLoading && (!history || history.length === 0)) {
    return null
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="flex items-center gap-2 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Label className="text-zinc-400 flex items-center gap-2 cursor-pointer group-hover:text-zinc-300 transition-colors">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <History className="h-4 w-4" />
          Sprint History
          {history && history.length > 0 && (
            <span className="text-xs text-zinc-500">({history.length})</span>
          )}
        </Label>
      </button>

      {isExpanded && (
        <div className="relative ml-2 pl-4 border-l border-zinc-700/50">
          {isLoading ? (
            <div className="py-2 text-xs text-zinc-500">Loading...</div>
          ) : (
            history?.map((entry, index) => {
              const isLast = index === history.length - 1
              const addedDate = new Date(entry.addedAt)
              const removedDate = entry.removedAt ? new Date(entry.removedAt) : null

              return (
                <div key={entry.id} className={cn('relative pb-4', isLast && 'pb-0')}>
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-zinc-900',
                      entry.sprint.status === 'active'
                        ? 'bg-green-500'
                        : entry.sprint.status === 'completed'
                          ? 'bg-blue-500'
                          : 'bg-zinc-500',
                    )}
                  />

                  <div className="space-y-1">
                    {/* Sprint name */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{entry.sprint.name}</span>
                      {entry.entryType === 'carried_over' && (
                        <span className="inline-flex items-center rounded-full px-1.5 h-4 text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          Carried over
                        </span>
                      )}
                    </div>

                    {/* Date range */}
                    <div className="text-xs text-zinc-500">
                      {format(addedDate, 'MMM d, yyyy')}
                      {' \u2192 '}
                      {removedDate ? format(removedDate, 'MMM d, yyyy') : 'Present'}
                    </div>

                    {/* Exit status */}
                    {entry.exitStatus && (
                      <span
                        className={cn(
                          'inline-flex items-center text-[11px] font-medium',
                          entry.exitStatus === 'completed' && 'text-green-400',
                          entry.exitStatus === 'carried_over' && 'text-orange-400',
                          entry.exitStatus === 'removed' && 'text-red-400',
                        )}
                      >
                        {entry.exitStatus === 'completed'
                          ? 'Completed'
                          : entry.exitStatus === 'carried_over'
                            ? 'Carried over'
                            : 'Removed'}
                      </span>
                    )}
                    {!entry.exitStatus && !removedDate && (
                      <span className="inline-flex items-center text-[11px] font-medium text-blue-400">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
