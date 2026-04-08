/**
 * GitHub Issues Import Parser
 *
 * Parses GitHub Issues JSON from:
 * - GitHub REST API response (GET /repos/{owner}/{repo}/issues)
 * - `gh issue list --json` CLI output
 * - Manual JSON export
 */

import type { IssueType, Priority } from '@/types'
import type { ParsedTicket, ParseResult } from './types'

/**
 * Well-known GitHub labels that map to PUNT ticket types.
 */
const TYPE_LABEL_MAP: Record<string, IssueType> = {
  bug: 'bug',
  'type: bug': 'bug',
  'type:bug': 'bug',
  defect: 'bug',
  epic: 'epic',
  'type: epic': 'epic',
  story: 'story',
  'type: story': 'story',
  'user story': 'story',
  feature: 'story',
  'type: feature': 'story',
  enhancement: 'story',
  task: 'task',
  'type: task': 'task',
  chore: 'task',
  subtask: 'subtask',
  'sub-task': 'subtask',
}

/**
 * Well-known GitHub labels that map to PUNT priorities.
 */
const PRIORITY_LABEL_MAP: Record<string, Priority> = {
  critical: 'critical',
  'priority: critical': 'critical',
  p0: 'critical',
  'priority: highest': 'highest',
  p1: 'highest',
  'priority: high': 'high',
  p2: 'high',
  high: 'high',
  'priority: medium': 'medium',
  p3: 'medium',
  medium: 'medium',
  'priority: low': 'low',
  p4: 'low',
  low: 'low',
  'priority: lowest': 'lowest',
  p5: 'lowest',
  trivial: 'lowest',
}

/**
 * Extract type from GitHub labels. Returns the first matching type label found.
 */
function extractType(labels: string[]): { type: IssueType; matchedLabel: string | null } {
  for (const label of labels) {
    const normalized = label.toLowerCase().trim()
    if (normalized in TYPE_LABEL_MAP) {
      return { type: TYPE_LABEL_MAP[normalized], matchedLabel: label }
    }
  }
  return { type: 'task', matchedLabel: null }
}

/**
 * Extract priority from GitHub labels. Returns the first matching priority label found.
 */
function extractPriority(labels: string[]): { priority: Priority; matchedLabel: string | null } {
  for (const label of labels) {
    const normalized = label.toLowerCase().trim()
    if (normalized in PRIORITY_LABEL_MAP) {
      return { priority: PRIORITY_LABEL_MAP[normalized], matchedLabel: label }
    }
  }
  return { priority: 'medium', matchedLabel: null }
}

/**
 * Parse a single GitHub issue object.
 */
function parseGitHubIssue(issue: Record<string, unknown>, warnings: string[]): ParsedTicket | null {
  // Handle both REST API format and gh CLI format
  const title = (issue.title as string) ?? ''
  if (!title) {
    const number = issue.number ?? 'unknown'
    warnings.push(`Skipping issue #${number}: no title found`)
    return null
  }

  // Skip pull requests (GitHub API includes PRs in issue endpoints)
  if (issue.pull_request || issue.pullRequest) {
    return null
  }

  const number = issue.number as number | undefined
  const externalKey = number ? `#${number}` : ''

  // Description from body
  const description = (issue.body as string) ?? null

  // Labels - handle both string arrays and object arrays
  const rawLabels = issue.labels as unknown[] | undefined
  const labelNames: string[] = []
  if (Array.isArray(rawLabels)) {
    for (const label of rawLabels) {
      if (typeof label === 'string') {
        labelNames.push(label)
      } else if (label && typeof label === 'object') {
        const name = (label as Record<string, unknown>).name as string | undefined
        if (name) labelNames.push(name)
      }
    }
  }

  // Extract type and priority from labels
  const { type, matchedLabel: typeLabel } = extractType(labelNames)
  const { priority, matchedLabel: priorityLabel } = extractPriority(labelNames)

  // Filter out type/priority labels from the label list (they're now encoded as fields)
  const filteredLabels = labelNames.filter((l) => {
    const normalized = l.toLowerCase().trim()
    return normalized !== typeLabel?.toLowerCase() && normalized !== priorityLabel?.toLowerCase()
  })

  // Status from state
  const state = (issue.state as string) ?? null
  const stateReason = (issue.state_reason as string) ?? (issue.stateReason as string) ?? null
  const isResolved = state === 'closed'

  // Map GitHub close reason to resolution
  let resolution: string | null = null
  if (isResolved) {
    if (stateReason === 'not_planned') {
      resolution = "Won't Do"
    } else {
      resolution = 'Done'
    }
  }

  return {
    externalKey,
    title,
    description,
    type,
    priority,
    storyPoints: null,
    labels: filteredLabels,
    originalStatus: state,
    originalPriority: null,
    originalType: null,
    isResolved,
    resolution,
  }
}

/**
 * Parse GitHub Issues JSON data.
 *
 * Supports multiple formats:
 * - Array of issues: [{ title, body, labels, ... }, ...]
 * - Single issue: { title, body, labels, ... }
 * - GitHub API paginated response: { items: [...] } (from search endpoint)
 */
export function parseGitHubJson(data: unknown): ParseResult {
  const warnings: string[] = []
  const tickets: ParsedTicket[] = []

  let issues: Record<string, unknown>[]

  if (Array.isArray(data)) {
    issues = data
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) {
      // GitHub search API format
      issues = obj.items as Record<string, unknown>[]
    } else if (obj.title) {
      // Single issue
      issues = [obj]
    } else {
      return {
        tickets: [],
        warnings: ['Could not find issues in the GitHub JSON data'],
        source: 'github',
      }
    }
  } else {
    return { tickets: [], warnings: ['Invalid GitHub JSON data'], source: 'github' }
  }

  for (const issue of issues) {
    const parsed = parseGitHubIssue(issue, warnings)
    if (parsed) {
      tickets.push(parsed)
    }
  }

  if (tickets.length === 0 && issues.length > 0) {
    warnings.push('No valid issues found in the GitHub export (pull requests are excluded)')
  }

  return { tickets, warnings, source: 'github' }
}
