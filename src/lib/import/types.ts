/**
 * Shared types for the ticket import system.
 * These types are used by both parsers and the API route.
 */

import type { IssueType, Priority } from '@/types'

/**
 * A single ticket parsed from an external source, ready for preview and import.
 */
export interface ParsedTicket {
  /** Original external ID/key (e.g., "PROJ-123" for Jira, "#42" for GitHub) */
  externalKey: string
  title: string
  description: string | null
  type: IssueType
  priority: Priority
  storyPoints: number | null
  labels: string[]
  /** Original status string from the source system */
  originalStatus: string | null
  /** Original priority string from the source system */
  originalPriority: string | null
  /** Original type string from the source system */
  originalType: string | null
  /** Whether this ticket appears to be resolved/closed */
  isResolved: boolean
  /** Resolution value if resolved */
  resolution: string | null
}

/**
 * Result from parsing an import file.
 */
export interface ParseResult {
  /** Successfully parsed tickets */
  tickets: ParsedTicket[]
  /** Warnings encountered during parsing (non-fatal) */
  warnings: string[]
  /** The detected source format */
  source: 'jira' | 'github'
}

/**
 * Import request body sent to the API.
 */
export interface ImportRequest {
  tickets: ParsedTicket[]
  /** Column ID to place imported tickets into */
  columnId: string
  /** Optional sprint ID to assign tickets to */
  sprintId?: string | null
  /** Whether to create labels that don't exist yet */
  createMissingLabels: boolean
}

/**
 * Result from the import API.
 */
export interface ImportResult {
  /** Number of tickets successfully imported */
  imported: number
  /** Number of labels created during import */
  labelsCreated: number
  /** Warnings from the import process */
  warnings: string[]
}
