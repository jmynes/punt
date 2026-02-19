'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useParticles } from '@/hooks/use-particles'
import { useBoardStore } from '@/stores/board-store'
import type { SprintWithMetrics, TicketWithRelations } from '@/types'

/**
 * Threshold percentage at which the fire effect is triggered (120% = 1.2)
 */
const FIRE_THRESHOLD = 1.2

/**
 * Calculate total story points for a sprint from tickets
 */
function calculateSprintPoints(tickets: TicketWithRelations[], sprintId: string): number {
  return tickets
    .filter((t) => t.sprintId === sprintId)
    .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
}

/**
 * Hook to monitor sprint budget and trigger fire effect when crossing over-budget threshold.
 * Only triggers when budget goes FROM under 120% TO over 120%.
 */
export function useBudgetAlert(
  projectId: string,
  activeSprint: SprintWithMetrics | null | undefined,
) {
  const { triggerFire } = useParticles()
  // Subscribe to the actual columns data so we re-render when tickets change
  const columns = useBoardStore((s) => s.projects[projectId] ?? [])

  // Track previous budget percentage to detect threshold crossing
  const previousPercentRef = useRef<number | null>(null)

  // Calculate current sprint points from columns
  const currentPoints = useMemo(() => {
    if (!activeSprint) return 0
    const tickets = columns.flatMap((col) => col.tickets)
    return calculateSprintPoints(tickets, activeSprint.id)
  }, [activeSprint, columns])

  // Calculate current percentage
  const budget = activeSprint?.budget
  const currentPercent = budget && budget > 0 ? currentPoints / budget : 0

  useEffect(() => {
    // No budget set, nothing to monitor
    if (!budget || budget <= 0) {
      previousPercentRef.current = null
      return
    }

    const previousPercent = previousPercentRef.current

    // Check if we just crossed the threshold
    if (
      previousPercent !== null &&
      previousPercent < FIRE_THRESHOLD &&
      currentPercent >= FIRE_THRESHOLD
    ) {
      // Crossed from under to over threshold - trigger fire effect
      triggerFire()
    }

    // Update ref for next render
    previousPercentRef.current = currentPercent
  }, [currentPercent, budget, triggerFire])

  return {
    currentPercent: Math.round(currentPercent * 100),
    isOverBudget: currentPercent >= FIRE_THRESHOLD,
  }
}
