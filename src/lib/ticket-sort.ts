import type { SortConfig } from '@/stores/backlog-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

/**
 * Comparator function for sorting tickets by a given column and direction.
 * Shared between backlog table and sprint section views.
 */
export function createTicketComparator(
  sort: SortConfig,
  statusColumns?: ColumnWithTickets[],
): (a: TicketWithRelations, b: TicketWithRelations) => number {
  return (a, b) => {
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
        if (statusColumns) {
          const aCol = statusColumns.find((c) => c.id === a.columnId)
          const bCol = statusColumns.find((c) => c.id === b.columnId)
          aVal = (aCol?.name ?? 'Unknown').toLowerCase()
          bVal = (bCol?.name ?? 'Unknown').toLowerCase()
        } else {
          aVal = a.columnId
          bVal = b.columnId
        }
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
        aVal = a.dueDate
          ? (a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate)).getTime()
          : Number.MAX_SAFE_INTEGER
        bVal = b.dueDate
          ? (b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate)).getTime()
          : Number.MAX_SAFE_INTEGER
        break
      case 'created':
        aVal = (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)).getTime()
        bVal = (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).getTime()
        break
      case 'updated':
        aVal = (a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt)).getTime()
        bVal = (b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt)).getTime()
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
      case 'startDate':
        aVal = a.startDate
          ? (a.startDate instanceof Date ? a.startDate : new Date(a.startDate)).getTime()
          : Number.MAX_SAFE_INTEGER
        bVal = b.startDate
          ? (b.startDate instanceof Date ? b.startDate : new Date(b.startDate)).getTime()
          : Number.MAX_SAFE_INTEGER
        break
      case 'environment':
        aVal = a.environment?.toLowerCase() || 'zzz'
        bVal = b.environment?.toLowerCase() || 'zzz'
        break
      case 'affectedVersion':
        aVal = a.affectedVersion?.toLowerCase() || 'zzz'
        bVal = b.affectedVersion?.toLowerCase() || 'zzz'
        break
      case 'fixVersion':
        aVal = a.fixVersion?.toLowerCase() || 'zzz'
        bVal = b.fixVersion?.toLowerCase() || 'zzz'
        break
      case 'watchers':
        aVal = a.watchers?.length ?? 0
        bVal = b.watchers?.length ?? 0
        break
    }

    if (aVal === null || bVal === null) return 0
    if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
    return 0
  }
}

/**
 * Sort an array of tickets by the given sort config.
 * Returns a new sorted array (does not mutate the input).
 *
 * @param tickets - The tickets to sort
 * @param sort - Sort configuration (column + direction), or null to skip sorting
 * @param statusColumns - Status columns for resolving column names (used for 'status' sort)
 */
export function sortTickets(
  tickets: TicketWithRelations[],
  sort: SortConfig | null,
  statusColumns?: ColumnWithTickets[],
): TicketWithRelations[] {
  if (!sort) return tickets
  const sorted = [...tickets]
  sorted.sort(createTicketComparator(sort, statusColumns))
  return sorted
}
