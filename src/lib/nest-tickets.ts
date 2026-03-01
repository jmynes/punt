import type { TicketWithRelations } from '@/types'

/**
 * Represents a ticket in the flat list with nesting metadata.
 * Used by TicketTable to render parent/child relationships.
 */
export interface NestedTicketEntry {
  ticket: TicketWithRelations
  /** Whether this ticket is a subtask displayed under its parent */
  isNested: boolean
  /** Depth level (0 = top-level, 1 = subtask under parent) */
  depth: number
  /** Whether this parent ticket has subtasks in the current list */
  hasChildren: boolean
  /** Number of subtasks this parent has in the current list */
  childCount: number
}

/**
 * Takes a flat list of tickets and reorganizes them so that subtasks
 * appear immediately after their parent ticket in the list.
 *
 * - Parent tickets keep their original sort position
 * - Subtasks that have a parent in the list are placed right after the parent
 * - Subtasks whose parent is NOT in the list stay at their original position (depth 0)
 * - Collapsed parents have their children excluded from the result
 *
 * @param tickets - The flat, already-sorted list of tickets
 * @param collapsedParentIds - Set of parent ticket IDs that are collapsed
 * @returns Flat list with nesting metadata for rendering
 */
export function nestTickets(
  tickets: TicketWithRelations[],
  collapsedParentIds: Set<string>,
): NestedTicketEntry[] {
  // Build a map of parentId -> child tickets in this list
  const childrenByParent = new Map<string, TicketWithRelations[]>()
  const parentIdsInList = new Set<string>()

  // First pass: identify which tickets are parents (have subtasks in this list)
  for (const ticket of tickets) {
    if (ticket.parentId) {
      const existing = childrenByParent.get(ticket.parentId) ?? []
      existing.push(ticket)
      childrenByParent.set(ticket.parentId, existing)
    }
  }

  // Track which parent IDs are actually in the list
  for (const ticket of tickets) {
    if (childrenByParent.has(ticket.id)) {
      parentIdsInList.add(ticket.id)
    }
  }

  // Set of subtask IDs that will be placed under their parent
  const nestedSubtaskIds = new Set<string>()
  for (const [parentId, children] of childrenByParent) {
    if (parentIdsInList.has(parentId)) {
      for (const child of children) {
        nestedSubtaskIds.add(child.id)
      }
    }
  }

  // Second pass: build the nested list
  const result: NestedTicketEntry[] = []

  for (const ticket of tickets) {
    // Skip subtasks that will be placed under their parent
    if (nestedSubtaskIds.has(ticket.id)) {
      continue
    }

    const children = childrenByParent.get(ticket.id) ?? []
    const hasChildren = parentIdsInList.has(ticket.id)
    const childCount = children.length

    // Add the parent/top-level ticket
    result.push({
      ticket,
      isNested: false,
      depth: 0,
      hasChildren,
      childCount,
    })

    // If parent is not collapsed, add its children
    if (hasChildren && !collapsedParentIds.has(ticket.id)) {
      for (const child of children) {
        result.push({
          ticket: child,
          isNested: true,
          depth: 1,
          hasChildren: false,
          childCount: 0,
        })
      }
    }
  }

  return result
}
