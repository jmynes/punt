/**
 * Shared types for action modules.
 * These types are used by the unified action implementations.
 */

import type { ColumnWithTickets, LinkType, TicketWithRelations } from '@/types'

/**
 * Comment data for storage during delete operations.
 * Includes authorId to preserve original author when restoring.
 */
export interface CommentForRestore {
  content: string
  authorId: string
  isSystemGenerated: boolean
  source: string | null
  createdAt: string // ISO date string
}

/**
 * Ticket link data for storage during delete operations.
 */
export interface LinkForRestore {
  linkType: LinkType
  linkedTicketId: string
  direction: 'outward' | 'inward'
}

/**
 * Activity data for storage during delete operations.
 * Preserves the audit trail when a ticket is deleted and restored.
 */
export interface ActivityForRestore {
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  groupId: string | null
  userId: string | null
  createdAt: string // ISO date string
}

/**
 * Extended ticket data that includes comments, links, and activities for restoration.
 */
export interface TicketRestoreData {
  comments: CommentForRestore[]
  links: LinkForRestore[]
  activities: ActivityForRestore[]
}

/**
 * Ticket with its column ID, used for paste and delete operations.
 */
export interface TicketWithColumn {
  ticket: TicketWithRelations
  columnId: string
}

/**
 * Ticket with column ID and restore data (comments, links) for undo.
 */
export interface TicketWithRestoreData extends TicketWithColumn {
  restoreData?: TicketRestoreData
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
