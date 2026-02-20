/**
 * Audit trail logger for ticket changes.
 * Records all ticket modifications to the TicketActivity table for
 * historical tracking and display in the ticket activity timeline.
 */

import { db } from '@/lib/db'

/** A single field change to log. */
export interface FieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

/**
 * Stringify a value for storage in the audit trail.
 * Handles dates, arrays, objects, nulls, and primitives.
 */
function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Generate a unique group ID for batching related changes.
 */
function generateGroupId(): string {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Log a single ticket activity entry.
 */
export async function logTicketActivity(
  ticketId: string,
  userId: string | null,
  action: string,
  options?: {
    field?: string
    oldValue?: unknown
    newValue?: unknown
    groupId?: string
  },
): Promise<void> {
  try {
    await db.ticketActivity.create({
      data: {
        ticketId,
        userId,
        action,
        field: options?.field ?? null,
        oldValue: stringifyValue(options?.oldValue),
        newValue: stringifyValue(options?.newValue),
        groupId: options?.groupId ?? null,
      },
    })
  } catch (error) {
    // Log but don't throw - audit logging should never block the main operation
    console.error('Failed to log ticket activity:', error)
  }
}

/**
 * Log ticket creation.
 */
export async function logTicketCreated(ticketId: string, userId: string): Promise<void> {
  await logTicketActivity(ticketId, userId, 'created')
}

/**
 * Log a single field change on a ticket.
 */
export async function logTicketFieldChange(
  ticketId: string,
  userId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
): Promise<void> {
  const action = getActionForField(field)
  await logTicketActivity(ticketId, userId, action, { field, oldValue, newValue })
}

/**
 * Log multiple field changes as a batch with a shared group ID.
 * Used when a single API call modifies multiple fields (e.g., drag-move changes column + order).
 */
export async function logBatchChanges(
  ticketId: string,
  userId: string,
  changes: FieldChange[],
): Promise<void> {
  // Filter out irrelevant changes (like order changes during moves)
  const significantChanges = changes.filter((c) => !isInternalField(c.field))

  if (significantChanges.length === 0) return

  // If there's only one change, no need for a group ID
  if (significantChanges.length === 1) {
    const change = significantChanges[0]
    await logTicketFieldChange(ticketId, userId, change.field, change.oldValue, change.newValue)
    return
  }

  const groupId = generateGroupId()

  try {
    await db.ticketActivity.createMany({
      data: significantChanges.map((change) => ({
        ticketId,
        userId,
        action: getActionForField(change.field),
        field: change.field,
        oldValue: stringifyValue(change.oldValue),
        newValue: stringifyValue(change.newValue),
        groupId,
      })),
    })
  } catch (error) {
    console.error('Failed to log batch ticket activities:', error)
  }
}

/**
 * Log ticket deletion.
 */
export async function logTicketDeleted(ticketId: string, userId: string): Promise<void> {
  await logTicketActivity(ticketId, userId, 'deleted')
}

/**
 * Determine the action name based on the field that changed.
 */
function getActionForField(field: string): string {
  switch (field) {
    case 'columnId':
      return 'moved'
    case 'assigneeId':
      return 'assigned'
    case 'sprintId':
      return 'sprint_changed'
    case 'labels':
      return 'labeled'
    case 'resolution':
      return 'resolution_changed'
    case 'priority':
      return 'priority_changed'
    case 'type':
      return 'type_changed'
    case 'parentId':
      return 'parent_changed'
    default:
      return 'updated'
  }
}

/**
 * Fields that are internal/uninteresting and should not generate activity entries.
 */
function isInternalField(field: string): boolean {
  return field === 'order' || field === 'updatedAt'
}

/**
 * Compute the differences between old and new ticket data.
 * Returns an array of FieldChange objects for fields that actually changed.
 */
export function computeTicketChanges(
  existingTicket: Record<string, unknown>,
  updateData: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = []

  for (const [field, newValue] of Object.entries(updateData)) {
    if (newValue === undefined) continue

    const oldValue = existingTicket[field]

    // Compare values, handling date objects and nulls
    if (!valuesAreEqual(oldValue, newValue)) {
      changes.push({ field, oldValue: oldValue ?? null, newValue })
    }
  }

  return changes
}

/**
 * Compare two values for equality, handling dates, objects, and primitives.
 */
function valuesAreEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null && b === null) return true
  if (a === undefined && b === undefined) return true
  if (a === null || b === null) return false
  if (a === undefined || b === undefined) return false

  // Handle Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  if (a instanceof Date) {
    return a.toISOString() === String(b)
  }
  if (b instanceof Date) {
    return String(a) === b.toISOString()
  }

  // Handle array/object comparison
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  return String(a) === String(b)
}
