'use client'

import { useEffect, useMemo } from 'react'
import { useActiveSprint, useCompleteSprint } from '@/hooks/queries/use-sprints'
import { isCompletedColumn, isSprintExpired } from '@/lib/sprint-utils'
import { useSprintStore } from '@/stores/sprint-store'
import { useUIStore } from '@/stores/ui-store'
import type {
  ColumnWithTickets,
  SprintCompletionOptions,
  SprintStatus,
  TicketWithRelations,
} from '@/types'

interface UseSprintCompletionOptions {
  projectId: string
  tickets?: TicketWithRelations[]
  columns?: ColumnWithTickets[]
}

/**
 * Hook for detecting and handling expired sprint completion.
 * Automatically shows the sprint completion dialog when a sprint expires,
 * respecting user dismissals.
 */
export function useSprintCompletion({
  projectId,
  tickets = [],
  columns = [],
}: UseSprintCompletionOptions) {
  const { data: activeSprint, isLoading } = useActiveSprint(projectId)
  const completeSprint = useCompleteSprint(projectId)
  const { shouldShowPrompt, dismissSprintPrompt, clearDismissedPrompt } = useSprintStore()
  const { openSprintComplete, sprintCompleteOpen } = useUIStore()

  // Check if sprint is expired
  const isExpired = useMemo(() => {
    if (!activeSprint) return false
    return isSprintExpired({ ...activeSprint, status: activeSprint.status as SprintStatus })
  }, [activeSprint])

  // Get tickets in the current sprint
  const sprintTickets = useMemo(() => {
    if (!activeSprint) return []
    return tickets.filter((t) => t.sprintId === activeSprint.id)
  }, [activeSprint, tickets])

  // Determine which columns are "done"
  const doneColumnIds = useMemo(() => {
    return columns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id)
  }, [columns])

  // Categorize tickets
  const completedTickets = useMemo(() => {
    return sprintTickets.filter((t) => doneColumnIds.includes(t.columnId))
  }, [sprintTickets, doneColumnIds])

  const incompleteTickets = useMemo(() => {
    return sprintTickets.filter((t) => !doneColumnIds.includes(t.columnId))
  }, [sprintTickets, doneColumnIds])

  // Determine if we should show the prompt
  const showPrompt = useMemo(() => {
    if (!activeSprint || !isExpired || isLoading) return false
    return shouldShowPrompt(activeSprint.id)
  }, [activeSprint, isExpired, isLoading, shouldShowPrompt])

  // Auto-open completion dialog when sprint expires
  useEffect(() => {
    if (showPrompt && activeSprint && !sprintCompleteOpen) {
      openSprintComplete(activeSprint.id)
    }
  }, [showPrompt, activeSprint, sprintCompleteOpen, openSprintComplete])

  // Handle complete sprint
  const handleComplete = async (options: SprintCompletionOptions) => {
    if (!activeSprint) return

    // For extend action, clear the dismissed prompt so it can show again when it expires
    if (options.action === 'extend') {
      clearDismissedPrompt(activeSprint.id)
    }

    return completeSprint.mutateAsync({
      sprintId: activeSprint.id,
      options: {
        action: options.action,
        targetSprintId: options.targetSprintId,
        createNextSprint: options.createNextSprint,
        doneColumnIds: options.doneColumnIds,
      },
    })
  }

  // Handle dismiss
  const handleDismiss = (action: 'later' | 'extend') => {
    if (activeSprint) {
      dismissSprintPrompt(activeSprint.id, action)
    }
  }

  return {
    activeSprint,
    isExpired,
    showPrompt,
    sprintTickets,
    completedTickets,
    incompleteTickets,
    doneColumnIds,
    isLoading,
    isCompleting: completeSprint.isPending,
    handleComplete,
    handleDismiss,
  }
}
