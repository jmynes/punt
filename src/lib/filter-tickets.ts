import type { TicketWithRelations } from '@/types'

export interface TicketFilterOptions {
  searchQuery: string
  projectKey: string
  filterByType: string[]
  filterByPriority: string[]
  filterByStatus: string[]
  filterByResolution: string[]
  filterByAssignee: string[]
  filterByLabels: string[]
  filterBySprint: string | null
  filterByPoints: { operator: '<' | '>' | '=' | '<=' | '>='; value: number } | null
  filterByDueDate: { from?: Date; to?: Date; includeNone: boolean; includeOverdue: boolean }
  filterByAttachments: 'has' | 'none' | null
  showSubtasks: boolean
}

/**
 * Apply backlog-style filters to a list of tickets.
 * This is shared between the backlog table and sprint planning views.
 */
export function filterTickets(
  tickets: TicketWithRelations[],
  options: TicketFilterOptions,
): TicketWithRelations[] {
  let result = [...tickets]

  // Filter out subtasks if disabled
  if (!options.showSubtasks) {
    result = result.filter((t) => t.type !== 'subtask')
  }

  // Search filter
  if (options.searchQuery) {
    const query = options.searchQuery.toLowerCase()
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        `${options.projectKey}-${t.number}`.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    )
  }

  // Type filter
  if (options.filterByType.length > 0) {
    result = result.filter((t) => options.filterByType.includes(t.type))
  }

  // Priority filter
  if (options.filterByPriority.length > 0) {
    result = result.filter((t) => options.filterByPriority.includes(t.priority))
  }

  // Status filter
  if (options.filterByStatus.length > 0) {
    result = result.filter((t) => options.filterByStatus.includes(t.columnId))
  }

  // Resolution filter
  if (options.filterByResolution.length > 0) {
    result = result.filter((t) => {
      if (options.filterByResolution.includes('unresolved')) {
        if (!t.resolution) return true
      }
      return t.resolution && options.filterByResolution.includes(t.resolution)
    })
  }

  // Assignee filter
  if (options.filterByAssignee.length > 0) {
    result = result.filter((t) => options.filterByAssignee.includes(t.assigneeId || 'unassigned'))
  }

  // Labels filter (any match)
  if (options.filterByLabels.length > 0) {
    result = result.filter((t) => {
      const ids = t.labels.map((l) => l.id)
      return ids.some((id) => options.filterByLabels.includes(id))
    })
  }

  // Sprint filter
  if (options.filterBySprint) {
    if (options.filterBySprint === 'backlog') {
      result = result.filter((t) => !t.sprintId)
    } else {
      result = result.filter((t) => t.sprintId === options.filterBySprint)
    }
  }

  // Points filter
  if (options.filterByPoints) {
    result = result.filter((t) => {
      if (t.storyPoints === null || t.storyPoints === undefined) return false

      const { operator, value } = options.filterByPoints as NonNullable<
        typeof options.filterByPoints
      >
      switch (operator) {
        case '<':
          return t.storyPoints < value
        case '>':
          return t.storyPoints > value
        case '=':
          return t.storyPoints === value
        case '<=':
          return t.storyPoints <= value
        case '>=':
          return t.storyPoints >= value
        default:
          return false
      }
    })
  }

  // Attachments filter
  if (options.filterByAttachments) {
    result = result.filter((t) => {
      const attachmentCount = t._count?.attachments ?? 0
      if (options.filterByAttachments === 'has') {
        return attachmentCount > 0
      }
      return attachmentCount === 0
    })
  }

  // Due date filter
  const {
    from: dueDateFrom,
    to: dueDateTo,
    includeNone: includeNoDueDate,
    includeOverdue,
  } = options.filterByDueDate
  if (dueDateFrom || dueDateTo || includeNoDueDate || includeOverdue) {
    result = result.filter((t) => {
      // Check if we're only filtering for "no due date" tickets (no other filters active)
      const isNoDueDateOnly = includeNoDueDate && !dueDateFrom && !dueDateTo && !includeOverdue
      if (isNoDueDateOnly) {
        // Only show tickets without due dates
        return !t.dueDate
      }

      // Otherwise, apply full filtering logic
      // If we want to include overdue tickets, check that first
      if (includeOverdue && t.dueDate) {
        const ticketDate = new Date(t.dueDate)
        const now = new Date()
        // Overdue means due date is before today (end of today)
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        if (ticketDate.getTime() < todayEnd.getTime()) {
          return true
        }
      }

      // If we want to include tickets with no due date, check that next
      if (includeNoDueDate && !t.dueDate) {
        return true
      }

      // If ticket has no due date but we're not including them, filter it out
      if (!t.dueDate) {
        return false
      }

      // Handle tickets with due dates
      const ticketDate = new Date(t.dueDate)
      const ticketTime = ticketDate.getTime()

      // If no from date, only check upper bound
      if (!dueDateFrom && dueDateTo) {
        const toTime = new Date(dueDateTo).setHours(23, 59, 59, 999)
        return ticketTime <= toTime
      }

      // If no to date, only check lower bound
      if (dueDateFrom && !dueDateTo) {
        const fromTime = new Date(dueDateFrom).setHours(0, 0, 0, 0)
        return ticketTime >= fromTime
      }

      // If both from and to dates, check range
      if (dueDateFrom && dueDateTo) {
        const fromTime = new Date(dueDateFrom).setHours(0, 0, 0, 0)
        const toTime = new Date(dueDateTo).setHours(23, 59, 59, 999)
        return ticketTime >= fromTime && ticketTime <= toTime
      }

      // If neither from nor to, and not including no due date or overdue, show all
      return true
    })
  }

  return result
}
