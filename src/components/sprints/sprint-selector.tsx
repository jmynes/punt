'use client'

import { AlertCircle, Plus, Target } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useProjectSprints } from '@/hooks/queries/use-sprints'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface SprintSelectorProps {
  projectId: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  placeholder?: string
  showCreateButton?: boolean
  className?: string
  /** When provided, completed sprints are blocked if the ticket has no resolution. */
  ticketResolution?: string | null
}

/**
 * Dropdown selector for choosing a sprint.
 * Groups sprints by status (active, planning, completed).
 * When ticketResolution is provided and null/empty, completed sprints are disabled
 * to prevent orphaning unresolved tickets.
 */
export function SprintSelector({
  projectId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select sprint',
  showCreateButton = true,
  className,
  ticketResolution,
}: SprintSelectorProps) {
  const { data: sprints, isLoading } = useProjectSprints(projectId)
  const { setSprintCreateOpen } = useUIStore()

  const activeSprints = sprints?.filter((s) => s.status === 'active') ?? []
  const planningSprints = sprints?.filter((s) => s.status === 'planning') ?? []
  const completedSprints = sprints?.filter((s) => s.status === 'completed') ?? []

  // Completed sprints are blocked for unresolved tickets when ticketResolution is explicitly provided
  const blockCompletedSprints = ticketResolution !== undefined && !ticketResolution

  const handleValueChange = (newValue: string) => {
    if (newValue === '__none__') {
      onChange(null)
    } else if (newValue === '__create__') {
      setSprintCreateOpen(true)
    } else {
      // Block selection of completed sprints for unresolved tickets
      if (blockCompletedSprints) {
        const selectedSprint = sprints?.find((s) => s.id === newValue)
        if (selectedSprint?.status === 'completed') {
          return
        }
      }
      onChange(newValue)
    }
  }

  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={handleValueChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={cn('bg-zinc-900 border-zinc-700 text-zinc-100', className)}>
        <SelectValue placeholder={placeholder}>
          {value ? (
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-blue-400" />
              <span>{sprints?.find((s) => s.id === value)?.name ?? 'Sprint'}</span>
            </div>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-700">
        {/* No sprint option */}
        <SelectItem value="__none__" className="text-zinc-400">
          <span className="text-zinc-500">No sprint</span>
        </SelectItem>

        {/* Active sprints */}
        {activeSprints.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-zinc-500 text-xs">Active</SelectLabel>
            {activeSprints.map((sprint) => (
              <SelectItem key={sprint.id} value={sprint.id}>
                <div className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full', 'bg-green-500')} />
                  {sprint.name}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Planning sprints */}
        {planningSprints.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-zinc-500 text-xs">Planning</SelectLabel>
            {planningSprints.map((sprint) => (
              <SelectItem key={sprint.id} value={sprint.id}>
                <div className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full', 'bg-blue-500')} />
                  {sprint.name}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Completed sprints (collapsed or limited) */}
        {completedSprints.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-zinc-500 text-xs">Completed</SelectLabel>
            {blockCompletedSprints && (
              <div className="flex items-start gap-2 px-2 py-1.5 text-xs text-amber-400/80">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Unresolved tickets cannot be added to completed sprints. Set a resolution first.
                </span>
              </div>
            )}
            {completedSprints.slice(0, 5).map((sprint) => (
              <Tooltip key={sprint.id}>
                <TooltipTrigger asChild>
                  <div>
                    <SelectItem
                      value={sprint.id}
                      disabled={blockCompletedSprints}
                      className={blockCompletedSprints ? 'opacity-40 cursor-not-allowed' : ''}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full', 'bg-zinc-500')} />
                        <span className="text-zinc-400">{sprint.name}</span>
                      </div>
                    </SelectItem>
                  </div>
                </TooltipTrigger>
                {blockCompletedSprints && (
                  <TooltipContent side="right" className="max-w-xs">
                    This sprint is completed. To add a ticket to a completed sprint, it must have a
                    resolution status (e.g., Done, Won&apos;t Fix).
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
            {completedSprints.length > 5 && (
              <SelectItem disabled value="__more__">
                <span className="text-zinc-500 text-xs">
                  +{completedSprints.length - 5} more completed
                </span>
              </SelectItem>
            )}
          </SelectGroup>
        )}

        {/* Create new sprint option (only when no active sprint) */}
        {showCreateButton && activeSprints.length === 0 && (
          <>
            <SelectSeparator className="bg-zinc-700" />
            <SelectItem value="__create__" className="text-blue-400">
              <div className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                Create new sprint
              </div>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  )
}
