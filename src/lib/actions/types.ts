/**
 * Shared types for action modules.
 * These types are used by the unified action implementations.
 */

import type { ColumnWithTickets, TicketWithRelations } from '@/types'

/**
 * Ticket with its column ID, used for paste and delete operations.
 */
export interface TicketWithColumn {
  ticket: TicketWithRelations
  columnId: string
}

/**
 * Result of a paste operation.
 */
export interface PasteResult {
  success: boolean
  newTickets: TicketWithColumn[]
  error?: string
}

/**
 * Result of a delete operation.
 */
export interface DeleteResult {
  success: boolean
  deletedTickets: TicketWithColumn[]
  error?: string
}

/**
 * Result of a move operation.
 */
export interface MoveResult {
  success: boolean
  movedTickets: Array<{
    ticketId: string
    fromColumnId: string
    toColumnId: string
  }>
  originalColumns?: ColumnWithTickets[]
  afterColumns?: ColumnWithTickets[]
  error?: string
}

/**
 * Options for action operations.
 */
export interface ActionOptions {
  /** Whether to show undo buttons in toast notifications */
  showUndoButtons?: boolean
  /** Custom toast duration in milliseconds */
  toastDuration?: number
}
