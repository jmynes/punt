import type { ColumnWithTickets, SprintSummary, TicketWithRelations } from '@/types'

/**
 * Determine if a column represents "done" status based on its name.
 * Used for auto-detecting completed tickets when completing sprints.
 */
export function isCompletedColumn(columnName: string): boolean {
  const patterns = ['done', 'complete', 'completed', 'closed', 'resolved', 'finished']
  return patterns.includes(columnName.trim().toLowerCase())
}

/**
 * Get incomplete tickets for a sprint based on which columns are considered "done".
 */
export function getIncompleteTickets(
  tickets: TicketWithRelations[],
  columns: ColumnWithTickets[],
  doneColumnIds?: string[],
): TicketWithRelations[] {
  const completedIds =
    doneColumnIds ?? columns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id)

  return tickets.filter((ticket) => !completedIds.includes(ticket.columnId))
}

/**
 * Get completed tickets for a sprint based on which columns are considered "done".
 */
export function getCompletedTickets(
  tickets: TicketWithRelations[],
  columns: ColumnWithTickets[],
  doneColumnIds?: string[],
): TicketWithRelations[] {
  const completedIds =
    doneColumnIds ?? columns.filter((col) => isCompletedColumn(col.name)).map((col) => col.id)

  return tickets.filter((ticket) => completedIds.includes(ticket.columnId))
}

/**
 * Generate the next sprint name by incrementing the number.
 * Examples:
 * - "Sprint 1" -> "Sprint 2"
 * - "Sprint 10" -> "Sprint 11"
 * - "January Sprint" -> "January Sprint 2"
 */
export function generateNextSprintName(currentName: string): string {
  // Try to find a trailing number
  const match = currentName.match(/^(.*?)(\d+)$/)

  if (match) {
    const prefix = match[1]
    const number = parseInt(match[2], 10)
    return `${prefix}${number + 1}`
  }

  // No trailing number, append " 2"
  return `${currentName} 2`
}

/**
 * Check if a sprint is expired (past its end date).
 */
export function isSprintExpired(sprint: SprintSummary): boolean {
  if (!sprint.endDate) return false
  return new Date(sprint.endDate) < new Date()
}

/**
 * Check if a sprint is active.
 */
export function isSprintActive(sprint: SprintSummary): boolean {
  return sprint.status === 'active'
}

/**
 * Calculate days remaining until sprint end.
 * Returns negative number if sprint is past end date.
 */
export function getDaysRemaining(endDate: Date | null): number | null {
  if (!endDate) return null

  const now = new Date()
  const end = new Date(endDate)
  const diffMs = end.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Format days remaining as human-readable string.
 */
export function formatDaysRemaining(endDate: Date | null): string {
  const days = getDaysRemaining(endDate)

  if (days === null) return 'No end date'
  if (days < -1) return `Ended ${Math.abs(days)} days ago`
  if (days === -1) return 'Ended yesterday'
  if (days === 0) return 'Ends today'
  if (days === 1) return '1 day remaining'
  return `${days} days remaining`
}

/**
 * Calculate sprint progress percentage based on tickets.
 */
export function calculateSprintProgress(completedCount: number, totalCount: number): number {
  if (totalCount === 0) return 0
  return Math.round((completedCount / totalCount) * 100)
}

/**
 * Get sprint status badge color.
 */
export function getSprintStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'planning':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'completed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get sprint status display label.
 */
export function getSprintStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'planning':
      return 'Planning'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}
