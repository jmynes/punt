'use client'

import { Plus } from 'lucide-react'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteSprint, useProjectSprints } from '@/hooks/queries/use-sprints'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { SprintCard } from './sprint-card'

interface SprintListProps {
  projectId: string
  tickets?: { sprintId: string | null }[]
  className?: string
}

/**
 * List of all sprints for a project, grouped by status.
 */
export function SprintList({ projectId, tickets = [], className }: SprintListProps) {
  const { data: sprints, isLoading } = useProjectSprints(projectId)
  const deleteSprint = useDeleteSprint(projectId)
  const { setSprintCreateOpen } = useUIStore()

  // Count tickets per sprint
  const ticketCounts = tickets.reduce(
    (acc, ticket) => {
      if (ticket.sprintId) {
        acc[ticket.sprintId] = (acc[ticket.sprintId] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>,
  )

  const handleDelete = useCallback(
    (sprintId: string) => {
      if (window.confirm('Are you sure you want to delete this sprint?')) {
        deleteSprint.mutate(sprintId)
      }
    },
    [deleteSprint],
  )

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-40 bg-zinc-800" />
        <Skeleton className="h-40 bg-zinc-800" />
      </div>
    )
  }

  const activeSprints = sprints?.filter((s) => s.status === 'active') ?? []
  const planningSprints = sprints?.filter((s) => s.status === 'planning') ?? []
  const completedSprints = sprints?.filter((s) => s.status === 'completed') ?? []

  const isEmpty = !sprints || sprints.length === 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with create button (only show when no active sprint) */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Sprints</h2>
        {activeSprints.length === 0 && (
          <Button
            size="sm"
            onClick={() => setSprintCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Sprint
          </Button>
        )}
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
          <p className="text-zinc-500 mb-4">
            No sprints yet. Create your first sprint to get started.
          </p>
          <Button onClick={() => setSprintCreateOpen(true)} variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Create Sprint
          </Button>
        </div>
      ) : (
        <>
          {/* Active sprints */}
          {activeSprints.length > 0 && (
            <Section title="Active" count={activeSprints.length}>
              {activeSprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  projectId={projectId}
                  ticketCount={ticketCounts[sprint.id] || 0}
                />
              ))}
            </Section>
          )}

          {/* Planning sprints */}
          {planningSprints.length > 0 && (
            <Section title="Planning" count={planningSprints.length}>
              {planningSprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  projectId={projectId}
                  ticketCount={ticketCounts[sprint.id] || 0}
                  onDelete={handleDelete}
                />
              ))}
            </Section>
          )}

          {/* Completed sprints */}
          {completedSprints.length > 0 && (
            <Section title="Completed" count={completedSprints.length} collapsed>
              {completedSprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  projectId={projectId}
                  ticketCount={ticketCounts[sprint.id] || 0}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  count: number
  collapsed?: boolean
  children: React.ReactNode
}

function Section({ title, count, collapsed: _collapsed = false, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{count}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  )
}
