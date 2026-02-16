/**
 * Utilities for generating branch names from templates.
 *
 * Supported template variables:
 * - {key}: Full ticket key (e.g., "PUNT-123")
 * - {number}: Ticket number (e.g., "123")
 * - {type}: Ticket type (e.g., "feat", "fix", "task")
 * - {slug}: URL-safe slug from ticket title (e.g., "add-user-authentication")
 * - {project}: Project key lowercase (e.g., "punt")
 *
 * Example templates:
 * - "{type}/{key}-{slug}" -> "feat/punt-123-add-user-authentication"
 * - "{type}/punt-{number}-{slug}" -> "fix/punt-42-broken-login-flow"
 * - "feature/{project}-{number}" -> "feature/punt-123"
 */

import type { IssueType } from '@/types'

// Map issue types to conventional commit/branch prefixes
const ISSUE_TYPE_TO_BRANCH_PREFIX: Record<IssueType, string> = {
  epic: 'feat',
  story: 'feat',
  task: 'chore',
  bug: 'fix',
  subtask: 'chore',
}

/**
 * Convert a string to a URL-safe slug.
 * Preserves alphanumeric characters and hyphens.
 */
export function slugify(text: string, maxLength = 50): string {
  return (
    text
      .toLowerCase()
      .trim()
      // Replace common word separators with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove any character that isn't alphanumeric or hyphen
      .replace(/[^a-z0-9-]/g, '')
      // Replace multiple consecutive hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Truncate to max length, avoiding cutting mid-word
      .slice(0, maxLength)
      .replace(/-+$/, '')
  )
}

/**
 * Get the branch prefix for an issue type.
 */
export function getBranchPrefix(issueType: IssueType): string {
  return ISSUE_TYPE_TO_BRANCH_PREFIX[issueType] ?? 'chore'
}

export interface BranchContext {
  projectKey: string
  ticketNumber: number
  ticketType: IssueType
  ticketTitle: string
}

/**
 * Generate a branch name from a template and ticket context.
 */
export function generateBranchName(template: string, context: BranchContext): string {
  const slug = slugify(context.ticketTitle)
  const prefix = getBranchPrefix(context.ticketType)

  return (
    template
      .replace(/\{key\}/gi, `${context.projectKey.toLowerCase()}-${context.ticketNumber}`)
      .replace(/\{number\}/gi, String(context.ticketNumber))
      .replace(/\{type\}/gi, prefix)
      .replace(/\{slug\}/gi, slug)
      .replace(/\{project\}/gi, context.projectKey.toLowerCase())
      // Clean up any double hyphens that might result from empty slugs
      .replace(/-+/g, '-')
      .replace(/-$/g, '')
  )
}

/**
 * Validate a branch template.
 * Returns null if valid, or an error message if invalid.
 */
export function validateBranchTemplate(template: string): string | null {
  if (!template.trim()) {
    return 'Branch template cannot be empty'
  }

  // Check for at least one variable
  const hasVariable = /\{(key|number|type|slug|project)\}/i.test(template)
  if (!hasVariable) {
    return 'Branch template must contain at least one variable: {key}, {number}, {type}, {slug}, or {project}'
  }

  // Check for invalid characters (branches can't have certain characters)
  const invalidChars = /[~^:?*[\]\\@{}<>|#%]/
  const templateWithoutVars = template.replace(/\{[^}]+\}/g, '')
  if (invalidChars.test(templateWithoutVars)) {
    return 'Branch template contains invalid characters'
  }

  return null
}

/**
 * Preview a branch name for the given template and sample ticket.
 */
export function previewBranchName(
  template: string,
  sampleContext?: Partial<BranchContext>,
): string {
  const defaults: BranchContext = {
    projectKey: 'PROJ',
    ticketNumber: 123,
    ticketType: 'task',
    ticketTitle: 'Add user authentication flow',
    ...sampleContext,
  }

  return generateBranchName(template, defaults)
}
