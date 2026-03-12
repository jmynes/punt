/**
 * Unified Ticket Mutation Service
 *
 * Consolidates ticket mutation logic used across:
 * - Unified action layer (moveTickets, updateTickets, reorderTickets)
 * - API routes (create, update, delete, batch move)
 *
 * This module provides:
 * - Client-side: TicketWithRelations -> UpdateTicketInput conversion
 * - Client-side: TicketWithRelations -> CreateTicketInput conversion
 *
 * Server-side helpers live in '@/lib/ticket-mutations-server' to avoid
 * pulling '@/lib/db' into client bundles.
 */

import type { CreateTicketInput, UpdateTicketInput } from '@/lib/data-provider'
import type { IssueType, Priority, TicketWithRelations } from '@/types'

// =============================================================================
// Client-side: Field mapping utilities
// =============================================================================

/**
 * Convert a partial TicketWithRelations object to UpdateTicketInput format
 * for the API. Handles field name mapping (e.g., creatorId -> reporterId)
 * and relation flattening (e.g., labels[] -> labelIds[]).
 *
 * Used by:
 * - updateTickets action (ticket-actions.ts)
 * - updateTicketAPI (use-tickets.ts)
 */
export function toUpdateTicketInput(updates: Partial<TicketWithRelations>): UpdateTicketInput {
  const apiUpdates: UpdateTicketInput = {}

  // Copy scalar fields
  if ('title' in updates) apiUpdates.title = updates.title
  if ('description' in updates) apiUpdates.description = updates.description
  if ('type' in updates) apiUpdates.type = updates.type
  if ('priority' in updates) apiUpdates.priority = updates.priority
  if ('columnId' in updates) apiUpdates.columnId = updates.columnId
  if ('order' in updates) apiUpdates.order = updates.order
  if ('storyPoints' in updates) apiUpdates.storyPoints = updates.storyPoints
  if ('estimate' in updates) apiUpdates.estimate = updates.estimate
  if ('assigneeId' in updates) apiUpdates.assigneeId = updates.assigneeId
  if ('creatorId' in updates) apiUpdates.reporterId = updates.creatorId // Map to API field name
  if ('sprintId' in updates) apiUpdates.sprintId = updates.sprintId
  if ('parentId' in updates) apiUpdates.parentId = updates.parentId
  if ('startDate' in updates) apiUpdates.startDate = updates.startDate
  if ('dueDate' in updates) apiUpdates.dueDate = updates.dueDate
  if ('resolution' in updates) apiUpdates.resolution = updates.resolution
  if ('resolvedAt' in updates) apiUpdates.resolvedAt = updates.resolvedAt
  if ('environment' in updates) apiUpdates.environment = updates.environment
  if ('affectedVersion' in updates) apiUpdates.affectedVersion = updates.affectedVersion
  if ('fixVersion' in updates) apiUpdates.fixVersion = updates.fixVersion

  // Convert labels relation to labelIds
  if ('labels' in updates && updates.labels) {
    apiUpdates.labelIds = updates.labels.map((l) => l.id)
  }

  return apiUpdates
}

/** Input accepted by toCreateTicketInput — covers both TicketFormData and TicketWithRelations shapes. */
interface CreateTicketData {
  title: string
  description?: string | null
  type?: IssueType | null
  priority?: Priority | null
  assigneeId?: string | null
  reporterId?: string | null
  creatorId?: string | null
  sprintId?: string | null
  parentId?: string | null
  storyPoints?: number | null
  estimate?: string | null
  resolution?: string | null
  resolvedAt?: Date | null
  startDate?: Date | null
  dueDate?: Date | null
  labelIds?: string[]
  labels?: { id: string }[]
  createdAt?: Date | null
}

/**
 * Convert ticket data to CreateTicketInput format for the API.
 * Accepts either TicketFormData (from create dialog) or
 * Partial<TicketWithRelations> (from paste/undo/restore).
 */
export function toCreateTicketInput(
  columnId: string,
  ticketData: CreateTicketData,
): CreateTicketInput {
  return {
    title: ticketData.title,
    description: ticketData.description ?? null,
    type: ticketData.type ?? 'task',
    priority: ticketData.priority ?? 'medium',
    columnId,
    assigneeId: ticketData.assigneeId ?? null,
    reporterId: ticketData.reporterId ?? ticketData.creatorId ?? null,
    sprintId: ticketData.sprintId ?? null,
    parentId: ticketData.parentId ?? null,
    storyPoints: ticketData.storyPoints ?? null,
    estimate: ticketData.estimate ?? null,
    resolution: ticketData.resolution ?? null,
    resolvedAt: ticketData.resolvedAt ?? null,
    startDate: ticketData.startDate ?? null,
    dueDate: ticketData.dueDate ?? null,
    labelIds: ticketData.labelIds ?? ticketData.labels?.map((l) => l.id) ?? [],
    createdAt: ticketData.createdAt ?? null,
  }
}

// Server-side helpers: see '@/lib/ticket-mutations-server'
